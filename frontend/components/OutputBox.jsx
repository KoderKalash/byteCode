"use client"

import { Terminal } from "lucide-react"

export default function OutputBox({ output }) {
  return (
    <div className="relative">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Output</span>
          <div className="ml-auto flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
        </div>

        {/* Output */}
        <div className="p-4 h-48 overflow-auto">
          <pre className="text-sm text-gray-100 font-mono leading-relaxed whitespace-pre-wrap">
            {output || <span className="text-gray-500 italic">Output will be here...</span>}
          </pre>
        </div>
      </div>
    </div>
  )
}
