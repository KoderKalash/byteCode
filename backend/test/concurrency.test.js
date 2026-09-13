const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

// A slow stub so executions genuinely overlap, a concurrency cap of 1 with a
// queue of 1, and the per-IP limiter turned off so it is the *gate* being
// observed here and not the rate limit.
//
// config.js reads process.env when it is first required, so every assignment
// below must happen before the requires underneath them.
const FIXTURES = path.join(__dirname, "fixtures")
process.env.PATH = `${FIXTURES}${path.delimiter}${process.env.PATH}`
process.env.FAKE_DOCKER_MODE = "slow"
process.env.RATE_LIMIT_MAX = "100000"
process.env.MAX_CONCURRENT_EXECUTIONS = "1"
process.env.MAX_QUEUED_EXECUTIONS = "1"
process.env.QUEUE_TIMEOUT_MS = "10000"
process.env.RUN_TIMEOUT_MS = "8000"

const { ExecutionGate } = require("../executor/concurrency")
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

// ------------------------------------------------------------ the gate alone

test("the gate admits up to max, queues up to maxQueue, then refuses", async () => {
  const g = new ExecutionGate({ max: 2, maxQueue: 2, queueTimeoutMs: 5000 })

  const first = await g.acquire()
  const second = await g.acquire()
  assert.deepEqual(g.stats, { active: 2, queued: 0, max: 2 })

  const third = g.acquire()
  const fourth = g.acquire()
  assert.deepEqual(g.stats, { active: 2, queued: 2, max: 2 })

  await assert.rejects(() => g.acquire(), /at capacity/i)

  // Releasing hands the slot to the next waiter without changing `active`.
  first()
  const thirdRelease = await third
  assert.equal(g.stats.active, 2)
  assert.equal(g.stats.queued, 1)

  second()
  thirdRelease()
  ;(await fourth)()
  assert.deepEqual(g.stats, { active: 0, queued: 0, max: 2 })
})

test("a waiter that times out is dropped and answered, not left hanging", async () => {
  const g = new ExecutionGate({ max: 1, maxQueue: 4, queueTimeoutMs: 120 })
  const release = await g.acquire()

  await assert.rejects(() => g.acquire(), /Timed out waiting/i)
  // The abandoned waiter must not stay in the queue holding a slot.
  assert.equal(g.stats.queued, 0)

  release()
  assert.deepEqual(g.stats, { active: 0, queued: 0, max: 1 })
})

test("releasing more slots than were taken cannot drive active negative", async () => {
  const g = new ExecutionGate({ max: 2, maxQueue: 2, queueTimeoutMs: 1000 })
  const release = await g.acquire()
  release()
  assert.equal(g.stats.active, 0)
})

// ------------------------------------------------------------- over the wire

test("saturating the gate returns 503 with Retry-After, not a queue that grows", async () => {
  // max 1 + queue 1 = 2 admitted; the rest must be refused immediately.
  const responses = await Promise.all([run(), run(), run(), run()])
  const statuses = responses.map((r) => r.status)

  const ok = statuses.filter((s) => s === 200).length
  const refused = statuses.filter((s) => s === 503).length

  assert.equal(ok, 2, `expected 2 admitted, got statuses ${statuses.join(",")}`)
  assert.equal(refused, 2, `expected 2 refused, got statuses ${statuses.join(",")}`)

  const refusal = responses.find((r) => r.status === 503)
  assert.equal(refusal.headers.get("retry-after"), "5")

  const body = await refusal.json()
  assert.equal(body.ok, false)
  assert.match(body.error, /at capacity/i)
  // Distinguishable from a sandbox fault, which is also a 503.
  assert.equal(body.stage, "capacity")
})

test("the gate drains back to idle once work completes", async () => {
  const { executions } = await fetch(`${baseUrl}/health`).then((r) => r.json())
  assert.equal(executions.active, 0, "no executions should be in flight")
  assert.equal(executions.queued, 0, "nothing should be left queued")
})
