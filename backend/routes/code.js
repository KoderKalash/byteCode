const express = require("express")

const executeCode = require("../executor/executeCode")
const ExecutionError = require("../executor/ExecutionError")
const validateInput = require("../utils/validateInput")

const router = express.Router()

router.post("/", async (req, res) => {
  const { language, code, stdin } = req.body || {}

  const invalid = validateInput(language, code, stdin)
  if (invalid) return res.status(400).json({ ok: false, error: invalid, output: invalid })

  try {
    const result = await executeCode(language, code, stdin)
    const failed = result.exitCode !== 0

    return res.json({
      ok: !failed,
      // `output` is what the editor prints: stdout on success, diagnostics on failure.
      output: failed ? result.stderr.trim() || result.stdout : result.stdout,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      stage: result.stage,
      timedOut: result.timedOut,
      truncated: result.truncated,
      durationMs: result.durationMs,
    })
  } catch (err) {
    if (err instanceof ExecutionError) {
      // A compile error or a timeout is a valid answer to a valid request, not a
      // server fault — return 200 and let the UI render the real message.
      if (err.stage === "compile" || err.stage === "run") {
        return res.json({
          ok: false,
          output: err.message,
          stdout: "",
          stderr: err.message,
          exitCode: err.exitCode,
          stage: err.stage,
          timedOut: err.timedOut,
          truncated: false,
        })
      }

      // At capacity: a real answer, and the client should retry.
      if (err.stage === "capacity") {
        res.set("Retry-After", "5")
        return res.status(503).json({ ok: false, error: err.message, output: err.message })
      }

      // Sandbox problems are ours.
      console.error(`[API] sandbox error: ${err.message}`)
      return res.status(503).json({ ok: false, error: err.message, output: err.message })
    }

    console.error("[API] unexpected error:", err)
    const message = "Internal server error while running your code."
    return res.status(500).json({ ok: false, error: message, output: message })
  }
})

module.exports = router
