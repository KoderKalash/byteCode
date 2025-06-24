"use client"

import { Play, Loader2 } from "lucide-react"
import { useState } from "react"

export default function RunButton({ onClick }) {
  const [isRunning, setIsRunning] = useState(false)

  const handleClick = async () => {
    setIsRunning(true)
    try {
      await onClick()
    } finally {
      //loading(running)
      setTimeout(() => setIsRunning(false), 500)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isRunning}
      className="relative inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
    >
      {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
      <span>{isRunning ? "Running..." : "Run Code"}</span>

      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 hover:opacity-20 transition-opacity duration-200 -z-10 blur-sm"></div>
    </button>
  )
}
