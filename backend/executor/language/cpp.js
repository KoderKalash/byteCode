module.exports = {
  id: "cpp",
  label: "C++",
  filename: "main.cpp",
  image: process.env.IMAGE_CPP || "bytecode-cpp",
  // Compile and run are separate container invocations so a compile error is
  // reported as a compile error, with the compiler's own message.
  compile: ["g++", "-std=c++17", "-O2", "-o", "main", "main.cpp"],
  run: ["./main"],
}
