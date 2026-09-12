// Single place the frontend talks to the API. The base URL is configuration,
// not a constant, so the app can be deployed somewhere other than localhost.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "")

export async function runCode({ language, code }) {
  let res
  try {
    res = await fetch(`${API_BASE}/run-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code }),
    })
  } catch (err) {
    return { ok: false, output: `Could not reach the ByteCode API at ${API_BASE}.` }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return { ok: false, output: `Unexpected response from the API (HTTP ${res.status}).` }
  }

  return {
    ok: Boolean(data.ok),
    output: data.output ?? data.error ?? "No output.",
    stage: data.stage,
    exitCode: data.exitCode,
    timedOut: Boolean(data.timedOut),
    truncated: Boolean(data.truncated),
    durationMs: data.durationMs,
  }
}

export { API_BASE }
