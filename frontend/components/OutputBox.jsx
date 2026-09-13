"use client"

/**
 * The output panel is a terminal in both themes — the one surface that stays
 * dark, so program output always reads as program output.
 *
 * One presentation per outcome the API can return: previously every result —
 * success, compile error, timeout, throttling — was the same grey text.
 */
const OUTCOMES = {
  ok: { label: "exit 0", tone: "ok" },
  runtime_error: { label: "runtime error", tone: "bad" },
  compile_error: { label: "compile error", tone: "warn" },
  timeout: { label: "timed out", tone: "warn" },
  invalid: { label: "invalid request", tone: "warn" },
  rate_limited: { label: "rate limited", tone: "warn" },
  capacity: { label: "server busy", tone: "warn" },
  sandbox: { label: "sandbox down", tone: "bad" },
  server: { label: "server error", tone: "bad" },
  network: { label: "no connection", tone: "bad" },
}

const TONES = { ok: "var(--ok)", bad: "var(--bad)", warn: "var(--warn)" }

// Outcomes that never reached the program: the message is the whole story.
const MESSAGE_ONLY = ["invalid", "rate_limited", "capacity", "sandbox", "server", "network"]

function Status({ result, isRunning }) {
  if (isRunning) return <span style={{ color: "var(--term-dim)" }}>running…</span>
  if (!result) return <span style={{ color: "var(--term-dim)" }}>idle</span>

  const outcome = OUTCOMES[result.kind] ?? OUTCOMES.server
  const bits = []
  if (result.kind !== "ok" && result.exitCode !== null && result.exitCode !== undefined) {
    bits.push(`exit ${result.exitCode}`)
  }
  if (typeof result.durationMs === "number") bits.push(`${result.durationMs} ms`)

  return (
    <span style={{ color: TONES[outcome.tone] }}>
      {outcome.label}
      {bits.length > 0 && (
        <span style={{ color: "var(--term-dim)" }}> · {bits.join(" · ")}</span>
      )}
    </span>
  )
}

function Body({ result, isRunning }) {
  if (isRunning && !result) return <span style={{ color: "var(--term-dim)" }}>running your code…</span>
  if (!result) return <span style={{ color: "var(--term-dim)" }}>output will appear here.</span>

  if (MESSAGE_ONLY.includes(result.kind)) {
    return <span>{result.output || "No details."}</span>
  }

  const hasStdout = Boolean(result.stdout)
  const hasStderr = Boolean(result.stderr)

  if (!hasStdout && !hasStderr) {
    return (
      <span style={{ color: "var(--term-dim)" }}>
        {result.output || "the program produced no output."}
      </span>
    )
  }

  return (
    <>
      {hasStdout && <span>{result.stdout}</span>}
      {hasStderr && (
        // A program that exited 0 but wrote to stderr produced warnings, not errors.
        <span style={{ color: result.ok ? "var(--warn)" : "var(--bad)" }}>
          {hasStdout ? "\n" : ""}
          {result.stderr}
        </span>
      )}
    </>
  )
}

export default function OutputBox({ result, isRunning = false }) {
  return (
    <div
      className="flex min-h-0 flex-grow flex-col"
      style={{
        background: "var(--term-bg)",
        border: "var(--border-w) solid var(--line)",
        boxShadow: "var(--offset) var(--offset) 0 var(--shadow)",
      }}
    >
      <div
        className="blk-head"
        style={{ color: "var(--term-fg)", borderBottomColor: "var(--accent)" }}
      >
        <span>stdout</span>
        <span className="mono" style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
          <Status result={result} isRunning={isRunning} />
        </span>
      </div>

      <div className="flex-grow overflow-auto p-4" style={{ minHeight: 170 }}>
        <pre
          className="mono text-[13.5px] leading-[25px] whitespace-pre-wrap break-words"
          style={{ margin: 0, color: "var(--term-fg)" }}
        >
          <Body result={result} isRunning={isRunning} />
        </pre>
      </div>

      {/* Footnotes for things the user would otherwise have no way to learn. */}
      {result?.truncated && (
        <div className="mono px-4 py-1.5 text-[11px]" style={{ borderTop: "var(--border-w) solid var(--warn)", color: "var(--warn)" }}>
          output truncated — the program printed more than the limit
        </div>
      )}
      {result?.kind === "timeout" && (
        <div className="mono px-4 py-1.5 text-[11px]" style={{ borderTop: "var(--border-w) solid var(--warn)", color: "var(--warn)" }}>
          stopped — check for an infinite loop, or input it expected but never got
        </div>
      )}
    </div>
  )
}
