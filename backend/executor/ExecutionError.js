// Carries the *real* compiler / runtime message back to the caller.
// The whole point of a compiler UI is showing the user why their code failed,
// so nothing in the execution path is allowed to flatten this into "Execution Failed".
class ExecutionError extends Error {
  constructor(message, { stage, exitCode = null, timedOut = false } = {}) {
    super(message)
    this.name = "ExecutionError"
    this.stage = stage // "compile" | "run" | "sandbox"
    this.exitCode = exitCode
    this.timedOut = timedOut
  }
}

module.exports = ExecutionError
