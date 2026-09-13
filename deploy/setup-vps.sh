#!/usr/bin/env bash
#
# Provision a fresh Debian/Ubuntu VPS to run the ByteCode API.
#
# Run as root on the VPS:
#   bash deploy/setup-vps.sh
#
# Idempotent: safe to re-run after a code update (it rebuilds the sandbox
# images and restarts the service).
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/bytecode}"
REPO_URL="${REPO_URL:-https://github.com/CoderKundu/byteCode-v1.0.0.git}"
SERVICE_USER="${SERVICE_USER:-bytecode}"
NODE_MAJOR="${NODE_MAJOR:-24}"

log() { printf '\n==> %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }

log "Installing Docker, Node ${NODE_MAJOR}, nginx, git"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git nginx

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

log "Creating the ${SERVICE_USER} service account"
# No login shell and no home: this account exists to run one process.
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
# Required to reach the Docker socket. This is root-equivalent on this host —
# see deploy/README.md before running this on a machine that does anything else.
usermod -aG docker "$SERVICE_USER"

log "Fetching the code into ${REPO_DIR}"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" fetch --quiet origin main
  git -C "$REPO_DIR" reset --hard --quiet origin/main
else
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi

log "Installing backend dependencies (production only)"
cd "$REPO_DIR/backend"
npm ci --omit=dev --no-audit --no-fund

log "Building the sandbox images"
# Without these every run returns 503 "sandbox unavailable".
sh docker/build.sh

log "Installing configuration"
install -d -m 750 -o root -g "$SERVICE_USER" /etc/bytecode
if [ ! -f /etc/bytecode/bytecode.env ]; then
  install -m 640 -o root -g "$SERVICE_USER" "$REPO_DIR/deploy/bytecode.env.example" /etc/bytecode/bytecode.env
  echo "    WROTE /etc/bytecode/bytecode.env from the example — EDIT IT before the"
  echo "    service is useful: CORS_ORIGINS still points at a placeholder domain."
fi

log "Installing the systemd unit"
install -m 644 "$REPO_DIR/deploy/bytecode-api.service" /etc/systemd/system/bytecode-api.service
chown -R "$SERVICE_USER":"$SERVICE_USER" "$REPO_DIR"
systemctl daemon-reload
systemctl enable --now bytecode-api
systemctl restart bytecode-api

log "Checking it came up"
sleep 3
if curl -fsS --max-time 5 http://127.0.0.1:5000/health; then
  printf '\n\nAPI is up.\n'
else
  printf '\nAPI did not answer. Logs:\n'
  journalctl -u bytecode-api -n 40 --no-pager
  exit 1
fi

cat <<'NEXT'

Remaining, by hand. The certificate comes BEFORE the proxy config: nginx.conf
names certificate files by path, so installing it first leaves nginx unable to
pass `nginx -t`. See deploy/README.md.

  0. Point an A record for your API domain at this box, and let it resolve.
  1. Edit /etc/bytecode/bytecode.env — set CORS_ORIGINS to your Vercel URL.
     systemctl restart bytecode-api
  2. Firewall: allow 80/443, and do NOT expose 5000.
     ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
  3. certbot certonly --webroot -w /var/www/html -d api.example.com
  4. Install the proxy, now that the certificate exists:
     sed 's/api\.example\.com/your-domain/g' deploy/nginx.conf \
       > /etc/nginx/sites-available/bytecode-api
     ln -sf /etc/nginx/sites-available/bytecode-api /etc/nginx/sites-enabled/
     rm -f /etc/nginx/sites-enabled/default
     nginx -t && systemctl reload nginx
  5. curl https://your-domain/health   (from somewhere other than this box)
  6. Set NEXT_PUBLIC_API_URL on Vercel to https://your-domain and redeploy.
NEXT
