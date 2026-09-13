const express = require("express")

const config = require("../config")
const { store } = require("../snippets/store")
const validateInput = require("../utils/validateInput")
const { snippetLimiter } = require("../middleware/rateLimit")

const router = express.Router()

// Ids are base64url from the store; reject anything else before touching the
// database rather than passing arbitrary path segments to a query.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// Creating a snippet is an anonymous write to disk, so it carries the strict
// limiter. Reading one is a primary-key lookup and is deliberately NOT limited:
// throttling reads would break the one thing a share link is for — being opened
// by many people at once.
router.post("/", snippetLimiter, (req, res) => {
  const { language, code, stdin } = req.body || {}

  const invalid = validateInput(language, code, stdin)
  if (invalid) {
    return res.status(400).json({ ok: false, error: invalid, stage: "invalid" })
  }

  try {
    const { id, expiresAt } = store.create({ language, code, stdin: stdin ?? "" })
    return res.status(201).json({ ok: true, id, expiresAt })
  } catch (err) {
    console.error("[SNIPPETS] create failed:", err.message)
    const message = "Could not save the snippet."
    return res.status(500).json({ ok: false, error: message, stage: "server" })
  }
})

router.get("/:id", (req, res) => {
  const { id } = req.params

  if (!ID_PATTERN.test(id)) {
    return res.status(400).json({ ok: false, error: "Malformed snippet id", stage: "invalid" })
  }

  let snippet
  try {
    snippet = store.get(id)
  } catch (err) {
    console.error("[SNIPPETS] read failed:", err.message)
    return res.status(500).json({ ok: false, error: "Could not read the snippet.", stage: "server" })
  }

  if (!snippet) {
    // Expired and never-existed are deliberately the same answer: a 410 on
    // expiry would confirm that an id was once real.
    return res.status(404).json({
      ok: false,
      error: `That snippet does not exist, or expired (snippets last ${config.snippets.ttlDays} days).`,
      stage: "invalid",
    })
  }

  return res.json({ ok: true, ...snippet })
})

module.exports = router
