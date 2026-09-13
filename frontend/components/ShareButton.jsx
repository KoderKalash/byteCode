"use client"

import { useEffect, useState } from "react"

/**
 * Saves the current editor contents and puts the link on the clipboard.
 *
 * The URL is updated either way — clipboard access needs a secure context and
 * the viewer's permission, so when it is refused the address bar is still the
 * shareable link rather than a dead end.
 */
export default function ShareButton({ onShare, disabled = false }) {
  const [state, setState] = useState("idle") // idle | saving | copied | shown | failed
  const [error, setError] = useState("")

  // Let the confirmation fade back to the normal label.
  useEffect(() => {
    if (state !== "copied" && state !== "shown") return undefined
    const timer = setTimeout(() => setState("idle"), 4000)
    return () => clearTimeout(timer)
  }, [state])

  const handleClick = async () => {
    setState("saving")
    setError("")

    const result = await onShare()
    if (!result.ok) {
      setError(result.error)
      setState("failed")
      return
    }

    try {
      await navigator.clipboard.writeText(result.url)
      setState("copied")
    } catch {
      // Refused or unavailable (http:// origin, denied permission). The URL bar
      // already carries the link, so say that rather than claiming failure.
      setState("shown")
    }
  }

  const label = {
    idle: "Share",
    saving: "Saving…",
    copied: "Link copied",
    shown: "Link in address bar",
    failed: "Failed",
  }[state]

  const inactive = disabled || state === "saving"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={inactive}
        title={disabled ? "Write some code first" : "Save this snippet and copy a link"}
        className="mono flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.06em]"
        style={{
          background: "transparent",
          color: inactive ? "var(--ink-faint)" : "var(--ink)",
          border: "var(--border-w) solid var(--line)",
          boxShadow: inactive ? "none" : "3px 3px 0 var(--shadow)",
          transform: inactive ? "translate(3px, 3px)" : "none",
          cursor: inactive ? "not-allowed" : "pointer",
          transition: "transform 80ms linear, box-shadow 80ms linear",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        {label}
      </button>

      {state === "failed" && error ? (
        <span className="mono text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
