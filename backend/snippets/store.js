const { DatabaseSync } = require("node:sqlite")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const config = require("../config")

/**
 * Snippet storage.
 *
 * SQLite via node's built-in `node:sqlite`: no new dependency, no native module
 * to compile on the VPS, and no extra service to run. The file lives in the
 * service's state directory so it survives restarts and redeploys.
 *
 * Snippets are unlisted, not private: anyone with the link can read one. Ids are
 * therefore random rather than sequential — a counter would let anyone walk the
 * whole table.
 */
class SnippetStore {
  constructor({ dbPath, ttlDays, idBytes }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })

    this.db = new DatabaseSync(dbPath)
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000
    this.idBytes = idBytes

    // Wait for a held lock instead of failing on it. More than one process can
    // legitimately have this file open — a restart overlapping the old process,
    // a maintenance script, a `sqlite3` session — and without a busy handler
    // SQLite returns SQLITE_BUSY immediately. Switching journal mode needs a
    // brief exclusive lock, so that failure lands on the line below, at startup.
    this.db.exec("PRAGMA busy_timeout = 5000")

    // WAL keeps reads from blocking on the writer, which matters because a
    // snippet read sits in front of the editor loading.
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec("PRAGMA synchronous = NORMAL")
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snippets (
        id         TEXT PRIMARY KEY,
        language   TEXT NOT NULL,
        code       TEXT NOT NULL,
        stdin      TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `)
    // Expiry sweeps scan by expires_at; without this they are a full table scan.
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_snippets_expires ON snippets (expires_at)")

    this.insert = this.db.prepare(
      "INSERT INTO snippets (id, language, code, stdin, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    this.select = this.db.prepare(
      "SELECT id, language, code, stdin, created_at, expires_at FROM snippets WHERE id = ? AND expires_at > ?"
    )
    this.deleteExpired = this.db.prepare("DELETE FROM snippets WHERE expires_at <= ?")
    this.countAll = this.db.prepare("SELECT COUNT(*) AS n FROM snippets")
  }

  /** URL-safe, unguessable, and short enough to paste into chat. */
  #newId() {
    return crypto.randomBytes(this.idBytes).toString("base64url")
  }

  create({ language, code, stdin = "" }) {
    const now = Date.now()
    const expiresAt = now + this.ttlMs

    // A collision is vanishingly unlikely at 9 random bytes, but a silent
    // overwrite would hand one user's link to another user's code, so retry
    // rather than trusting the odds.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.#newId()
      try {
        this.insert.run(id, language, code, stdin, now, expiresAt)
        return { id, createdAt: now, expiresAt }
      } catch (err) {
        if (!/UNIQUE constraint failed/i.test(err.message)) throw err
      }
    }
    throw new Error("Could not allocate a snippet id")
  }

  get(id) {
    const row = this.select.get(id, Date.now())
    if (!row) return null

    return {
      id: row.id,
      language: row.language,
      code: row.code,
      stdin: row.stdin,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  }

  /** Expired rows are invisible to `get` immediately; this reclaims the disk. */
  purgeExpired() {
    return this.deleteExpired.run(Date.now()).changes
  }

  count() {
    return this.countAll.get().n
  }

  close() {
    this.db.close()
  }
}

const store = new SnippetStore(config.snippets)

module.exports = { SnippetStore, store }
