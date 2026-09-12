const config = require("../config")
const languages = require("../executor/language")

/**
 * Returns an error string, or null when the payload is acceptable.
 */
function validateInput(language, code) {
  if (typeof language !== "string" || !language) return "Missing language"
  if (typeof code !== "string") return "Code must be a string"
  if (!code.trim()) return "Missing code"

  if (!languages.ids.includes(language)) {
    return `Unsupported language: ${language}. Supported: ${languages.ids.join(", ")}`
  }

  if (code.length > config.maxCodeLength) {
    return `Code exceeds the ${config.maxCodeLength} character limit`
  }

  return null
}

module.exports = validateInput
