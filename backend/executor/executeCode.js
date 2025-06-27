const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const runners = {
  cpp: require("./language/cpp"),
  java: require("./language/java"),
  python: require("./language/python"),
};

module.exports = async (language, code) => {
  const runner = runners[language];
  if (!runner) throw new Error("Unsupported language");

  const filePath = await runner.createFile(code);
  const output = await runner.run(filePath);
  return output;
};
