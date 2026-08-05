# Redux XVR

A 3D / WebXR visualization layer for [Redux](https://github.com/ReduxISU) — the ISU platform for
teaching NP-completeness and polynomial-time mapping reductions.

The existing D3 views render each problem flat and in isolation. This adds a **third view**: a
spatial scene showing a reduction and the correspondence between its two sides. Flat in the browser
first; VR is an upgrade on the same scene at the same URL.

**Status:** slice 1 — 3SAT → CLIQUE renders in 3D from the live API. The reduced graph appears as
three labelled clause hulls with the k-clique highlighted across them. No 3SAT world and no XR yet.

![the reduced clique](docs/slice1.png)

## Quick start

```bash
nvm use 26          # repo requires Node >= 26
npm install
npm run dev         # http://localhost:5173
```

The dev server binds `0.0.0.0`, so under WSL2 it is reachable from a Windows browser at
`http://localhost:5173`.

## Layout

```
packages/layout/         PURE. Reduction JSON -> positions. No three.js, no React, no DOM.
                         Unit-tested in CI, no GPU required.
playground/              Vite + React Three Fiber. Consumes layout output.
fixtures/                Committed API capture — deterministic tests, works offline.
docs/data-contract.md    What the backend actually emits, and its quirks.
tools/capture-fixtures.ts Refresh fixtures from the live API.
tools/shoot.ts           Headless screenshots (SwiftShader) for visual verification.
```

### URL parameters

| Param | Effect |
|---|---|
| `?source=fixtures` | render the committed capture instead of calling the API |
| `?frame=0` | base (unsolved) frame; default is the solved frame |
| `?static=1` | freeze animation and damping, for comparable screenshots |

`packages/layout` is the load-bearing layer: it is testable without a browser, so CI can catch
regressions on the genuinely difficult logic. Its purity is enforced by ESLint —
importing `three`, `react`, or touching `window`/`document` from that package is a lint error, not a
convention.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm test` | vitest over `packages/*/test` — no browser, no GPU |
| `npm run lint` | ESLint, including the layout purity fence |
| `npm run format` | Biome (formatter only; ESLint owns correctness) |
| `npm run shoot [name]` | Screenshot the running dev server → `shots/<name>.png` |

`npm run shoot` needs the dev server running. It waits on `window.__sceneReady` rather than a timer,
and freezes animation by default so output is comparable between runs; pass `--live` to keep motion.

## WebXR

`localhost` counts as a secure context, so WebXR works there over plain http — no certs needed for
local development. Test without hardware using the
[Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik)
extension. For a real headset on the LAN you need either HTTPS or `adb reverse tcp:5173 tcp:5173`
over USB, which preserves the `localhost` origin.

## Data

The Redux API is public and CORS-open, so the browser can call it directly — no local backend
required:

```
https://redux.isu.edu/api/redux/
```

See `docs/data-contract.md` (slice 1) for the reduction JSON shape and its known quirks.
