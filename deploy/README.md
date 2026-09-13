# Deploying ByteCode

Two targets, because the two halves have different requirements:

| Part | Where | Why |
|---|---|---|
| Frontend | Vercel | Static Next.js; no special needs |
| Backend | A VPS you control | Needs a **Docker socket** — it starts a container per submission |

**The backend cannot run on Vercel, Netlify, or most serverless platforms.**
`/run-code` shells out to `docker run`; there is no Docker daemon on those
platforms. Any host that gives you a real VM and a Docker socket works —
Hetzner, DigitalOcean, Fly.io, a machine under your desk.

---

## Read this before provisioning the VPS

The API needs to reach the Docker socket, which means its service account is in
the `docker` group. **On Linux, that is equivalent to root on that host**: anyone
who can talk to the socket can start a container that mounts the whole
filesystem.

The sandbox flags (`--network none`, `--read-only`, `--cap-drop ALL`, non-root
uid, memory/CPU/PID caps) are what stand between a submitted program and the
machine. They are tested — see the smoke job — but treat the box as
**disposable**: run ByteCode on a VPS that hosts nothing else you care about,
and be willing to rebuild it.

---

## Backend on a VPS

```bash
ssh root@your-vps
git clone https://github.com/CoderKundu/byteCode-v1.0.0.git /opt/bytecode
bash /opt/bytecode/deploy/setup-vps.sh
```

The script installs Docker, Node 24 and nginx; creates a `bytecode` service
account; installs production dependencies; **builds the three sandbox images**
(without them every run returns `503 sandbox unavailable`); installs the
systemd unit; and starts the service. It is idempotent — re-run it to deploy an
update.

Then, by hand:

1. **Edit `/etc/bytecode/bytecode.env`.** `CORS_ORIGINS` ships pointing at a
   placeholder. The API's own default is `*`, which would let any site on the
   internet drive your compiler.
2. **Install the proxy.** Copy `deploy/nginx.conf` to
   `/etc/nginx/sites-available/bytecode-api`, replace `api.example.com`,
   symlink into `sites-enabled`, drop the default site, `nginx -t`, reload.
3. **Get a certificate:** `certbot --nginx -d api.example.com`.
4. **Firewall:** allow 80/443 only. Port 5000 must not be reachable from
   outside — the API binds it and nginx is what the world talks to.
   ```bash
   ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
   ```

### Two settings that are easy to get wrong

**`TRUST_PROXY_HOPS` must match the number of proxies in front of the API.**
The shipped config has exactly one (nginx), so it is `1`. Set it too low and
every client shares a single rate-limit bucket — nginx's own address — so one
user's traffic throttles everyone. Set it too high, or to `true`, and a client
can spoof `X-Forwarded-For` to mint a fresh bucket per request, which is worse
than having no rate limit at all. If you put Cloudflare in front of nginx, it
becomes `2`.

**nginx must out-wait the API.** A request can queue (`QUEUE_TIMEOUT_MS`) and
then compile and run (`COMPILE_TIMEOUT_MS` + `RUN_TIMEOUT_MS`) — about 40s with
the shipped defaults. `proxy_read_timeout` is 75s to cover that. Lower it below
the sum and nginx returns `504` for requests the API would have answered, so
the user sees a gateway error instead of a proper "timed out" result. Raise the
app's timeouts and you must raise nginx's too.

### Snippets and the database

Share links are stored in SQLite (node's built-in `node:sqlite` — no extra
service, no native module to compile). `SNIPPET_DB_PATH` **must** point inside
`/var/lib/bytecode`: the unit runs `ProtectSystem=strict`, so `/opt` is
read-only and the packaged default would fail to open.

It is the only state on the box worth backing up:

```bash
# SQLite-safe copy; do not just cp a live database.
sqlite3 /var/lib/bytecode/snippets.db ".backup '/root/snippets-backup.db'"
```

Snippets expire after `SNIPPET_TTL_DAYS` (90 by default) and a sweep runs
hourly, so the file reaches a steady size rather than growing forever. Sharing
can be turned off entirely with `SNIPPETS_ENABLED=false`, in which case no
database is created.

**Share links are unlisted, not private.** Ids are random and unguessable, but
anyone with a link can read the snippet. Do not tell users it is private.

### Sizing

Peak memory is roughly `MAX_CONCURRENT_EXECUTIONS × SANDBOX_MEMORY`, on top of
the OS and the API. The defaults (4 × 256 MB) want about 1 GB of headroom, so a
2 GB VPS is a sensible floor. Lower `MAX_CONCURRENT_EXECUTIONS` on a smaller
box — it is the knob that bounds resource use, not the rate limit.

### Operating it

```bash
systemctl status bytecode-api
journalctl -u bytecode-api -f
curl -s localhost:5000/health     # {"status":"ok","executions":{"active":0,...}}
```

`/health` reports live gate state (`active`, `queued`, `max`) and is
deliberately not rate limited, so you can poll it from a monitor.

---

## Frontend on Vercel

1. Import the repo, and set **Root Directory to `frontend`** — this is a
   project setting in the Vercel dashboard and cannot be set from
   `vercel.json`. Without it the build will not find the app.
2. Set the environment variable:
   ```
   NEXT_PUBLIC_API_URL = https://api.example.com
   ```
   It is inlined at build time, so changing it needs a redeploy, not just a
   restart.
3. Deploy. Vercel runs `npm run build`, which fires the `prebuild` hook that
   copies Monaco into `public/monaco` — the editor is served from your own
   deployment, not a CDN.

`frontend/vercel.json` sets cache headers for the Monaco bundle and a few
security headers. Monaco is cached with revalidation rather than immutably,
because it is served from a stable path: caching it immutably would keep
serving the old copy after an upgrade.

There is deliberately **no `Content-Security-Policy`** in that file. A CSP here
would be worth adding, but Monaco's workers and Next's inline bootstrap need
specific allowances, and an untested policy silently breaks the editor. Add one
against a real deployment, not blind.

---

## Updating

**Backend:** re-run `bash /opt/bytecode/deploy/setup-vps.sh`. It pulls `main`,
reinstalls, rebuilds the sandbox images and restarts.

**Frontend:** push to `main`; Vercel builds it.

---

## Verifying a deployment

```bash
# API reachable and healthy
curl -s https://api.example.com/health

# A real run, end to end
curl -s -X POST https://api.example.com/run-code \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","code":"print(sum(range(1,101)))"}'
# -> {"ok":true,"output":"5050\n","exitCode":0,...}

# The sandbox really has no network
curl -s -X POST https://api.example.com/run-code \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","code":"import socket\ntry:\n socket.create_connection((\"1.1.1.1\",53),timeout=3)\n print(\"REACHABLE\")\nexcept Exception:\n print(\"no network\")"}'
# -> must print "no network"
```

Then open the Vercel URL and run something from the editor. If the output panel
says **sandbox unavailable**, the images were not built on the VPS; if it says
**could not reach the API**, check `CORS_ORIGINS` and `NEXT_PUBLIC_API_URL`.
