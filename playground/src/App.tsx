import { Billboard, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  buildScene,
  certificateSegments,
  edgeColor,
  type LinkSegment,
  relatedIds,
  resolveLinks,
  type SceneGraph,
  type World,
} from '@redux-xvr/layout'
import { useEffect, useMemo, useState } from 'react'
import {
  BASE_URL,
  type CatalogItem,
  DEMO_REDUCTION,
  fetchBundleFor,
  fetchCatalog,
  fixtureBundle,
} from './api/redux.js'
import { activeElement, useIntents } from './interaction.js'
import { Correspondences, type LinkDirection } from './scene/Correspondences.js'
import { FormulaWorld } from './scene/FormulaWorld.js'
import { GraphWorld } from './scene/GraphWorld.js'
import { FONT_URL } from './scene/typography.js'

const params = new URLSearchParams(window.location.search)
const STATIC = params.get('static') === '1'
const USE_FIXTURES = params.get('source') === 'fixtures'
const FRAME = params.get('frame')
const WORLD = params.get('world') ?? 'both'
const FOCUS = params.get('focus')
const REDUCTION = params.get('reduction') ?? DEMO_REDUCTION

/** Mirrors the switches Redux_GUI already exposes, plus the backward direction. */
const MODES = {
  reduction: {
    label: 'Show reduction',
    // Wording stays family-neutral: the same modes now serve graph-to-graph and
    // formula-to-formula reductions, not just 3SAT to Clique.
    hint: 'group level — each source group becomes a cluster',
    direction: 'forward' as LinkDirection,
  },
  gadgets: {
    label: 'Highlight gadgets',
    hint: 'element level — each source element becomes its counterpart',
    direction: 'forward' as LinkDirection,
  },
  solution: {
    label: 'Map certificate',
    hint: 'the solution maps back to a source certificate',
    direction: 'backward' as LinkDirection,
  },
} as const

type Mode = keyof typeof MODES

const INITIAL_MODE: Mode = (() => {
  const m = params.get('mode')
  return m && m in MODES ? (m as Mode) : 'reduction'
})()

declare global {
  interface Window {
    __sceneReady?: boolean
    __rendererInfo?: string
  }
}

/** Flags the scene as painted so the screenshot tool waits on a fact, not a timer. */
function ReadySignal() {
  const gl = useThree((s) => s.gl)
  const [frames, setFrames] = useState(0)
  useFrame(() => {
    if (frames > 2) return
    setFrames((n) => n + 1)
    if (frames !== 2) return
    const ctx = gl.getContext()
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
    window.__rendererInfo = dbg
      ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : 'unknown renderer'
    window.__sceneReady = true
  })
  return null
}

type Status =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; scene: SceneGraph; source: string }

const FOV = 45
/** Slack so labels, hulls and tokens aren't clipped at the edges. */
const FRAMING_MARGIN = 1.28
/** Near-frontal: the formula panel is meant to be read face-on, and a strong
 *  sideways angle shears the graph's near hull across it. */
const VIEW_DIR: [number, number, number] = [0.12, 0.44, 1]

/**
 * Captioned below and in front of its world, like a figure caption.
 *
 * Below, because above collides with the HUD. In *front* — at the world's near
 * face rather than its centre — because a spatial world has depth, and a caption
 * at mid-depth renders buried inside the geometry.
 */
function titleAnchor(world: World): [number, number, number] {
  return [
    world.origin[0] + ((world.bounds.min[0] + world.bounds.max[0]) / 2) * world.scale,
    world.origin[1] + world.bounds.min[1] * world.scale - 1.05,
    world.origin[2] + world.bounds.max[2] * world.scale + 0.6,
  ]
}

function worldSpacePositions(worlds: World[]) {
  return worlds.flatMap((w) => [
    ...w.nodes.map(
      (n) =>
        [
          n.position[0] * w.scale + w.origin[0],
          n.position[1] * w.scale + w.origin[1],
          n.position[2] * w.scale + w.origin[2],
        ] as const,
    ),
    // Include the caption so framing never clips it.
    titleAnchor(w) as readonly [number, number, number],
  ])
}

