"use client"

import { useState, useEffect } from "react"
import { Sun, Moon } from "lucide-react"

export default function ThemeToggle() {
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialDark = savedTheme ? savedTheme === "dark" : prefersDark

    setDark(initialDark)
    updateHtmlClass(initialDark)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    updateHtmlClass(dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  function updateHtmlClass(isDark) {
    const html = document.documentElement
    html.classList.remove("dark", "light")
    html.classList.add(isDark ? "dark" : "light")
  }

  if (!mounted) return null

  return (
    <div className="relative inline-flex items-center">
      {/* Theme Toggle Switch */}
      <button
        onClick={() => setDark(!dark)}
        className="w-full sm:w-auto relative flex flex-col sm:flex-row items-center sm:gap-3 gap-2 px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        {/* Icon Container */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 dark:from-amber-400 dark:to-orange-500 shadow-md transition-all duration-300 group-hover:scale-110">
          {dark ? (
            <Moon className="h-5 w-5 text-white transition-transform duration-300 group-hover:rotate-12" />
          ) : (
            <Sun className="h-5 w-5 text-white transition-transform duration-300 group-hover:rotate-180" />
          )}
        </div>

        {/* Text and Status */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors duration-300">
            {dark ? "Dark Mode" : "Light Mode"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
            Switch to {dark ? "light" : "dark"} theme
          </span>
        </div>

        {/* Animated Background Gradient */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/20 to-pink-400/20 dark:from-amber-400/20 dark:to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
      </button>

      {/* Theme Indicator Dot */}
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-sm animate-pulse" />
    </div>
  )
}
