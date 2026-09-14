"use client"

import { useEffect, useState } from "react"

/**
 * Tracks the `dark` class that ThemeToggle writes onto <html>, so components
 * that need the current theme as a *value* (Monaco, for one) can follow it
 * without threading props through the tree.
 */
export default function useIsDark() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const html = document.documentElement
    const read = () => setIsDark(html.classList.contains("dark"))

    read()
    const observer = new MutationObserver(read)
    observer.observe(html, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
