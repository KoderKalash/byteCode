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
  res.json({ status: "ok", languages: languages.ids, executions: gate.stats })
})

app.use("/run-code", runCodeLimiter, codeRoutes)

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }))

// Express 5 forwards async route errors here; without this a thrown error
// would hang the request instead of answering it.
app.use((err, req, res, next) => {
  console.error("[APP] unhandled error:", err)
  if (res.headersSent) return next(err)
  res.status(500).json({ ok: false, error: "Internal server error" })
})

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ByteCode API listening on http://localhost:${config.port}`)
    console.log(`Languages: ${languages.ids.join(", ")}`)
  })
}

module.exports = app
