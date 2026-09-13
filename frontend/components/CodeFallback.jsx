"use client"

/**
 * Shown when Monaco cannot load at all.
 *
 * A code editor that fails should degrade to a plain textarea, not to a dead
 * page: the user can still write, run and read output. Syntax highlighting is
 * the only thing lost.
 */
export default function CodeFallback({ code, setCode, language }) {
  return (
    <div className="flex h-full flex-col">
      <div
        className="mono px-4 py-2 text-[11.5px]"
        style={{ background: "var(--warn)", color: "#121212", borderBottom: "var(--border-w) solid var(--line)" }}
      >
        editor failed to load — falling back to a plain text box
      </div>
      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        aria-label={`Source code (${language})`}
        className="mono w-full flex-grow resize-none bg-transparent p-4 text-[13.5px] leading-[25px] focus:outline-none"
        style={{ color: "var(--ink)" }}
      />
    </div>
  )
}
