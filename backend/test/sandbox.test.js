const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

// Put the fake docker CLI ahead of anything real, and shorten timeouts so the
// timeout test does not take 10s. Both must happen before config.js is required.
const FIXTURES = path.join(__dirname, "fixtures")
process.env.PATH = `${FIXTURES}${path.delimiter}${process.env.PATH}`
process.env.RUN_TIMEOUT_MS = "600"
process.env.COMPILE_TIMEOUT_MS = "600"
process.env.MAX_OUTPUT_BYTES = "1024"
// This file tests execution, not throttling: keep the per-IP limit and the
// concurrency gate out of the way. They have their own suite in ratelimit.test.js.
process.env.RATE_LIMIT_MAX = "100000"
process.env.MAX_CONCURRENT_EXECUTIONS = "32"

const app = require("../app")

let server
let baseUrl
let logFile

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server?.close())

function useDocker(mode) {
  logFile = path.join(os.tmpdir(), `fake-docker-${Date.now()}-${Math.random()}.log`)
  process.env.FAKE_DOCKER_MODE = mode
  process.env.FAKE_DOCKER_LOG = logFile
  return () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "")
}

function dockerInvocations() {
  return (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "")
    .split("\n")
    .filter(Boolean)
}

function run(body) {
  return fetch(`${baseUrl}/run-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("runs code and returns stdout", async () => {
  useDocker("ok")
  const res = await run({ language: "python", code: "print('hi')" })
  const data = await res.json()

  assert.equal(res.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.output.trim(), "HELLO")
  assert.equal(data.exitCode, 0)
})

test("every container is started with the hardening flags", async () => {
  const readLog = useDocker("ok")
  await run({ language: "python", code: "print('hi')" })
  const log = readLog()

  for (const flag of [
    "--network none",
    "--memory 256m",
    "--memory-swap 256m",
    "--cpus 0.5",
    "--pids-limit 128",
    "--read-only",
    "--cap-drop ALL",
    "--security-opt no-new-privileges",
    "--user 65534:65534",
    "--rm",
  ]) {
    assert.ok(log.includes(flag), `expected docker run to include \`${flag}\`\nlog: ${log}`)
  }
})

test("only the per-request temp dir is mounted, never the backend source", async () => {
  const readLog = useDocker("ok")
  await run({ language: "python", code: "print('hi')" })
  const log = readLog()

  const mount = log.match(/-v (\S+):\/sandbox/)
  assert.ok(mount, `expected a /sandbox bind mount\nlog: ${log}`)

  const mounted = mount[1]
  assert.ok(
    mounted.startsWith(path.join(os.tmpdir(), "bytecode-")),
    `mount should be a temp dir, got ${mounted}`
  )
  assert.ok(
    !mounted.startsWith(path.resolve(__dirname, "..")),
    `mount must not be inside the backend source tree, got ${mounted}`
  )
})

test("the work directory is deleted after the run", async () => {
  const readLog = useDocker("ok")
  await run({ language: "python", code: "print('hi')" })
  const mounted = readLog().match(/-v (\S+):\/sandbox/)[1]
  assert.equal(fs.existsSync(mounted), false, "temp work dir should be cleaned up")
})

test("concurrent submissions do not see each other's source", async () => {
  useDocker("echo_source")

  const programs = Array.from({ length: 8 }, (_, i) => `print(${i})`)
  const results = await Promise.all(
    programs.map(async (code) => {
      const res = await run({ language: "python", code })
      return (await res.json()).output.trim()
    })
  )

  // Before the rewrite all requests shared one fixed main.py in the backend cwd,
  // so parallel runs returned each other's output.
  assert.deepEqual(results, programs)
})

test("a compile error returns the compiler's real message", async () => {
  useDocker("compile_fail")
  const res = await run({ language: "cpp", code: "int main(){}" })
  const data = await res.json()

  assert.equal(res.status, 200)
  assert.equal(data.ok, false)
  assert.equal(data.stage, "compile")
  assert.match(data.output, /error: expected ';' before '\}' token/)
  assert.doesNotMatch(data.output, /Execution Failed/)
})

test("a runtime error returns stderr, not a generic failure", async () => {
  useDocker("runtime_fail")
  const res = await run({ language: "python", code: "1/0" })
  const data = await res.json()

  assert.equal(data.ok, false)
  assert.equal(data.exitCode, 1)
  assert.match(data.stderr, /ZeroDivisionError/)
  assert.equal(data.stdout.trim(), "partial output")
})

