module.exports = {
  id: "java",
  label: "Java",
  filename: "Main.java",
  image: process.env.IMAGE_JAVA || "bytecode-java",
  // user.home is set because the sandbox uid has no home directory on the image.
  compile: ["javac", "-J-Duser.home=/tmp", "Main.java"],
  run: ["java", "-Duser.home=/tmp", "Main"],
}
