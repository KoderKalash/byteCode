import languages from "@/constants/languages";
import { ChevronDown, Globe } from "lucide-react"

export default function LanguageSelector({ language, setLanguage }) {
  return (
    <div className="relative inline-block">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none z-10" />
        <select
          className="appearance-none bg-white border border-gray-200 rounded-lg pl-10 pr-10 py-3 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md min-w-[140px]"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {languages.map((lang) => (
            <option key={lang.id} value={lang.id} className="py-2">
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  )
}

