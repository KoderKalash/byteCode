module.exports = {
  id: "python",
  label: "Python",
  filename: "main.py",
  image: process.env.IMAGE_PYTHON || "bytecode-python",
  compile: null, // interpreted
  // -B: no __pycache__ writes, -u: unbuffered so output survives a timeout kill
  run: ["python", "-B", "-u", "main.py"],
}
