const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const runners = {
  cpp: require("./language/cpp"),
  java: require("./language/java"),
  python: require("./language/python"),
};

module.exports = async (language, code) => {
  try {
    const runner = runners[language]
    if (!runner) throw new Error("Unsupported language")

    console.log(`[EXEC] Using runner for language: ${language}`)

    const filePath = await runner.createFile(code)
    console.log(`[EXEC] File created at: ${filePath}`)

    const output = await runner.run(filePath)
    console.log(`[EXEC] Output received`)
    
    return output
  } catch (err) {
    console.error(`[EXEC ERROR]:`, err.message)
    throw new Error("Execution Failed")
  }
}
