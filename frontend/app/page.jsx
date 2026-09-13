"use client"

import { useState, useEffect, useRef } from "react"
import Editor, { loader } from "@monaco-editor/react"

import LanguageSelector from "@/components/LanguageSelector"
import RunButton from "@/components/RunButton"
import OutputBox from "@/components/OutputBox"
import InputBox from "@/components/InputBox"
import ThemeToggle from "@/components/ThemeToggle"
import CodeFallback from "@/components/CodeFallback"
import ShareButton from "@/components/ShareButton"
import { runCode, createSnippet, fetchSnippet } from "@/utils/api"
import useIsDark from "@/hooks/useIsDark"
import languages, { DEFAULT_LANGUAGE } from "@/constants/languages"

loader.config({ paths: { vs: "/monaco/vs" } })

const FILENAMES = { python: "main.py", cpp: "main.cpp", java: "Main.java" }

// Monaco ships no theme in this palette, so define both from the design tokens.
// Monaco needs literal hex — it parses these itself, CSS variables don't reach it.
const THEMES = {
  "bytecode-light": {
    base: "vs",
    colors: { "editor.background": "#f7f6f2", "editor.foreground": "#121212", "editorLineNumber.foreground": "#9a9a9a", "editorLineNumber.activeForeground": "#121212", "editor.selectionBackground": "#d4f00055", "editorCursor.foreground": "#121212", "editor.lineHighlightBackground": "#eceae4" },
    rules: [
      { token: "comment", foreground: "8a8a8a", fontStyle: "italic" },
      { token: "string", foreground: "3f7d20" },
      { token: "number", foreground: "b03a1a" },
      { token: "keyword", foreground: "b03a1a", fontStyle: "bold" },
      { token: "type", foreground: "1b5e8f" },
      { token: "identifier", foreground: "121212" },
    ],
  },
  "bytecode-dark": {
    base: "vs-dark",
    colors: { "editor.background": "#262626", "editor.foreground": "#f2f0eb", "editorLineNumber.foreground": "#6b6b6b", "editorLineNumber.activeForeground": "#f2f0eb", "editor.selectionBackground": "#d4f00033", "editorCursor.foreground": "#d4f000", "editor.lineHighlightBackground": "#2e2e2e" },
    rules: [
      { token: "comment", foreground: "7a7a7a", fontStyle: "italic" },
      { token: "string", foreground: "a8d84e" },
      { token: "number", foreground: "ff8a5c" },
      { token: "keyword", foreground: "ff8a5c", fontStyle: "bold" },
      { token: "type", foreground: "6fb4e8" },
      { token: "identifier", foreground: "f2f0eb" },
    ],
  },
}

