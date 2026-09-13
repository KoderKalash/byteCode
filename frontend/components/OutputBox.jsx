"use client"

import { Terminal, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, Hourglass } from "lucide-react"

/**
 * One presentation per outcome the API can return. Previously every result —
 * success, compile error, timeout, throttling — was the same grey text in a
 * <pre>, so the panel could not tell the user what had actually happened.
 */
const OUTCOMES = {
  ok: { label: "Success", tone: "ok", Icon: CheckCircle2 },
  runtime_error: { label: "Runtime error", tone: "bad", Icon: XCircle },
  compile_error: { label: "Compile error", tone: "warn", Icon: AlertTriangle },
  timeout: { label: "Timed out", tone: "warn", Icon: Clock },
  invalid: { label: "Invalid request", tone: "warn", Icon: AlertTriangle },
  rate_limited: { label: "Too many requests", tone: "warn", Icon: Hourglass },
  capacity: { label: "Server busy", tone: "warn", Icon: Hourglass },
  sandbox: { label: "Sandbox unavailable", tone: "bad", Icon: XCircle },
  server: { label: "Server error", tone: "bad", Icon: XCircle },
  network: { label: "Can't reach the API", tone: "bad", Icon: XCircle },
}

const TONES = {
  ok: "text-emerald-400",
  bad: "text-red-400",
  warn: "text-amber-400",
}

function StatusBar({ result, isRunning }) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Running…</span>
      </div>
    )
  }

  if (!result) return <span className="text-xs text-gray-500">Idle</span>

  const outcome = OUTCOMES[result.kind] ?? OUTCOMES.server
  const { Icon } = outcome
  const tone = TONES[outcome.tone]

  // Only meaningful for a program that actually ran.
  const meta = []
  if (result.exitCode !== null && result.exitCode !== undefined) {
    meta.push(`exit ${result.exitCode}`)
  }
  if (typeof result.durationMs === "number") meta.push(`${result.durationMs} ms`)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={`flex items-center gap-1.5 font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {outcome.label}
      </span>
      {meta.length > 0 && <span className="text-gray-500">· {meta.join(" · ")}</span>}
    </div>
  )
}

function Body({ result, isRunning }) {
  if (isRunning && !result) {
    return <span className="text-gray-500 italic">Running your code…</span>
  }

  if (!result) {
    return <span className="text-gray-500 italic">Output will appear here.</span>
  }

  // For outcomes that never reached the program, the message is the whole story.
  const messageOnly = ["invalid", "rate_limited", "capacity", "sandbox", "server", "network"]
  if (messageOnly.includes(result.kind)) {
    return <span className="text-gray-300">{result.output || "No details."}</span>
  }

  const hasStdout = Boolean(result.stdout)
  const hasStderr = Boolean(result.stderr)

  if (!hasStdout && !hasStderr) {
    return (
      <span className="text-gray-500 italic">
        {result.output || "The program produced no output."}
      </span>
    )
  }

  return (
    <>
      {hasStdout && <span className="text-gray-100">{result.stdout}</span>}
      {hasStderr && (
        <span className={result.ok ? "text-amber-300" : "text-red-300"}>
          {hasStdout ? "\n" : ""}
          {result.stderr}
        </span>
      )}
    </>
  )
}

export default function OutputBox({ result, isRunning = false }) {
  return (
    <div className="relative">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-300">Output</span>
          <div className="ml-auto min-w-0">
            <StatusBar result={result} isRunning={isRunning} />
          </div>
        </div>

        {/* Output */}
        <div className="p-4 h-48 overflow-auto">
          <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
            <Body result={result} isRunning={isRunning} />
          </pre>
        </div>

        {/* Footnotes the user would otherwise have no way to know about. */}
        {result?.truncated && (
          <div className="bg-gray-800/80 px-4 py-1.5 border-t border-gray-700 text-xs text-amber-400">
            Output was truncated — the program printed more than the limit.
          </div>
        )}
        {result?.kind === "timeout" && (
          <div className="bg-gray-800/80 px-4 py-1.5 border-t border-gray-700 text-xs text-amber-400">
            The program was stopped. Check for an infinite loop, or for input it
            expected but never received.
          </div>
        )}
      </div>
    </div>
  )
}
