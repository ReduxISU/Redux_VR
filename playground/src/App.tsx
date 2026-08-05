import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { boundingRadius, buildScene, type SceneGraph, type World } from '@redux-xvr/layout'
import { useEffect, useState } from 'react'
import { BASE_URL, DEMO_INSTANCE, fetchBundle, fixtureBundle } from './api/redux.js'
import { GraphWorld } from './scene/GraphWorld.js'

const params = new URLSearchParams(window.location.search)
const STATIC = params.get('static') === '1'
const USE_FIXTURES = params.get('source') === 'fixtures'
const FRAME = params.get('frame')

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
  | {
      state: 'ready'
      scene: SceneGraph
      source: string
    }

const FOV = 45
/** Slack around the bounding sphere so labels and group hulls aren't clipped. */
const FRAMING_MARGIN = 1.18

/** Frame the camera to the scene instead of hardcoding a distance, so instances
 *  of any size fill the viewport. */
function frameCamera(world: World) {
  const { min, max } = world.bounds
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  const radius = boundingRadius(
    world.nodes.map((n) => n.position),
    center,
  )
  const distance = ((radius || 1) * FRAMING_MARGIN) / Math.sin((FOV * Math.PI) / 360)
  // Slightly above and off-axis: reveals depth without looking down a symmetry line.
  const dir = [0.82, 0.42, 0.82]
  const len = Math.hypot(dir[0] as number, dir[1] as number, dir[2] as number)
  return {
    center,
    position: [
      center[0] + ((dir[0] as number) / len) * distance,
      center[1] + ((dir[1] as number) / len) * distance,
      center[2] + ((dir[2] as number) / len) * distance,
    ] as [number, number, number],
  }
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

  const world = status.scene.worlds[0]
  if (!world) return <div className="hud">no world in scene</div>

  const solutionCount = world.nodes.filter((n) => n.color === 'Solution').length
  const view = frameCamera(world)

  return (
    <>
      <Canvas camera={{ position: view.position, fov: FOV }}>
        <color attach="background" args={['#12151a']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 8, 4]} intensity={1.6} />
        <directionalLight position={[-6, -3, -5]} intensity={0.35} />
        <GraphWorld world={world} />
        <OrbitControls enableDamping={!STATIC} makeDefault target={view.center} />
        <ReadySignal />
      </Canvas>
      <div className="hud">
        <div>
          <strong>{status.scene.reductionName}</strong>
        </div>
        <div className="dim">
          {world.problemName} · {world.nodes.length} vertices · {world.edges.length} edges ·{' '}
          {world.groups.length} clause groups
        </div>
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
