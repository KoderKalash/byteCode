// Central place for every tunable. Nothing below should be hardcoded elsewhere.

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

module.exports = {
  port: int(process.env.PORT, 5000),

  // Comma-separated list of origins allowed to call the API.
  // "*" keeps local development friction-free; set it explicitly in production.
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Largest program we will accept, in characters.
  maxCodeLength: int(process.env.MAX_CODE_LENGTH, 64 * 1024),

  // Largest stdin payload we will accept, in characters.
  maxStdinLength: int(process.env.MAX_STDIN_LENGTH, 64 * 1024),

  sandbox: {
    // Wall-clock budget per phase, in milliseconds.
    compileTimeoutMs: int(process.env.COMPILE_TIMEOUT_MS, 15000),
    runTimeoutMs: int(process.env.RUN_TIMEOUT_MS, 10000),

    // Container resource caps. A submitted program is hostile until proven otherwise.
    memory: process.env.SANDBOX_MEMORY || "256m",
    cpus: process.env.SANDBOX_CPUS || "0.5",
    pidsLimit: int(process.env.SANDBOX_PIDS_LIMIT, 128),

    // Run the sandboxed process as a non-root, non-existent-on-host uid.
    user: process.env.SANDBOX_USER || "65534:65534",

    // Truncate program output so a print-loop cannot exhaust server memory.
    maxOutputBytes: int(process.env.MAX_OUTPUT_BYTES, 64 * 1024),
  },
}
