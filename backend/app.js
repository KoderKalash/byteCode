const express = require("express")
const cors = require("cors")

const config = require("./config")
const languages = require("./executor/language")
const { gate } = require("./executor/concurrency")
const { runCodeLimiter } = require("./middleware/rateLimit")
const codeRoutes = require("./routes/code")

const app = express()

// Behind a proxy, req.ip is the proxy's address unless Express is told how many
// hops to trust — which would rate-limit every client as if they were one. Only
// a specific hop count is honoured: `true` would let a client spoof
// X-Forwarded-For and mint a fresh rate-limit bucket per request.
if (config.rateLimit.trustProxyHops > 0) {
  app.set("trust proxy", config.rateLimit.trustProxyHops)
}

app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
  })
)

// Reject oversized bodies before they reach the executor.
app.use(express.json({ limit: "1mb" }))

// Deliberately not rate limited, so monitoring never trips the limiter.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    languages: languages.ids,
    executions: gate.stats,
    snippets: config.snippets.enabled,
  })
})

app.use("/run-code", runCodeLimiter, codeRoutes)

if (config.snippets.enabled) {
  // Required so the module (and its database file) is only touched when the
  // feature is on — a deployment that disables snippets should not create one.
  app.use("/snippets", require("./routes/snippets"))
}

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }))

// Express 5 forwards async route errors here; without this a thrown error
// would hang the request instead of answering it.
app.use((err, req, res, next) => {
  console.error("[APP] unhandled error:", err)
  if (res.headersSent) return next(err)
  res.status(500).json({ ok: false, error: "Internal server error" })
})

if (require.main === module) {
  if (config.snippets.enabled) {
    const { store } = require("./snippets/store")

    const sweep = () => {
      const removed = store.purgeExpired()
      if (removed > 0) console.log(`[SNIPPETS] purged ${removed} expired`)
    }

    sweep()
    // unref so the timer never holds the process open on shutdown.
    setInterval(sweep, config.snippets.purgeIntervalMs).unref()
  }

  app.listen(config.port, () => {
    console.log(`ByteCode API listening on http://localhost:${config.port}`)
    console.log(`Languages: ${languages.ids.join(", ")}`)
    if (config.snippets.enabled) {
      console.log(`Snippets: on, expiring after ${config.snippets.ttlDays} days`)
    }
  })
}

module.exports = app
