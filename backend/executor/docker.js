const { spawn } = require("child_process")
const crypto = require("crypto")

const config = require("../config")
const ExecutionError = require("./ExecutionError")

const SANDBOX_DIR = "/sandbox"

/**
 * Run one command inside a throwaway container.
 *
 * Every hardening flag here exists for a reason:
 *  - argv array, never a shell string, so nothing in the payload can be interpolated
 *    into a host command line.
 *  - --network none      : no outbound traffic, no using the sandbox as a proxy.
 *  - --memory / --cpus   : an allocation loop or busy loop cannot starve the host.
 *  - --pids-limit        : blocks fork bombs.
 *  - --read-only + tmpfs : the container rootfs is immutable; only the mounted
 *                          work directory and a small /tmp are writable.
 *  - --cap-drop ALL, --security-opt no-new-privileges : no privilege escalation.
 *  - --user (non-root)   : the program does not run as root inside the container.
 *  - only `workDir` is mounted, and it holds exactly one submission — the backend
 *    source tree is no longer reachable from inside the sandbox.
 *
 * `stdin`, when given, is piped to the process. Without it the container's stdin
 * is closed, so a program that reads input gets EOF immediately instead of
 * blocking until the timeout.
 */
function spawnDocker({ image, argv, workDir, timeoutMs, stdin }) {
  const { sandbox } = config
  const containerName = `bytecode-${crypto.randomBytes(8).toString("hex")}`

  const hasStdin = typeof stdin === "string" && stdin.length > 0

  const dockerArgs = [
    "run",
    "--rm",
    // --interactive keeps the container's stdin open so we can write to it.
    // Only add it when there is something to deliver.
    ...(hasStdin ? ["--interactive"] : []),
    "--name", containerName,
    "--network", "none",
    "--memory", sandbox.memory,
    "--memory-swap", sandbox.memory, // no swap: the memory cap is the real cap
    "--cpus", sandbox.cpus,
    "--pids-limit", String(sandbox.pidsLimit),
    "--read-only",
    "--tmpfs", "/tmp:rw,exec,nosuid,size=64m",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", sandbox.user,
    "-v", `${workDir}:${SANDBOX_DIR}`,
    "-w", SANDBOX_DIR,
    image,
    ...argv,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, {
      stdio: [hasStdin ? "pipe" : "ignore", "pipe", "pipe"],
    })

    if (hasStdin) {
      // A program that ignores its input closes the pipe early, which surfaces
      // here as EPIPE. That is the program's choice, not an execution failure.
      child.stdin.on("error", () => {})
      child.stdin.end(stdin)
    }

    const captured = { stdout: "", stderr: "" }
    let truncated = false
    let timedOut = false
    let settled = false

    // Cap each stream so a runaway print loop cannot exhaust server memory.
    const capture = (stream, key) => {
      stream.setEncoding("utf8")
      stream.on("data", (chunk) => {
        const room = sandbox.maxOutputBytes - captured[key].length
        if (room <= 0) {
          truncated = true
          return
        }
        if (chunk.length > room) truncated = true
        captured[key] += chunk.slice(0, room)
      })
    }

    capture(child.stdout, "stdout")
    capture(child.stderr, "stderr")

    const finish = (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ...captured, exitCode, timedOut, truncated })
    }

    const timer = setTimeout(() => {
      timedOut = true

      // Killing the docker CLI does not stop the container, so kill the container
      // by name. This is what keeps a `while True: pass` from leaking forever.
      const killer = spawn("docker", ["kill", containerName], { stdio: "ignore" })
      killer.on("error", () => {})
      child.kill("SIGKILL")

      // Settle now rather than waiting for `close`. The container still holds the
      // stdio pipes until the daemon tears it down, so `close` can lag well past
      // the deadline — waiting for it would keep the caller hanging for exactly
      // as long as the program we just decided to stop.
      finish(null)
      child.stdin?.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      child.unref()
    }, timeoutMs)

    child.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Docker itself is missing or unreachable — our problem, not the user's.
      reject(
        new ExecutionError(
          `Sandbox unavailable: could not start Docker (${err.message})`,
          { stage: "sandbox" }
        )
      )
    })

    child.on("close", (exitCode) => finish(exitCode))
  })
}

// The docker CLI reports its own failures on stderr with an exit code that can
// collide with a program's. These signatures mean the sandbox never started, so
// the message must not be handed to the user as if their code had produced it.
const DOCKER_INFRA_ERRORS = [
  /failed to connect to the docker api/i,
  /cannot connect to the docker daemon/i,
  /permission denied while trying to connect to the docker daemon/i,
  /is the docker daemon running/i,
  /unable to find image/i,
  /no such image/i,
  /pull access denied/i,
  /invalid reference format/i,
  /error response from daemon/i,
]

function isInfraFailure({ exitCode, stdout, stderr }) {
  if (exitCode === 0 || stdout) return false
  // 125 is docker's own "docker run itself failed".
  if (exitCode === 125) return true
  return DOCKER_INFRA_ERRORS.some((pattern) => pattern.test(stderr))
}

/**
 * Run one command in the sandbox, distinguishing a failure of the submitted
 * program from a failure of the sandbox itself.
 */
async function runInContainer(options) {
  const result = await spawnDocker(options)

  if (!result.timedOut && isInfraFailure(result)) {
    // Log the real cause for the operator; return something generic to the
    // caller so internal socket paths and image names do not leak to users.
    console.error(`[SANDBOX] docker failed (exit ${result.exitCode}): ${result.stderr.trim()}`)
    throw new ExecutionError(
      "The execution sandbox is unavailable. Please try again shortly.",
      { stage: "sandbox", exitCode: result.exitCode }
    )
  }

  return result
}

module.exports = { runInContainer, SANDBOX_DIR }