test("a hanging program times out and the container is killed", async () => {
  const readLog = useDocker("hang")
  const started = Date.now()
  const res = await run({ language: "python", code: "while True: pass" })
  const data = await res.json()
  const elapsed = Date.now() - started

  assert.equal(res.status, 200)
  assert.equal(data.timedOut, true)
  assert.match(data.output, /timed out/i)
  assert.ok(elapsed < 5000, `should time out promptly, took ${elapsed}ms`)

  // The docker CLI dying does not stop the container, so the executor must
  // explicitly `docker kill` it. Without this the container leaks forever.
  assert.match(readLog(), /^kill bytecode-[0-9a-f]{16}$/m)
})

test("runaway output is truncated instead of exhausting memory", async () => {
  useDocker("flood")
  const res = await run({ language: "python", code: "while True: print('x')" })
  const data = await res.json()

  assert.equal(data.truncated, true)
  assert.ok(data.stdout.length <= 1024, `stdout was ${data.stdout.length} bytes`)
})

test("validation errors are rejected before any container starts", async () => {
  const readLog = useDocker("ok")
  const res = await run({ language: "ruby", code: "puts 1" })

  assert.equal(res.status, 400)
  assert.equal((await res.json()).stage, "invalid")
  assert.equal(readLog(), "", "no container should have been started")
})

test("health endpoint reports supported languages", async () => {
  const res = await fetch(`${baseUrl}/health`)
  const data = await res.json()
  assert.equal(data.status, "ok")
  assert.deepEqual(data.languages.sort(), ["cpp", "java", "python"])
})

test("a Docker daemon outage is a 503, not the user's program failing", async () => {
  // The stub exits non-zero with the CLI's own connection error on stderr, the
  // way the real docker CLI does when the daemon is down.
  process.env.FAKE_DOCKER_MODE = "daemon_down"
  process.env.FAKE_DOCKER_LOG = ""

  const res = await run({ language: "python", code: "print('hi')" })
  const data = await res.json()

  assert.equal(res.status, 503)
  assert.equal(data.ok, false)
  // The internal socket path must not reach the user's output panel.
  assert.doesNotMatch(data.output, /docker\.sock/)
  assert.match(data.output, /sandbox is unavailable/i)
  // A sandbox fault and a capacity refusal are both 503; `stage` separates them.
  assert.equal(data.stage, "sandbox")
})

test("a missing sandbox image is reported as a sandbox problem", async () => {
  process.env.FAKE_DOCKER_MODE = "no_image"
  process.env.FAKE_DOCKER_LOG = ""

  const res = await run({ language: "python", code: "print('hi')" })
  assert.equal(res.status, 503)
  assert.doesNotMatch((await res.json()).output, /bytecode-python/)
})

test("stdin is delivered to the program", async () => {
  useDocker("echo_stdin")
  const res = await run({ language: "python", code: "print(input())", stdin: "42\n" })
  const data = await res.json()

  assert.equal(res.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.stdout, "42\n")
})

test("stdin reaches the run phase but not the compiler", async () => {
  useDocker("echo_stdin")
  await run({ language: "cpp", code: "int main(){}", stdin: "7\n" })

  const [compile, execute] = dockerInvocations()
  const tokens = (line) => line.split(/\s+/)

  assert.ok(compile.includes("g++"), `first invocation should compile: ${compile}`)
  assert.ok(
    !tokens(compile).includes("--interactive"),
    `compiler should not be given stdin: ${compile}`
  )
  assert.ok(
    tokens(execute).includes("--interactive"),
    `run phase should be given stdin: ${execute}`
  )
})

test("no stdin means the container's stdin stays closed", async () => {
  useDocker("ok")
  await run({ language: "python", code: "print(1)" })

  const [execute] = dockerInvocations()
  assert.ok(
    !execute.split(/\s+/).includes("--interactive"),
    `--interactive should be omitted when there is no input: ${execute}`
  )
})

test("empty stdin is treated as no input", async () => {
  useDocker("ok")
  const res = await run({ language: "python", code: "print(1)", stdin: "" })

  assert.equal(res.status, 200)
  assert.ok(!dockerInvocations()[0].split(/\s+/).includes("--interactive"))
})

test("a program that ignores its input does not fail with EPIPE", async () => {
  useDocker("ignore_stdin")
  const res = await run({ language: "python", code: "print(1)", stdin: "x".repeat(70) })
  const data = await res.json()

  assert.equal(data.ok, true)
  assert.match(data.stdout, /did not read input/)
})

test("oversized stdin is rejected before a container starts", async () => {
  useDocker("ok")
  const res = await run({
    language: "python",
    code: "print(1)",
    stdin: "x".repeat(64 * 1024 + 1),
  })

  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /Input exceeds/)
  assert.deepEqual(dockerInvocations(), [], "no container should have been started")
})

test("non-string stdin is rejected", async () => {
  useDocker("ok")
  const res = await run({ language: "python", code: "print(1)", stdin: 42 })

  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /Input must be a string/)
})
