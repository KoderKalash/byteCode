"use client"

export default function RunButton({ onClick, isRunning = false, disabled = false }) {
  const inactive = isRunning || disabled

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactive}
      aria-busy={isRunning}
      title={disabled && !isRunning ? "Write some code first" : undefined}
      className="flex items-center gap-2.5 px-6 py-2.5 text-[13.5px] font-bold uppercase tracking-[0.04em]"
      style={{
        background: inactive ? "var(--panel)" : "var(--accent)",
        color: inactive ? "var(--ink-faint)" : "var(--accent-ink)",
        border: "var(--border-w) solid var(--line)",
        boxShadow: inactive ? "none" : "3px 3px 0 var(--shadow)",
        transform: inactive ? "translate(3px, 3px)" : "none",
        cursor: inactive ? "not-allowed" : "pointer",
        transition: "transform 80ms linear, box-shadow 80ms linear",
      }}
    >
      {isRunning ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: "spin 700ms linear infinite" }}>
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5 3 19 12 5 21" />
        </svg>
      )}
      {isRunning ? "Running" : "Run"}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
}
