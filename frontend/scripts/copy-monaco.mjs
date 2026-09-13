/**
 * Copy Monaco's prebuilt AMD bundle into public/ so the editor is served from
 * this app rather than a CDN.
 *
 * @monaco-editor/react loads Monaco from jsdelivr by default. That makes the
 * editor — the core of the page — depend on a third party being reachable at
 * runtime: behind a strict CSP, on a restricted network, or during a CDN
 * outage, the app renders a permanent "Loading…" with no error.
 *
 * Runs from the `prebuild` and `predev` npm lifecycle hooks. The copy is
 * generated, so it is gitignored rather than committed.
 */
import { cp, rm, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const from = join(root, "node_modules", "monaco-editor", "min", "vs")
const to = join(root, "public", "monaco", "vs")

try {
  await stat(from)
} catch {
  console.error(
    `[monaco] ${from} is missing. Run \`npm install\` before building — the ` +
      `editor is served from public/monaco, not from a CDN.`
  )
  process.exit(1)
}

await rm(to, { recursive: true, force: true })
await cp(from, to, { recursive: true })

console.log(`[monaco] copied ${from} -> ${to}`)
