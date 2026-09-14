# ByteCode — web client

The browser half of [ByteCode](../Readme.md): a Next.js 15 app with a Monaco
editor that posts code to the API in [`../backend`](../backend) and renders what
comes back.

It has no compiler of its own. Everything this app does with a submission is
`fetch` it to `NEXT_PUBLIC_API_URL`, so it runs perfectly well with no backend —
you just can't execute anything.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

`npm install` before `dev` or `build` is not optional: the `predev` and
`prebuild` hooks run `scripts/copy-monaco.mjs`, which copies Monaco out of
`node_modules`. Without a populated `node_modules` that script has nothing to
copy and the editor will not load.

The API is expected at `http://localhost:5000` — see the
[root README](../Readme.md#-local-development) for starting it.

| Script | |
|---|---|
| `npm run dev` | Development server (copies Monaco first) |
| `npm run build` | Production build (copies Monaco first) |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint, as CI runs it |

## Layout

```
app/           layout (fonts, metadata) and the single page
components/    editor chrome — output, stdin, run, share, language, theme
constants/     the language list and each language's starter program
hooks/         useIsDark
utils/api.js   every call to the backend
scripts/       copy-monaco.mjs
```

## Three things that are not obvious

**Monaco is served from this app, not a CDN.** `@monaco-editor/react` loads it
from jsdelivr by default, which makes the core of the page depend on a third
party being reachable at runtime — behind a strict CSP, on a restricted
network, or during a CDN outage it renders a permanent "Loading…" with no
error. `scripts/copy-monaco.mjs` copies the bundle into `public/monaco` (~14 MB,
generated, gitignored) and `app/page.jsx` points the loader at it. Combined
with `next/font` self-hosting the fonts at build time, the app makes **no
third-party requests at runtime**.

If Monaco fails anyway, `CodeFallback` swaps in a plain textarea rather than
leaving a dead page. Two things trigger it: the loader rejecting, and a 10s
deadline for the case where the request stalls instead of failing.

**The theme lives in a class, and Monaco needs a value.** `ThemeToggle` writes
`dark` onto `<html>`, which is all Tailwind needs. Monaco is not styled by CSS
and has to be *told* which theme to use, so `hooks/useIsDark.js` mirrors that
class into React state with a `MutationObserver` instead of threading props
through the tree.

**`NEXT_PUBLIC_API_URL` is inlined at build time, not read at runtime.**
Changing it requires a rebuild — on Vercel, a redeploy. Setting it in the
dashboard and restarting will not do anything.

## Deploying

Vercel, with **Root Directory set to `frontend`**. This repository has no
`package.json` at its root, so a build from the root fails at dependency
install; that setting is a project setting in the dashboard and cannot be set
from `vercel.json`.

`vercel.json` here sets cache headers for the Monaco bundle and a few security
headers. See [`../deploy/README.md`](../deploy/README.md) for the full runbook,
including the backend — which cannot run on Vercel, because it needs a Docker
socket.
