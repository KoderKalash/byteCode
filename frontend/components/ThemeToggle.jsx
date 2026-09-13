"use client"

import { useState, useEffect } from "react"

function updateHtmlClass(isDark) {
  const html = document.documentElement
  html.classList.remove("dark", "light")
  html.classList.add(isDark ? "dark" : "light")
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initial = saved ? saved === "dark" : prefersDark

    setDark(initial)
    updateHtmlClass(initial)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    updateHtmlClass(dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark, mounted])

  // Reserve the space so the header does not jump once the theme is known.
  if (!mounted) return <div style={{ width: 48 }} aria-hidden="true" />

  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="blk flex items-center justify-center px-4"
      style={{ boxShadow: "none", color: "var(--ink)", alignSelf: "stretch" }}
    >
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
