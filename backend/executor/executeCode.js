const fs = require("fs/promises")
const os = require("os")
const path = require("path")

const config = require("../config")
const ExecutionError = require("./ExecutionError")
const { runInContainer } = require("./docker")
const { gate } = require("./concurrency")
const languages = require("./language")

/**
 * Create an isolated working directory for a single submission.
 *
 * Previously every runner wrote a fixed filename (main.py / Main.java / main.cpp)
 * into the backend's own working directory, so two concurrent requests overwrote
 * each other's source — one user could execute and see another user's code. Each
 * request now gets its own directory outside the repo, and it is deleted afterwards.
 */
async function createWorkDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bytecode-"))
  // The sandbox runs as a non-root uid that does not own this directory, so it
  // needs group/other write access to emit compiler output.
  await fs.chmod(dir, 0o777)
  return dir
}

async function removeWorkDir(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch (err) {
    // Never fail a response because cleanup lost a race.
    console.error(`[EXEC] cleanup failed for ${dir}: ${err.message}`)
  }
}

function timeoutMessage(stage, timeoutMs) {
  const seconds = (timeoutMs / 1000).toFixed(0)
  return stage === "compile"
    ? `Compilation timed out after ${seconds}s.`
    : `Execution timed out after ${seconds}s. Check for an infinite loop.`
}

async function executeCode(language, code, stdin) {
  const spec = languages.get(language)
  if (!spec) throw new ExecutionError(`Unsupported language: ${language}`, { stage: "sandbox" })

  // Claim a slot before doing any work, so a refusal costs nothing.
  const release = await gate.acquire()

  const workDir = await createWorkDir()
  const startedAt = Date.now()

  try {
    await fs.writeFile(path.join(workDir, spec.filename), code, { mode: 0o644 })

    if (spec.compile) {
      const compiled = await runInContainer({
        image: spec.image,
        argv: spec.compile,
        workDir,
        timeoutMs: config.sandbox.compileTimeoutMs,
      })

      if (compiled.timedOut) {
        throw new ExecutionError(timeoutMessage("compile", config.sandbox.compileTimeoutMs), {
          stage: "compile",
          timedOut: true,
        })
      }

      if (compiled.exitCode !== 0) {
        // Hand back the compiler's actual diagnostics — this is the message the
        // user needs, and it used to be discarded.
        throw new ExecutionError(compiled.stderr.trim() || "Compilation failed.", {
          stage: "compile",
          exitCode: compiled.exitCode,
        })
      }
    }

    const executed = await runInContainer({
      image: spec.image,
      argv: spec.run,
      workDir,
      timeoutMs: config.sandbox.runTimeoutMs,
      // Only the run phase gets stdin; a compiler has no use for it.
      stdin,
    })

    if (executed.timedOut) {
      throw new ExecutionError(timeoutMessage("run", config.sandbox.runTimeoutMs), {
        stage: "run",
        timedOut: true,
        // Partial output is still useful when a program loops after printing.
      })
    }

    return {
      stdout: executed.stdout,
      stderr: executed.stderr,
      exitCode: executed.exitCode,
      truncated: executed.truncated,
      stage: "run",
      timedOut: false,
      durationMs: Date.now() - startedAt,
    }
  } finally {
    await removeWorkDir(workDir)
    // Release only after cleanup, so the slot's resources are actually free
    // before the next execution claims it.
    release()
  }
}

module.exports = executeCode
