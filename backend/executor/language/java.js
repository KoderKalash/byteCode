const fs = require("fs");
const { exec } = require("child_process");

module.exports = {
  createFile: (code) => {
    const filename = "Main.java";
    fs.writeFileSync(filename, code);
    return filename;
  },

  run: (filename) => {
    return new Promise((resolve, reject) => {
      const command = `docker run --rm -v ${process.cwd()}:/app -w /app bytecode-java`;
      exec(command, (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      });
    });
  },
};
