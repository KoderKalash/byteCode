const fs = require("fs");
const { exec } = require("child_process");

module.exports = {
  createFile: (code) => {
    const filename = "main.cpp";
    fs.writeFileSync(filename, code);
    return filename;
  },

  run: (filename) => {
    return new Promise((resolve, reject) => {
      const dir = process.cwd().replace(/\\/g, "/"); // For Windows path compatibility

      const command = `docker run --rm -v "${dir}:/app" -w /app bytecode-cpp sh -c "g++ ${filename} -o main && ./main"`;

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
