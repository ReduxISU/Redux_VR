# Redux VR

A 3D / WebXR visualization layer for [Redux](https://github.com/ReduxISU) — the ISU platform for
teaching NP-completeness and polynomial-time mapping reductions.

The existing D3 views render each problem flat and in isolation. This adds a **third view**: a
spatial scene showing a reduction and the correspondence between its two sides. Flat in the browser
first; VR is an upgrade on the same scene at the same URL.

**Status:** slice 5 — WebXR entry works. The scene is unchanged in a headset; only its placement and
the camera source differ. Stereo rendering, controllers and comfort are **not yet verified on real
hardware** — see below.

![the in-scene reduction menu](docs/menu.png)

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

Hover or click any literal or vertex to trace just that correspondence and dim the rest. A mode with
nothing to draw is disabled rather than silently empty.

## Reductions

The picker is driven by `GET /Navigation/Reductions` — Redux's own catalog. Each entry is classified
by what it can actually support, so the view never implies more than the backend provides:

| State | Meaning | Count |
|---|---|---:|
| **linked** | renders, with gadget correspondences | 7 |
| **unlinked** | renders, but the backend publishes no gadgets | 4 |
| **unsupported** | a side uses a family this renderer cannot draw (`Set D3`, `Dynamic Table`) | 9 |

Pick one from the in-scene **Reductions** menu, or deep-link with `?reduction=<className>`.
Unsupported entries are not listed at all — a dead control teaches nothing — but their count is
reported. Modes with nothing to draw disable themselves and the view falls back to one that has links.

![CLIQUE to Vertex Cover, rendered with no reduction-specific code](docs/graph-to-graph.png)

A problem's visualization is chosen by **capability** — the first candidate whose `visualizationType`
this renderer understands — not by list order. CLIQUE publishes both a D3 graph and a LaTeX view, and
picking by order is the bug the existing GUI has.

Groups come from gadgets when a reduction publishes them, and are otherwise absent: a graph with no
recovered partition draws no hulls, because asserting a structure the reduction does not have would
be a lie.

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
packages/puzzle/         PURE. Bin-packing instance -> items, placement, certificate,
                         positions. Same fence, same guarantee.
playground/
  shell/                 One <Canvas> for the app; per-activity Stage; activity registry.
  activities/hall/       The shelf of problems — the front door.
  activities/binpacking/ Grab-and-place bin packing.
  activities/reduction/  The two-world reduction view.
fixtures/                Committed API capture — deterministic tests, works offline.
docs/data-contract.md    What the backend actually emits, and its quirks.
tools/capture-fixtures.ts Refresh fixtures from the live API.
tools/shoot.ts           Headless screenshots (SwiftShader) for visual verification.

playground/public/fonts/ Self-hosted font subset — see its NOTICE.md, the default
                         drei font has no math glyphs.
```

The canvas is mounted once, above the activity switch: a WebGL context cannot be handed to a new
one, so a per-activity canvas would end any immersive session every time a student changed rooms.
Activities therefore render *inside* the canvas and publish their DOM readout back out through a
tunnel (`shell/tunnel.ts`) — `react-dom`'s `createPortal` cannot cross between the two reconcilers.

### URL parameters

| Param | Effect |
|---|---|
| `?activity=hall\|binpacking\|reduction` | which scene to open; default `hall` |
| `?instance=<string>` | the problem instance, in the backend's own syntax — e.g. `((4,7,3,6,2,8),10,3)`. Lets a printed kit or worksheet carry the exact puzzle a class is working on |
| `?skin=trucks\|hawaii` | which telling of a puzzle to open in; presentation only, never the puzzle |
| `?lift=1` | open a colouring map already lifted into its graph |
| `?reduction=<className>` | which reduction to show; default `SipserReduceToCliqueStandard` |
| `?mode=reduction\|gadgets\|solution` | which correspondences to draw; default `reduction` |
| `?focus=<id>` | pre-select an element, e.g. `?focus=x2_2` — deep-links a specific correspondence |
| `?menu=open` | start with the reduction menu expanded |
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

Because the UI is scene geometry, it is exercised with real clicks rather than DOM queries:

```bash
npm run shoot menu-switch -- --url='http://localhost:5173/?activity=reduction&menu=open' \
  --click=450,280 --await-text='CLIQUE → VERTEXCOVER ·'
```

R3F raycasts that click exactly as it will raycast an XR controller ray.

`--click`, `--drag=x1,y1,x2,y2` and `--await-text` all repeat and run **in the order given**, so a
whole session scripts against facts rather than timers — including a click that turns out to be a
navigation:

```bash
npm run shoot packed -- --url='http://localhost:5173/?activity=binpacking' \
  --click=640,611 --await-text='0 to place' \
  --click=460,611 --await-text='referee: True'
```

Two cautions. `window.__sceneReady` now means *the canvas has painted*, which for an activity that
fetches its data is before that data arrives — assert anything data-driven with `--await-text`
against the HUD. And troika rebuilds in-scene `<Text>` off the main thread, so a screenshot can catch
a freshly-coloured label still showing stale words; the DOM HUD is the surface to assert on, never
pixels.

## WebXR

`localhost` counts as a secure context, so WebXR works there over plain http — no certs needed for
local development. Press **Enter VR** (top right); it is disabled with a reason when no runtime is
available. Entering requires a user gesture, which is why that one button is DOM while every other
control is scene geometry.

**Nothing about the scene changes in a headset.** Only two things differ: the camera comes from the
headset instead of `OrbitControls`, and the scene is normalised to human scale — one unit is one
metre in XR, so a 20-unit scene would otherwise be a 20-metre wall. See `stageTransform` in
`src/xr.ts`; the placement arithmetic is pure and unit-tested even though stereo rendering is not.

Controller rays raise ordinary R3F pointer events, the same ones a mouse raises, so the menu and the
element highlighting work in a session without a second interaction model — that is why
`interaction.ts` was written in terms of intents back in slice 3 rather than after.

### Testing without hardware

Install the
[Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik)
(Chrome/Edge). It fakes a headset and two controllers with draggable poses, and validates session
lifecycle, per-eye rendering, controller poses and select events. It says nothing about whether the
experience is *good*.

### What is verified, and what is not

| | |
|---|---|
| ✅ automated | flat rendering unaffected by the XR wrapper; support detection; button state; session-rejection handling; stage-transform arithmetic |
| 🔶 emulator | session lifecycle, per-eye rendering, controller rays hitting the menu |
| ❌ hardware only | whether stereo depth actually helps students read the graph; comfort and scale; text legibility at real per-eye resolution; frame rate under stereo load |

The last row is the core pedagogical claim of this project and is unfalsifiable on a monitor. Any
WebXR-capable headset answers it — the Quest browser supports WebXR; no dev kit is required.

For a real headset on the LAN you need either HTTPS or `adb reverse tcp:5173 tcp:5173` over USB,
which preserves the `localhost` origin and its secure context.

## Data

The Redux API is public and CORS-open, so the browser can call it directly — no local backend
required:

```
https://redux.isu.edu/api/redux/
```

See `docs/data-contract.md` (slice 1) for the reduction JSON shape and its known quirks.
