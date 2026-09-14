const python = require("./python")
const cpp = require("./cpp")
const java = require("./java")

const languages = { python, cpp, java }

module.exports = {
  languages,
  get: (id) => languages[id],
  ids: Object.keys(languages),
}
