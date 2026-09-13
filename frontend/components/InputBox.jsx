"use client"

export default function InputBox({ stdin, setStdin }) {
  const lines = stdin ? stdin.split("\n").length : 0

  return (
    <div className="blk flex flex-col">
      <div className="blk-head" style={{ color: "var(--ink)" }}>
        <span>stdin</span>
        <span className="mono" style={{ fontWeight: 400, color: "var(--ink-faint)", letterSpacing: 0, textTransform: "none" }}>
          {stdin ? `${lines} ${lines === 1 ? "line" : "lines"}` : "optional"}
        </span>
      </div>

      <textarea
        value={stdin}
        onChange={(event) => setStdin(event.target.value)}
        spellCheck={false}
        placeholder="Input passed to your program…"
        aria-label="Standard input for your program"
        className="mono w-full resize-y bg-transparent p-4 text-[13.5px] leading-[25px] focus:outline-none"
        style={{ color: "var(--ink)", height: 118 }}
      />
    </div>
  )
}