type V3 = readonly [number, number, number]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * Frame the camera to whatever is actually rendered.
 *
 * Fits the bounding *box* in view space rather than a bounding sphere: two worlds
 * side by side form a wide, shallow slab, and a sphere around that is far larger
 * than the content — fitting the sphere leaves everything small. This also uses
 * the viewport aspect, so the horizontal budget is spent rather than wasted.
 */
function frameCamera(worlds: World[], aspect: number) {
  const points = worldSpacePositions(worlds)
  const axis = (i: number) => points.map((p) => p[i] as number)
  const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2
  const center: V3 = [mid(axis(0)), mid(axis(1)), mid(axis(2))]

  const forward = unit(VIEW_DIR)
  const right = unit(cross([0, 1, 0], forward))
  const up = cross(forward, right)

  let halfW = 0
  let halfH = 0
  let halfD = 0
  for (const p of points) {
    const v = sub(p, center)
    halfW = Math.max(halfW, Math.abs(dot(v, right)))
    halfH = Math.max(halfH, Math.abs(dot(v, up)))
    halfD = Math.max(halfD, Math.abs(dot(v, forward)))
  }

  const tanY = Math.tan((FOV * Math.PI) / 360)
  const tanX = tanY * aspect
  const distance =
    Math.max((halfH * FRAMING_MARGIN) / tanY, (halfW * FRAMING_MARGIN) / tanX, 1) + halfD

  return {
    center: center as [number, number, number],
    position: [
      center[0] + forward[0] * distance,
      center[1] + forward[1] * distance,
      center[2] + forward[2] * distance,
    ] as [number, number, number],
  }
}

function WorldTitle({ world }: { world: World }) {
  return (
    <Billboard position={titleAnchor(world)}>
      <Text
        font={FONT_URL}
        fontSize={0.42}
        color="#e7ecf3"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#0b0e12"
      >
        {world.problemName}
      </Text>
    </Billboard>
  )
}

function segmentsForMode(all: LinkSegment[], mode: Mode): LinkSegment[] {
  if (mode === 'solution') return certificateSegments(all)
  if (mode === 'gadgets') return all.filter((s) => s.kind !== 'ClauseHighlight')
  return all.filter((s) => s.kind === 'ClauseHighlight')
}

