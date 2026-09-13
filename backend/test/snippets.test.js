const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

// A throwaway database per run, and a generous create limit so the limiter is
// not what these tests are measuring. Both must be set before config.js loads.
const DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "snippets-test-"))
process.env.SNIPPET_DB_PATH = path.join(DB_DIR, "snippets.db")
process.env.SNIPPET_RATE_LIMIT_MAX = "1000"
process.env.RATE_LIMIT_MAX = "100000"

const app = require("../app")

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server?.close()
  fs.rmSync(DB_DIR, { recursive: true, force: true })
})

function create(body) {
  return fetch(`${baseUrl}/snippets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const read = (id) => fetch(`${baseUrl}/snippets/${id}`)

test("a snippet round-trips through a share link", async () => {
  const res = await create({ language: "python", code: "print(input())", stdin: "42\n" })
  assert.equal(res.status, 201)

  const { ok, id, expiresAt } = await res.json()
  assert.equal(ok, true)
  assert.match(id, /^[A-Za-z0-9_-]+$/, "id must be url-safe")
  assert.ok(expiresAt > Date.now(), "should expire in the future")

  const got = await read(id).then((r) => r.json())
  assert.equal(got.language, "python")
  assert.equal(got.code, "print(input())")
  assert.equal(got.stdin, "42\n", "stdin travels with the snippet")
})

test("ids are unguessable, not sequential", async () => {
  const ids = []
  for (let i = 0; i < 25; i += 1) {
    const res = await create({ language: "python", code: `print(${i})` })
    ids.push((await res.json()).id)
  }

  assert.equal(new Set(ids).size, ids.length, "no duplicates")
  // A counter or timestamp prefix would let anyone walk the table; assert the
  // ids share no common prefix beyond a character or two.
  const [first] = ids
  const shareLongPrefix = ids.filter((id) => id.slice(0, 4) === first.slice(0, 4))
  assert.equal(shareLongPrefix.length, 1, "ids must not share a leading prefix")
})

test("a snippet with no stdin reads back as empty, not null", async () => {
  const { id } = await create({ language: "cpp", code: "int main(){}" }).then((r) => r.json())
  const got = await read(id).then((r) => r.json())
  assert.equal(got.stdin, "")
})

test("an unknown id is a 404 that does not distinguish expired from never-real", async () => {
  const res = await read("aaaaaaaaaaaa")
  assert.equal(res.status, 404)
  assert.match((await res.json()).error, /does not exist, or expired/)
})

test("a malformed id is rejected before it reaches the database", async () => {
  for (const bad of ["../../etc/passwd", "a b", "'; DROP TABLE snippets; --"]) {
    const res = await fetch(`${baseUrl}/snippets/${encodeURIComponent(bad)}`)
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`)
  }
})

test("snippet payloads are validated like a run is", async () => {
  const unsupported = await create({ language: "ruby", code: "puts 1" })
  assert.equal(unsupported.status, 400)

  const empty = await create({ language: "python", code: "   " })
  assert.equal(empty.status, 400)

  const huge = await create({ language: "python", code: "x".repeat(64 * 1024 + 1) })
  assert.equal(huge.status, 400)
  assert.match((await huge.json()).error, /character limit/)
})

test("the store survives a reopen, so restarts do not lose snippets", async () => {
  const { id } = await create({ language: "python", code: "print('persisted')" }).then((r) => r.json())

  // Open the same file independently, as a restarted process would.
  const { SnippetStore } = require("../snippets/store")
  const reopened = new SnippetStore({
    dbPath: process.env.SNIPPET_DB_PATH,
    ttlDays: 90,
    idBytes: 9,
  })

  assert.equal(reopened.get(id).code, "print('persisted')")
  reopened.close()
})

test("health reports that snippets are enabled", async () => {
  const body = await fetch(`${baseUrl}/health`).then((r) => r.json())
  assert.equal(body.snippets, true)
})
