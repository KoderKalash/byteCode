// Single place the frontend talks to the API. The base URL is configuration,
// not a constant, so the app can be deployed somewhere other than localhost.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "")

/**
 * What to say when the API cannot be reached at all.
 *
 * A deployment built without NEXT_PUBLIC_API_URL falls back to localhost, which
 * is right for development and meaningless in a stranger's browser: naming
 * `http://localhost:5000` there reads as a half-wired app rather than a missing
 * backend. So when the base is loopback but the page is not being served from
 * loopback, the deployment simply has no backend and says so.
 */
function unreachableMessage() {
  const baseIsLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_BASE)
  const servedFromLoopback =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)

  if (baseIsLoopback && !servedFromLoopback) {
    return "This deployment has no compiler backend configured, so code cannot be run here."
  }
  return `Could not reach the ByteCode API at ${API_BASE}.`
}

/**
 * Collapse an API response into one of a fixed set of outcomes the UI knows how
 * to render. Every error the API returns carries a `stage`, so this never has to
 * pattern-match on prose.
 */
function classify(res, data) {
  if (data.timedOut) return "timeout"

  switch (data.stage) {
    case "compile":
      return data.ok ? "ok" : "compile_error"
    case "run":
      return data.ok ? "ok" : "runtime_error"
    case "invalid":
    case "rate_limited":
    case "capacity":
    case "sandbox":
    case "server":
      return data.stage
    default:
      return res.ok ? "ok" : "server"
  }
}

export async function runCode({ language, code, stdin }) {
  let res
  try {
    res = await fetch(`${API_BASE}/run-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, stdin }),
    })
  } catch {
    return {
      ok: false,
      kind: "network",
      output: unreachableMessage(),
      stdout: "",
      stderr: "",
    }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return {
      ok: false,
      kind: "server",
      output: `Unexpected response from the API (HTTP ${res.status}).`,
      stdout: "",
      stderr: "",
    }
  }

  return {
    ok: Boolean(data.ok),
    kind: classify(res, data),
    status: res.status,
    output: data.output ?? data.error ?? "",
    stdout: data.stdout ?? "",
    stderr: data.stderr ?? data.error ?? "",
    exitCode: data.exitCode ?? null,
    timedOut: Boolean(data.timedOut),
    truncated: Boolean(data.truncated),
    durationMs: data.durationMs ?? null,
  }
}

/**
 * Save the current editor contents and get back a short id to share.
 * Returns { ok, id } or { ok: false, error }.
 */
export async function createSnippet({ language, code, stdin }) {
  let res
  try {
    res = await fetch(`${API_BASE}/snippets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, stdin }),
    })
  } catch {
    return { ok: false, error: "Could not reach the API." }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: `Unexpected response (HTTP ${res.status}).` }
  }

  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || `Could not save the snippet (HTTP ${res.status}).` }
  }
  return { ok: true, id: data.id, expiresAt: data.expiresAt }
}

/** Load a shared snippet by id. Returns { ok, language, code, stdin } or { ok: false, error }. */
export async function fetchSnippet(id) {
  let res
  try {
    res = await fetch(`${API_BASE}/snippets/${encodeURIComponent(id)}`)
  } catch {
    return { ok: false, error: "Could not reach the API." }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: `Unexpected response (HTTP ${res.status}).` }
  }

  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || "That snippet could not be loaded." }
  }
  return { ok: true, language: data.language, code: data.code, stdin: data.stdin ?? "" }
}

export { API_BASE }
