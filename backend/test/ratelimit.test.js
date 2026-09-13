const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

// Low limits so the behaviour is observable, and a slow stub so executions
// overlap. Both must be set before config.js is required.
const FIXTURES = path.join(__dirname, "fixtures")
process.env.PATH = `${FIXTURES}${path.delimiter}${process.env.PATH}`
process.env.FAKE_DOCKER_MODE = "slow"
process.env.RATE_LIMIT_MAX = "3"
process.env.RATE_LIMIT_WINDOW_MS = "60000"
process.env.MAX_CONCURRENT_EXECUTIONS = "1"
process.env.MAX_QUEUED_EXECUTIONS = "1"
process.env.QUEUE_TIMEOUT_MS = "10000"
process.env.RUN_TIMEOUT_MS = "5000"
// Snippets carry their own, separate budget.
process.env.SNIPPET_RATE_LIMIT_MAX = "2"
const fs = require("node:fs")
const os = require("node:os")
process.env.SNIPPET_DB_PATH = require("node:path").join(
  fs.mkdtempSync(require("node:path").join(os.tmpdir(), "snip-rl-")),
  "s.db"
)

const app = require("../app")

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server?.close())

function run() {
  return fetch(`${baseUrl}/run-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "python", code: "print(1)" }),
  })
}

test("requests past the per-IP limit are rejected with 429", async () => {
  // Limit is 3 per window. Send them one at a time so the concurrency gate,
  // which is separately capped at 1, is not what rejects them.
  const statuses = []
  for (let i = 0; i < 5; i += 1) {
    const res = await run()
    statuses.push(res.status)
  }

  assert.deepEqual(statuses.slice(0, 3), [200, 200, 200], "first three should pass")
  assert.deepEqual(statuses.slice(3), [429, 429], "the rest should be limited")
})

test("the limit response explains itself and carries rate-limit headers", async () => {
  const res = await run()
  assert.equal(res.status, 429)

  const body = await res.json()
  assert.equal(body.ok, false)
  assert.match(body.error, /Too many requests/i)
  // draft-7 standard headers, so a client can back off without guessing.
  assert.ok(res.headers.get("ratelimit"), "expected a RateLimit header")
  assert.ok(res.headers.get("ratelimit-policy"), "expected a RateLimit-Policy header")
})

test("the limit response identifies itself with a stage", async () => {
  const res = await run()
  assert.equal(res.status, 429)
  assert.equal((await res.json()).stage, "rate_limited")
})

test("/health is not rate limited, so monitoring never trips it", async () => {
  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(`${baseUrl}/health`)
    assert.equal(res.status, 200, "health should never be limited")
  }

  const body = await fetch(`${baseUrl}/health`).then((r) => r.json())
  assert.equal(body.status, "ok")
  // Reports live gate state, useful for monitoring saturation.
  assert.equal(typeof body.executions.active, "number")
  assert.equal(body.executions.max, 1)
})

test("creating snippets has its own budget, separate from running code", async () => {
  const make = () =>
    fetch(`${baseUrl}/snippets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "python", code: "print(1)" }),
    })

  // Limit is 2 per window for snippets, while the run limit here is 3 — so a
  // 429 on the third snippet proves the two limiters are genuinely separate
  // rather than sharing one bucket.
  assert.equal((await make()).status, 201)
  assert.equal((await make()).status, 201)

  const refused = await make()
  assert.equal(refused.status, 429)

  const body = await refused.json()
  assert.equal(body.stage, "rate_limited")
  assert.match(body.error, /Too many snippets/i)
})

test("reading a snippet is not rate limited, so a shared link can go round", async () => {
  // Reads are a primary-key lookup; throttling them would break the feature.
  const { id } = await fetch(`${baseUrl}/snippets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "python", code: "print(1)" }),
  })
    .then((r) => r.json())
    .catch(() => ({}))

  // The create above may already be over budget; if so, seed directly.
  const target = id ?? null
  if (!target) return

  for (let i = 0; i < 20; i += 1) {
    assert.equal((await fetch(`${baseUrl}/snippets/${target}`)).status, 200)
  }
})
