"use client"

import { useState } from "react"
import Editor from "@monaco-editor/react"
import LanguageSelector from "@/components/LanguageSelector"
import RunButton from "@/components/RunButton"
import OutputBox from "@/components/OutputBox"
import ThemeToggle from "@/components/ThemeToggle"
import { Code2, Zap, Terminal } from "lucide-react"

export default function Home() {
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("")
  const [output, setOutput] = useState("")

  const handleRun = async () => {
    try {
      const res = await fetch("http://localhost:5000/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      })
      const data = await res.json()
      setOutput(data.output || data.error || "No output.")
    } catch (err) {
      setOutput("Error connecting to backend.")
    }
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-gray-900 transition-all duration-500"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.1),transparent)] dark:bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.05),transparent)]"></div>

      {/* Content */}
      <div className="relative z-10 px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <header className="relative">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl dark:shadow-2xl p-6 border border-white/20 dark:border-gray-700/50 transition-all duration-300">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                {/* Brand Section */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Code2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      ByteCode
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Online Compiler
                    </p>
                  </div>
                </div>

                {/* Controls Section */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 p-2 bg-gray-50/50 dark:bg-gray-700/50 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50">
                    <LanguageSelector language={language} setLanguage={setLanguage} />
                    <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Code Editor Section */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Code Editor
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  Ready to code
                </div>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl dark:shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden transition-all duration-300">
                  {/* Editor Header */}
                  <div className="bg-gray-50/80 dark:bg-gray-900/80 px-6 py-3 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {/* {language || "Select Language"}  */}
                        main.
                        {language === "python" ? "py" : language === "java" ? "java" : "cpp"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Lines: {code.split("\n").length}</div>
                  </div>

                  {/* Monaco Editor */}
                  <div className="relative">
                    <Editor
                      height="450px"
                      language={language}
                      theme="vs-dark"
                      value={code}
                      onChange={(value) => setCode(value || "")}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        lineHeight: 1.6,
                        padding: { top: 16, bottom: 16 },
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        renderLineHighlight: "gutter",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Run Button Section */}
              <div className="flex justify-end">
                <RunButton onClick={handleRun} />
              </div>
            </div>

            {/* Output Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Output
              </h2>

              <div className="sticky top-8">
                <OutputBox output={output} />

                {/* Stats Card */}
                <div className="mt-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 transition-all duration-300">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Session Stats</h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{code.length}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Characters</div>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {code.split("\n").length}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Lines</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center py-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full border border-white/20 dark:border-gray-700/50">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Powered by ByteCode Engine</span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
