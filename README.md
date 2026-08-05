# Redux XVR

A 3D / WebXR visualization layer for [Redux](https://github.com/ReduxISU) — the ISU platform for
teaching NP-completeness and polynomial-time mapping reductions.

The existing D3 views render each problem flat and in isolation. This adds a **third view**: a
spatial scene showing a reduction and the correspondence between its two sides. Flat in the browser
first; VR is an upgrade on the same scene at the same URL.

**Status:** slice 3 — the two sides are linked. Gadget correspondences arc across the gap in three
modes, and selecting any element traces it to its counterpart in the other world. XR is next.

![the certificate mapping back to a satisfying assignment](docs/slice3.png)

## Highlight modes

| Mode | Shows | Direction |
|---|---|---|
| **Show reduction** | each clause → its cluster of vertices (3 links) | 3SAT → Clique |
| **Highlight gadgets** | each literal → its one vertex (9 links) | 3SAT → Clique |
| **Map certificate** | the k-clique → a satisfying assignment (3 links) | **Clique → 3SAT** |

The first two mirror switches Redux_GUI already has. The third is the one worth having: reductions
run forward but certificates map *backward*, and "which way does the arrow go" is the misconception
this whole view exists to attack. Arrowheads follow the actual direction.

Hover or click any literal or vertex to trace just that correspondence and dim the rest.

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

playground/public/fonts/ Self-hosted font subset — see its NOTICE.md, the default
                         drei font has no math glyphs.
```

### URL parameters

| Param | Effect |
|---|---|
| `?mode=reduction\|gadgets\|solution` | which correspondences to draw; default `reduction` |
| `?focus=<id>` | pre-select an element, e.g. `?focus=x2_2` — deep-links a specific correspondence |
| `?world=from` / `?world=to` | show one world alone; default `both` |
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
