import { Billboard, Text } from '@react-three/drei'
import {
  buildScene,
  certificateSegments,
  edgeColor,
  type LinkSegment,
  relatedIds,
  resolveLinks,
  type SceneGraph,
  type World,
} from '@redux-vr/layout'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BASE_URL,
  type CatalogItem,
  cachedCatalog,
  DEMO_REDUCTION,
  fetchBundleFor,
  fixtureBundle,
  resolveReduction,
} from '../../api/redux.js'
import { activeElement, useIntents } from '../../interaction.js'
import { ControlPanel, panelHeight, panelWidth } from '../../scene/ControlPanel.js'
import { Correspondences, type LinkDirection } from '../../scene/Correspondences.js'
import { FormulaWorld } from '../../scene/FormulaWorld.js'
import { GraphWorld } from '../../scene/GraphWorld.js'
import type { SceneExtent } from '../../scene/Staged.js'
import { FONT_URL } from '../../scene/typography.js'
import { PARAMS } from '../../shell/params.js'
import { SceneShell } from '../../shell/SceneShell.js'

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

const REDUCTION = PARAMS.reduction ?? DEMO_REDUCTION

const INITIAL_MODE: Mode = (() => {
  const m = PARAMS.mode
  return m && m in MODES ? (m as Mode) : 'reduction'
})()

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

/** Below the worlds and toward the viewer, so the panel never sits inside them. */
function panelAnchor(worlds: World[], open: boolean): [number, number, number] {
  const xs = worlds.map((w) => w.origin[0] + w.bounds.max[0] * w.scale)
  const xn = worlds.map((w) => w.origin[0] + w.bounds.min[0] * w.scale)
  const ys = worlds.map((w) => w.origin[1] + w.bounds.min[1] * w.scale)
  const zs = worlds.map((w) => w.origin[2] + w.bounds.max[2] * w.scale)
  const cx = (Math.min(...xn) + Math.max(...xs)) / 2
  return [cx, Math.min(...ys) - 2.4 - panelHeight(open) / 2, Math.max(...zs) + 0.8]
}

function panelCorners(worlds: World[], open: boolean) {
  const [x, y, z] = panelAnchor(worlds, open)
  const w = panelWidth(open) / 2
  const h = panelHeight(open) / 2
  return [[x - w, y - h, z] as const, [x + w, y + h, z] as const]
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
function frameCamera(worlds: World[], aspect: number, menuOpen: boolean) {
  // The panel is scene geometry, so framing must account for it or it falls
  // off-screen exactly when a student reaches for it. With the list open it is
  // framed on its own: fitting a tall menu *and* the worlds shrinks both until
  // the labels are unreadable, and while choosing a reduction the menu is the
  // subject. The worlds stay visible above it.
  const points = menuOpen
    ? panelCorners(worlds, true)
    : [...worldSpacePositions(worlds), ...panelCorners(worlds, false)]
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
    // Reused to normalise the scene to human scale inside a headset.
    extent: { center: center as [number, number, number], width: halfW * 2 } as SceneExtent,
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

export function ReductionActivity() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [mode, setMode] = useState<Mode>(INITIAL_MODE)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [reduction, setReduction] = useState(REDUCTION)
  const [menuOpen, setMenuOpen] = useState(PARAMS.menuOpen)
  const [busy, setBusy] = useState(false)
  const intents = useIntents(PARAMS.focus)

  const buildInto = useCallback((source: string, bundle: Parameters<typeof buildScene>[0]) => {
    setStatus({
      state: 'ready',
      scene: buildScene(bundle, { frameIndex: PARAMS.frame ?? undefined }),
      source,
    })
  }, [])

  // Catalog once: it describes what the backend offers, not what is on screen.
  useEffect(() => {
    if (PARAMS.fixtures) return
    let cancelled = false
    cachedCatalog()
      .then((items) => !cancelled && setCatalog(items))
      .catch((err: Error) => console.warn(`catalog unavailable: ${err.message}`))
    return () => {
      cancelled = true
    }
  }, [])

  // Scene per selected reduction, refetched whenever the choice changes.
  useEffect(() => {
    let cancelled = false

    if (PARAMS.fixtures) {
      buildInto('fixtures', fixtureBundle())
      return () => {
        cancelled = true
      }
    }

    setBusy(true)
    resolveReduction(reduction)
      .then(async (chosen) => {
        const bundle = await fetchBundleFor(chosen)
        if (cancelled) return
        // Clear any pinned element: its ids belong to the previous reduction.
        intents.clear()
        buildInto(`${chosen.source} → ${chosen.target} · ${BASE_URL}`, bundle)
      })
      .catch((err: Error) => {
        if (cancelled) return
        // Falling back rather than failing: a dead API should not blank the demo.
        console.warn(`live API failed (${err.message}); using fixtures`)
        buildInto(`fixtures — live API failed: ${err.message}`, fixtureBundle())
      })
      .finally(() => !cancelled && setBusy(false))

    return () => {
      cancelled = true
    }
    // `intents` is stable by identity per selection; re-running on it would loop.
  }, [reduction, buildInto])

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

  const shown = status.scene.worlds.filter((w) => PARAMS.world === 'both' || w.id === PARAMS.world)
  if (shown.length === 0) return <div className="hud">no world matches ?world={PARAMS.world}</div>

  const linked = PARAMS.world === 'both'
  const view = frameCamera(shown, window.innerWidth / window.innerHeight, linked && menuOpen)
  const graph = shown.find((w) => w.kind === 'graph')
  const solutionCount = graph?.nodes.filter((n) => n.color === 'Solution').length ?? 0
  const available = (Object.keys(MODES) as Mode[]).filter(
    (m) => segmentsForMode(allSegments, m).length > 0,
  )
  const effectiveMode = available.includes(mode) ? mode : (available[0] ?? mode)
  const segments = linked ? segmentsForMode(allSegments, effectiveMode) : []

  return (
    <>
      <SceneShell
        camera={{ position: view.position, fov: FOV }}
        extent={view.extent}
        target={view.center}
        damping={!PARAMS.static}
      >
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
        {linked && (
          <ControlPanel
            title={status.scene.reductionName}
            anchor={panelAnchor(shown, menuOpen)}
            modes={(Object.keys(MODES) as Mode[]).map((m) => ({
              key: m,
              label: MODES[m].label,
              count: segmentsForMode(allSegments, m).length,
            }))}
            activeMode={effectiveMode}
            onMode={(m) => setMode(m as Mode)}
            hint={`${MODES[effectiveMode].hint} · ${segments.length} link${
              segments.length === 1 ? '' : 's'
            }`}
            catalog={catalog}
            currentReduction={reduction}
            onReduction={setReduction}
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            busy={busy}
          />
        )}
      </SceneShell>

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
    </>
  )
}
