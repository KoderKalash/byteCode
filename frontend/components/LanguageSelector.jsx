"use client"

import languages from "@/constants/languages"

export default function LanguageSelector({ language, setLanguage }) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="blk flex items-stretch"
      style={{ boxShadow: "none" }}
    >
      {languages.map((lang, i) => {
        const active = lang.id === language
        return (
          <button
            key={lang.id}
            type="button"
            onClick={() => setLanguage(lang.id)}
            aria-pressed={active}
            className="mono px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.06em] transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-ink)" : "var(--ink-soft)",
              borderRight:
                i < languages.length - 1 ? "var(--border-w) solid var(--line)" : "none",
            }}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
