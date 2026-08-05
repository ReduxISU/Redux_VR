import { Billboard, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildScene, type SceneGraph, type World } from '@redux-xvr/layout'
import { useEffect, useState } from 'react'
import { BASE_URL, DEMO_INSTANCE, fetchBundle, fixtureBundle } from './api/redux.js'
import { FormulaWorld } from './scene/FormulaWorld.js'
import { GraphWorld } from './scene/GraphWorld.js'
import { FONT_URL } from './scene/typography.js'

const params = new URLSearchParams(window.location.search)
const STATIC = params.get('static') === '1'
const USE_FIXTURES = params.get('source') === 'fixtures'
const FRAME = params.get('frame')
const WORLD = params.get('world') ?? 'both'

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

function worldSpacePositions(worlds: World[]) {
  return worlds.flatMap((w) =>
    w.nodes.map(
      (n) =>
        [
          n.position[0] * w.scale + w.origin[0],
          n.position[1] * w.scale + w.origin[1],
          n.position[2] * w.scale + w.origin[2],
        ] as const,
    ),
  )
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
    <Billboard
      position={[
        world.origin[0] + ((world.bounds.min[0] + world.bounds.max[0]) / 2) * world.scale,
        world.origin[1] + world.bounds.max[1] * world.scale + 1.2,
        world.origin[2],
      ]}
    >
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

export function App() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

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

    fetchBundle(DEMO_INSTANCE)
      .then(build(BASE_URL))
      .catch((err: Error) => {
        // Falling back rather than failing: a dead API should not blank the demo.
        console.warn(`live API failed (${err.message}); using fixtures`)
        build(`fixtures — live API failed: ${err.message}`)(fixtureBundle())
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status.state === 'loading') return <div className="hud">loading reduction…</div>
  if (status.state === 'error') return <div className="hud">error: {status.message}</div>

  const shown = status.scene.worlds.filter((w) => WORLD === 'both' || w.id === WORLD)
  if (shown.length === 0) return <div className="hud">no world matches ?world={WORLD}</div>

  const view = frameCamera(shown, window.innerWidth / window.innerHeight)
  const graph = shown.find((w) => w.kind === 'graph')
  const solutionCount = graph?.nodes.filter((n) => n.color === 'Solution').length ?? 0

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
              <FormulaWorld world={world} />
            ) : (
              <GraphWorld world={world} />
            )}
            <WorldTitle world={world} />
          </group>
        ))}
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
        <div className="dim">{STATIC ? 'static' : 'drag to orbit · scroll to zoom'}</div>
      </div>
    </>
  )
}
