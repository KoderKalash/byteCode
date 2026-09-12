const { rateLimit } = require("express-rate-limit")

const config = require("../config")

/**
 * Per-IP request limit for /run-code.
 *
 * This bounds how often a client may ask. It deliberately does not bound how
 * expensive those requests are at once — see executor/concurrency.js for that.
 */
const runCodeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: "draft-7", // RateLimit / RateLimit-Policy
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many requests. Please slow down.",
    output: "Too many requests. Please slow down.",
  },
})

module.exports = { runCodeLimiter }
