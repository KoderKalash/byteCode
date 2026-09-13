// Single place the frontend talks to the API. The base URL is configuration,
// not a constant, so the app can be deployed somewhere other than localhost.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "")

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
      output: `Could not reach the ByteCode API at ${API_BASE}.`,
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

export { API_BASE }
