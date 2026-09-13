import languages from "@/constants/languages";
import { ChevronDown, Globe } from "lucide-react"

export default function LanguageSelector({ language, setLanguage }) {
  return (
    <div className="relative w-full sm:w-auto">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none z-10" />
        <select
          aria-label="Language"
          className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg pl-10 pr-10 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md w-full sm:w-auto sm:min-w-[140px]"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {languages.map((lang) => (
            <option key={lang.id} value={lang.id} className="py-2 bg-white dark:bg-gray-800">
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

