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

  // Shareable snippets.
  snippets: {
    enabled: process.env.SNIPPETS_ENABLED !== "false",

    // SQLite file. In production point this at the service's state directory
    // so snippets survive restarts; the default is fine for local development.
    dbPath: process.env.SNIPPET_DB_PATH || require("path").join(__dirname, "data", "snippets.db"),

    // Snippets expire. Without a TTL the table only ever grows, and this is
    // storage strangers can write to.
    ttlDays: int(process.env.SNIPPET_TTL_DAYS, 90),

    // 9 bytes -> 12 base64url characters. Random rather than sequential: ids
    // are the only thing keeping one person's link from being guessed.
    idBytes: int(process.env.SNIPPET_ID_BYTES, 9),

    // How often expired rows are swept (also runs once at startup).
    purgeIntervalMs: int(process.env.SNIPPET_PURGE_INTERVAL_MS, 60 * 60 * 1000),

    // Creating a snippet is a write to disk by an anonymous client, so it gets
    // its own, much stricter budget than running code.
    rateLimitWindowMs: int(process.env.SNIPPET_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
    rateLimitMax: int(process.env.SNIPPET_RATE_LIMIT_MAX, 30),
  },

  // Per-IP request limit on /run-code.
  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
    max: int(process.env.RATE_LIMIT_MAX, 30),

    // Behind a proxy or load balancer, req.ip is the proxy's address unless
    // Express is told how many hops to trust — which would put every client in
    // one bucket. Set this to the number of proxies in front of the app.
    // Never set it to `true`: a client could then spoof X-Forwarded-For and
    // get a fresh bucket per request. Default 0 = no proxy, trust the socket.
    trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 0),
  },

  // A per-IP request limit does not bound resource use: 30 requests a minute
  // can still be 30 *simultaneous* containers, each holding the memory and CPU
  // reserved below. This caps how many run at once, regardless of who asked.
  concurrency: {
    max: int(process.env.MAX_CONCURRENT_EXECUTIONS, 4),
    // Requests beyond `max` wait in line; beyond that they are turned away
    // immediately rather than piling up behind a full queue.
    maxQueue: int(process.env.MAX_QUEUED_EXECUTIONS, 8),
    queueTimeoutMs: int(process.env.QUEUE_TIMEOUT_MS, 15000),
  },

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