export function App() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [mode, setMode] = useState<Mode>(INITIAL_MODE)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const intents = useIntents(FOCUS)

  useEffect(() => {
    let cancelled = false

    const build = (source: string) => (bundle: Parameters<typeof buildScene>[0]) => {
      if (cancelled) return
      const frameIndex = FRAME === null ? undefined : Number(FRAME)
      setStatus({ state: 'ready', scene: buildScene(bundle, { frameIndex }), source })
    }

    if (USE_FIXTURES) {
      build('fixtures')(fixtureBundle())
      return () => {
        cancelled = true
      }
    }

    fetchCatalog()
      .then(async (items) => {
        if (cancelled) return
        setCatalog(items)
        const chosen = items.find((i) => i.className === REDUCTION) ?? items[0]
        if (!chosen) throw new Error('catalog is empty')
        if (chosen.capability.state === 'unsupported') {
          throw new Error(`${chosen.className}: ${chosen.capability.reason}`)
        }
        build(`${chosen.source} → ${chosen.target} · ${BASE_URL}`)(await fetchBundleFor(chosen))
      })
      .catch((err: Error) => {
        // Falling back rather than failing: a dead API should not blank the demo.
        console.warn(`live API failed (${err.message}); using fixtures`)
        build(`fixtures — live API failed: ${err.message}`)(fixtureBundle())
      })

    return () => {
      cancelled = true
    }
  }, [])

  const scene = status.state === 'ready' ? status.scene : null
  const allSegments = useMemo(() => (scene ? resolveLinks(scene) : []), [scene])
  const active = activeElement(intents)
  const highlight = useMemo(() => {
    if (!scene || !active) return undefined
    const set = relatedIds(scene, active)
    set.add(active)
    return set
  }, [scene, active])

  if (status.state === 'loading') return <div className="hud">loading reduction…</div>
  if (status.state === 'error') return <div className="hud">error: {status.message}</div>

  const shown = status.scene.worlds.filter((w) => WORLD === 'both' || w.id === WORLD)
  if (shown.length === 0) return <div className="hud">no world matches ?world={WORLD}</div>

  const view = frameCamera(shown, window.innerWidth / window.innerHeight)
  const graph = shown.find((w) => w.kind === 'graph')
  const solutionCount = graph?.nodes.filter((n) => n.color === 'Solution').length ?? 0
  const linked = WORLD === 'both'
  const available = (Object.keys(MODES) as Mode[]).filter(
    (m) => segmentsForMode(allSegments, m).length > 0,
  )
  const effectiveMode = available.includes(mode) ? mode : (available[0] ?? mode)
  const segments = linked ? segmentsForMode(allSegments, effectiveMode) : []

  return (
    <>
      <Canvas camera={{ position: view.position, fov: FOV }}>
        <color attach="background" args={['#12151a']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 8, 6]} intensity={1.5} />
        <directionalLight position={[-6, -3, -5]} intensity={0.35} />
        {shown.map((world) => (
          <group key={world.id}>
            {world.kind === 'formula' ? (
              <FormulaWorld world={world} intents={intents} highlight={highlight} />
            ) : (
              <GraphWorld world={world} intents={intents} highlight={highlight} />
            )}
            <WorldTitle world={world} />
          </group>
        ))}
        <Correspondences
          segments={segments}
          direction={MODES[effectiveMode].direction}
          emphasised={highlight}
          accent={effectiveMode === 'solution' ? edgeColor('Solution') : undefined}
        />
        <OrbitControls enableDamping={!STATIC} makeDefault target={view.center} />
        <ReadySignal />
      </Canvas>

      <div className="hud">
        <div>
          <strong>{status.scene.reductionName}</strong>
        </div>
        {shown.map((world) => (
          <div className="dim" key={world.id}>
            {world.problemName} ({world.kind}) · {world.nodes.length}{' '}
            {world.kind === 'formula' ? 'literals' : 'vertices'}
            {world.edges.length > 0 ? ` · ${world.edges.length} edges` : ''} · {world.groups.length}{' '}
            clauses
          </div>
        ))}
        <div className="dim">
          frame {status.scene.frameIndex + 1}/{status.scene.frameCount}
          {solutionCount > 0 ? ` · ${solutionCount}-clique highlighted` : ''} ·{' '}
          {status.scene.links.length} gadgets
        </div>
        <div className="dim">{status.source}</div>
        {catalog.length > 0 && (
          <div className="dim">
            catalog: {catalog.filter((c) => c.capability.state === 'linked').length} linked ·{' '}
            {catalog.filter((c) => c.capability.state === 'unlinked').length} unlinked ·{' '}
            {catalog.filter((c) => c.capability.state === 'unsupported').length} unsupported
          </div>
        )}
      </div>

      {linked && (
        <div className="controls">
          <div className="row">
            {(Object.keys(MODES) as Mode[]).map((m) => {
              // A mode with nothing to draw is disabled rather than silently empty:
              // most reductions publish no group-level gadgets at all.
              const count = segmentsForMode(allSegments, m).length
              return (
                <button
                  type="button"
                  key={m}
                  disabled={count === 0}
                  title={count === 0 ? 'no correspondences of this kind published' : undefined}
                  className={m === effectiveMode ? 'active' : ''}
                  onClick={() => setMode(m)}
                >
                  {MODES[m].label}
                </button>
              )
            })}
          </div>
          <div className="hint">
            {MODES[effectiveMode].hint} · {segments.length} link
            {segments.length === 1 ? '' : 's'}
          </div>
          <div className="hint dim">
            {active
              ? `${active} — click to ${intents.selected === active ? 'unpin' : 'pin'}`
              : 'hover a literal or vertex to trace it'}
          </div>
        </div>
      )}
    </>
  )
}
