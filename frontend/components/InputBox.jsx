"use client"

import { ArrowDownToLine } from "lucide-react"

export default function InputBox({ stdin, setStdin }) {
  const lines = stdin ? stdin.split("\n").length : 0

  return (
    <div className="relative">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Input (stdin)</span>
          {stdin ? (
            <span className="ml-auto text-xs text-gray-500">
              {lines} {lines === 1 ? "line" : "lines"}
            </span>
          ) : null}
        </div>

        {/* Editable input */}
        <textarea
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
          spellCheck={false}
          placeholder="Input passed to your program's stdin..."
          aria-label="Standard input for your program"
          className="w-full h-28 resize-y bg-gray-900 p-4 text-sm text-gray-100 font-mono leading-relaxed placeholder:text-gray-500 placeholder:italic focus:outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500/50"
        />
      </div>
    </div>
  )
}
