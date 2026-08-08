import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { type ReactNode, useState } from 'react'
import { useXRSupport, type XRSupport, xrStore } from '../xr.js'
import { Hud } from './hud.js'

/**
 * One canvas, for the life of the app.
 *
 * Mounted above the activity switch on purpose: a WebGL context cannot be
 * handed to a new one, so a shell that belonged to each activity took the
 * canvas — and any immersive session — down with it every time a student
 * changed rooms. Framing belongs to the activity and lives in `Stage`; what is
 * here is everything that should outlive it.
 */

declare global {
  interface Window {
    __sceneReady?: boolean
    __rendererInfo?: string
  }
}

/**
 * Flags the canvas as painted so the screenshot tool waits on a fact, not a timer.
 *
 * Note what this does *not* promise now that the canvas outlives any one scene:
 * it fires once, when the canvas first paints, which for an activity that
 * fetches its data is before that data has arrived. Anything data-driven has to
 * be asserted with `--await-text` against the HUD.
 */
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

/**
 * Entering XR needs a real user gesture, and this button must exist *before* the
 * session does — so it is DOM, unlike every other control. It is also the only
 * DOM control left: once the session starts, the overlay is gone and the
 * in-scene panels are the whole interface.
 */
function EnterVR({ support }: { support: XRSupport }) {
  const [failure, setFailure] = useState<string | null>(null)

  const label = {
    checking: 'checking for WebXR…',
    supported: 'Enter VR',
    unsupported: 'No VR headset detected',
    insecure: 'WebXR needs HTTPS or localhost',
  }[support]

  // A session request rejects whenever the user declines the permission prompt or
  // the runtime is unavailable. Unhandled, that surfaces as an uncaught error.
  const enter = () => {
    setFailure(null)
    Promise.resolve(xrStore.enterVR()).catch((err: Error) =>
      setFailure(err.message || 'could not start the session'),
    )
  }

  return (
    <div className="xr-entry">
      <button
        type="button"
        disabled={support !== 'supported'}
        onClick={enter}
        title={
          support === 'unsupported'
            ? 'Install the Immersive Web Emulator extension, or connect a headset'
            : undefined
        }
      >
        {label}
      </button>
      {failure && <div className="xr-error">VR unavailable — {failure}</div>}
    </div>
  )
}

export function SceneShell({ children }: { children: ReactNode }) {
  const xrSupport = useXRSupport()

  return (
    <>
      <Canvas>
        <XR store={xrStore}>
          <color attach="background" args={['#12151a']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[5, 8, 6]} intensity={1.5} />
          <directionalLight position={[-6, -3, -5]} intensity={0.35} />
          {children}
          <ReadySignal />
        </XR>
      </Canvas>

      <EnterVR support={xrSupport} />
      <Hud.Out />
    </>
  )
}