export default function Home() {
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [stdin, setStdin] = useState("")
  const [result, setResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [snippetNotice, setSnippetNotice] = useState("")
  const [editorReady, setEditorReady] = useState(false)
  const [editorFailed, setEditorFailed] = useState(false)
  const isDark = useIsDark()

  // Monaco is served from this app, but a failed load should still leave a
  // usable page rather than a permanent "Loading…".
  //
  // Two paths, because they catch different failures: `loader.init()` rejects
  // when the loader script fails outright (a 404, a CSP refusal), while the
  // deadline covers a request that stalls instead of failing — a hung network
  // or a CDN that accepts the connection and never answers, which is the case
  // that otherwise leaves "Loading…" on screen indefinitely.
  useEffect(() => {
    if (editorReady) return undefined

    let cancelled = false
    const fail = () => {
      if (!cancelled) setEditorFailed(true)
    }

    loader.init().catch(fail)
    const deadline = setTimeout(fail, 10000)

    return () => {
      cancelled = true
      clearTimeout(deadline)
    }
  }, [editorReady])

  const canRun = code.trim().length > 0 && !isRunning

  const handleRun = async () => {
    if (!canRun) return
    setIsRunning(true)
    try {
      setResult(await runCode({ language, code, stdin }))
    } finally {
      setIsRunning(false)
    }
  }

  // A share link is /?s=<id>. Load it once on mount, before the user types.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("s")
    if (!id) return

    let cancelled = false
    fetchSnippet(id).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setSnippetNotice(result.error)
        return
      }
      setLanguage(result.language)
      setCode(result.code)
      setStdin(result.stdin)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleShare = async () => {
    const result = await createSnippet({ language, code, stdin })
    if (!result.ok) return result

    // Put the id in the URL without a navigation, so reload and back still work
    // and the address bar is the link even if the clipboard write is refused.
    const url = new URL(window.location.href)
    url.searchParams.set("s", result.id)
    window.history.replaceState(null, "", url)

    return { ok: true, url: url.toString() }
  }

  // Ctrl/Cmd+Enter runs. The ref keeps the listener pointed at the current
  // handler without rebinding on every keystroke.
  const runRef = useRef(handleRun)
  runRef.current = handleRun

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault()
        runRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const lineCount = code ? code.split("\n").length : 0

  return (
    <main
      className="min-h-screen p-4 sm:p-6 xl:flex xl:h-screen xl:min-h-0 xl:flex-col xl:overflow-hidden"
      style={{ paddingRight: "calc(1rem + var(--offset))", paddingBottom: "calc(1rem + var(--offset))" }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 xl:min-h-0 xl:flex-grow">

        {/* header */}
        <header className="flex flex-wrap items-stretch gap-3">
          <div
            className="flex items-center px-5 text-[19px] font-bold tracking-[-0.02em]"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            BYTECODE
          </div>

          <LanguageSelector language={language} setLanguage={setLanguage} />

          <div className="flex-grow" />

          <ThemeToggle />
        </header>

        {snippetNotice ? (
          <div
            className="mono flex items-center justify-between gap-4 px-4 py-2 text-[12px]"
            style={{ background: "var(--warn)", color: "#121212", border: "var(--border-w) solid var(--line)" }}
          >
            <span>{snippetNotice}</span>
            <button
              type="button"
              onClick={() => setSnippetNotice("")}
              aria-label="Dismiss"
              className="font-bold"
              style={{ cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* body */}
        <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-grow xl:grid-cols-[minmax(0,1fr)_452px] xl:gap-5">

          {/* editor */}
          <section className="blk flex min-w-0 flex-col">
            <div className="blk-head" style={{ color: "var(--ink)" }}>
              <span>{FILENAMES[language] ?? "main"}</span>
              <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            </div>

            <div className="h-[340px] sm:h-[420px] xl:h-auto xl:min-h-0 xl:flex-grow">
              {editorFailed ? (
                <CodeFallback code={code} setCode={setCode} language={language} />
              ) : (
              <Editor
                height="100%"
                language={language}
                theme={isDark ? "bytecode-dark" : "bytecode-light"}
                value={code}
                onChange={(value) => setCode(value || "")}
                onMount={() => setEditorReady(true)}
                beforeMount={(monaco) => {
                  Object.entries(THEMES).forEach(([name, theme]) => {
                    monaco.editor.defineTheme(name, { ...theme, inherit: true })
                  })
                }}
                options={{
                  fontSize: 13.5,
                  lineHeight: 25,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  padding: { top: 16, bottom: 16 },
                  smoothScrolling: true,
                  renderLineHighlight: "line",
                  overviewRulerLanes: 0,
                  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                }}
              />
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-4 p-3"
              style={{ borderTop: "var(--border-w) solid var(--line)" }}
            >
              <RunButton onClick={handleRun} isRunning={isRunning} disabled={!code.trim()} />
              <span className="meta">ctrl+enter</span>
              <div className="flex-grow" />
              <ShareButton onShare={handleShare} disabled={!code.trim()} />
            </div>
          </section>

          {/* right rail */}
          <aside className="flex min-w-0 flex-col gap-4 xl:gap-5">
            <InputBox stdin={stdin} setStdin={setStdin} />
            <div className="flex min-h-0 flex-grow flex-col">
              <OutputBox result={result} isRunning={isRunning} />
            </div>
            <div className="meta">256 MB · 0.5 CPU · no network · 10 s limit</div>
          </aside>
        </div>
      </div>
    </main>
  )
}
