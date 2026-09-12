const { test } = require("node:test")
const assert = require("node:assert/strict")

const validateInput = require("../utils/validateInput")

test("accepts a supported language and non-empty code", () => {
  assert.equal(validateInput("python", "print(1)"), null)
})

test("rejects a missing or unsupported language", () => {
  assert.match(validateInput("", "print(1)"), /Missing language/)
  assert.match(validateInput("ruby", "puts 1"), /Unsupported language: ruby/)
  assert.match(validateInput("ruby", "puts 1"), /python/) // lists what is supported
})

test("rejects non-string and blank code", () => {
  assert.match(validateInput("python", 42), /must be a string/)
  assert.match(validateInput("python", "   \n "), /Missing code/)
})

test("rejects code beyond the size limit", () => {
  const huge = "x".repeat(64 * 1024 + 1)
  assert.match(validateInput("python", huge), /character limit/)
})
