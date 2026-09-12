# ⚙️ ByteCode — Online Code Compiler

**ByteCode** is a full-stack web-based compiler that runs Python, C++, and Java
in an isolated, resource-limited Docker sandbox. Write code in the browser, pick
a language, and see the output — including real compiler diagnostics when it
doesn't build.

![ByteCode Screenshot](./frontend/public/compiler.png)

---

## 🛠️ Features

- ✨ Monaco code editor, following the light/dark toggle
- 🧠 **Python**, **C++**, and **Java**
- ⌨️ **stdin support** — feed input to your program
- 🐳 One throwaway container per submission — no shared state between users
- 🧾 Real compiler and runtime errors, not a generic "failed" message
- ⏱️ Wall-clock timeouts, memory/CPU/PID caps, and no network inside the sandbox
- 🔥 Responsive UI (Tailwind + Next.js)

---

## 📦 Tech Stack

| Frontend | Backend | Execution |
|---|---|---|
| Next.js 15 + Tailwind CSS 4 | Node.js + Express 5 | Docker |
| Monaco Editor | REST API, CORS | Per-language sandbox images |

---

## 💻 Supported Languages

| Language | Filename | Image | Toolchain |
|---|---|---|---|
| Python | `main.py` | `bytecode-python` | `python:3.11-slim` |
| C++ | `main.cpp` | `bytecode-cpp` | `gcc:13` (`-std=c++17`) |
| Java | `Main.java` | `bytecode-java` | `eclipse-temurin:21-jdk` |

Images are pinned on purpose — `latest` would change the language version under
your users without warning.

---

## 🔒 How the sandbox works

Each `POST /run-code` gets its own throwaway directory under the system temp dir.
The submission is written there, that directory alone is bind-mounted into the
container at `/sandbox`, and it is deleted when the request finishes. The backend
source tree is never mounted, and two concurrent requests can never see each
other's code.

Every container is started with:

| Flag | Why |
|---|---|
| `--network none` | No outbound traffic; the sandbox can't be used as a proxy |
| `--memory` / `--memory-swap` | An allocation loop can't starve the host |
| `--cpus` | A busy loop can't monopolise the CPU |
| `--pids-limit` | Blocks fork bombs |
| `--read-only` + `--tmpfs /tmp` | Immutable rootfs; only `/sandbox` and a small `/tmp` are writable |
| `--cap-drop ALL`, `--security-opt no-new-privileges` | No privilege escalation |
| `--user 65534:65534` | The program does not run as root |
| `--rm` | Nothing is left behind |

Compiled languages run as two container invocations (compile, then execute) so a
compile error is reported as a compile error with the compiler's own output.

On timeout the container is stopped by name with `docker kill` — killing the
Docker CLI alone would leave it running.

---

## 🧪 Local Development

You need **Node.js 18+** and a running **Docker** daemon.

### 1. Clone

```bash
git clone https://github.com/CoderKundu/byteCode-v1.0.0.git
cd byteCode-v1.0.0
```

### 2. Build the sandbox images (once)

```bash
cd backend
npm install
npm run build:images
```

### 3. Start the API

```bash
cp .env.example .env   # optional; sensible defaults are built in
npm start              # http://localhost:5000
```

### 4. Start the frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

---

## ⚙️ Configuration

Backend (`backend/.env`, see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins — set this in production |
| `RUN_TIMEOUT_MS` | `10000` | Execution wall-clock budget |
| `COMPILE_TIMEOUT_MS` | `15000` | Compilation wall-clock budget |
| `SANDBOX_MEMORY` | `256m` | Per-container memory cap |
| `SANDBOX_CPUS` | `0.5` | Per-container CPU cap |
| `SANDBOX_PIDS_LIMIT` | `128` | Per-container process cap |
| `MAX_CODE_LENGTH` | `65536` | Largest accepted submission, in characters |
| `MAX_STDIN_LENGTH` | `65536` | Largest accepted stdin payload, in characters |
| `MAX_OUTPUT_BYTES` | `65536` | Output is truncated past this |

Frontend (`frontend/.env.local`):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Base URL of the API |

---

## 🔌 API

### `POST /run-code`

```json
{ "language": "python", "code": "print(input())", "stdin": "hi\n" }
```

`stdin` is optional. When it is absent or empty the container's stdin is closed,
so a program that reads input gets EOF immediately rather than blocking until
the timeout. It is delivered to the run phase only — a compiler has no use for it.

```json
{
  "ok": true,
  "output": "hi\n",
  "stdout": "hi\n",
  "stderr": "",
  "exitCode": 0,
  "stage": "run",
  "timedOut": false,
  "truncated": false,
  "durationMs": 812
}
```

A compile error, a runtime error, or a timeout is a **200** with `ok: false` —
they're valid answers to a valid request. `400` means the payload was rejected,
`503` means the sandbox itself is unavailable.

### `GET /health`

```json
{ "status": "ok", "languages": ["python", "cpp", "java"] }
```

---

## ✅ Tests

```bash
cd backend
npm test
```

The suite runs without a Docker daemon: it puts a stub `docker` CLI on `PATH`
(`test/fixtures/docker`) and asserts on how the real one *would* be invoked —
the hardening flags, that only the temp dir is mounted, that it's cleaned up,
that concurrent submissions stay isolated, that compiler output is passed
through, that stdin reaches the program but not the compiler, and that a hanging
program is killed and times out promptly.

CI (`.github/workflows/ci.yml`) runs these on every pull request, alongside a
frontend lint/build and a job that builds the sandbox images — the last one is
what actually verifies the pinned base images, since the unit suite stubs Docker
out on purpose.

---

## ➕ Adding a language

Drop a spec in `backend/executor/language/`:

```js
module.exports = {
  id: "go",
  label: "Go",
  filename: "main.go",
  image: "bytecode-go",
  compile: null,                  // or an argv array
  run: ["go", "run", "main.go"],
}
```

Register it in `backend/executor/language/index.js`, add a
`backend/docker/Dockerfile.go`, add it to `docker/build.sh` and to
`frontend/constants/languages.js`.

---

## 🗺️ Roadmap

- [ ] Rate limiting per IP
- [ ] Shareable snippet links
- [ ] A warm container pool to cut cold-start latency
