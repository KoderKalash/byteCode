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
  // Every error response from this API carries a `stage`, so a client can render
  // the right state without pattern-matching on prose.
  message: {
    ok: false,
    error: "Too many requests. Please slow down.",
    output: "Too many requests. Please slow down.",
    stage: "rate_limited",
  },
})

/**
 * Per-IP limit for creating snippets.
 *
 * Far stricter than the run limit and over a much longer window: running code
 * costs CPU for ten seconds, but creating a snippet costs disk forever (well,
 * until it expires). This is the budget that stops the share endpoint being
 * used as free storage.
 */
const snippetLimiter = rateLimit({
  windowMs: config.snippets.rateLimitWindowMs,
  limit: config.snippets.rateLimitMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many snippets created. Please try again later.",
    stage: "rate_limited",
  },
})

module.exports = { runCodeLimiter, snippetLimiter }
