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
      // Ensure path is compatible with Docker (e.g., handle Windows)
      const dir = process.cwd().replace(/\\/g, "/");

      // This image will compile and run Main.java
      const command = `docker run --rm -v "${dir}:/app" -w /app bytecode-java sh -c "javac ${filename} && java Main"`;

      console.log("[DOCKER RUN]", command);

      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error("[DOCKER ERROR]:", stderr || err.message);
          return reject(stderr || err.message);
        }

        if (stderr) {
          console.warn("[DOCKER STDERR]:", stderr);
        }

        resolve(stdout.trim());
      });
    });
  },
};
