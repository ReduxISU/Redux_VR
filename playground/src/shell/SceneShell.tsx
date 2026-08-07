import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { type ReactNode, useState } from 'react'
import { FlatControls, type SceneExtent, Staged } from '../scene/Staged.js'
import { useXRSupport, type XRSupport, xrStore } from '../xr.js'

/**
 * Everything an activity needs to be looked at, and nothing about what it shows.
 *
 * Canvas, XR session, lighting, stage normalisation, orbit controls and the
 * ready signal are identical for every scene; framing is not, so the activity
 * computes its own camera and hands the result down.
 */

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

/**
 * Entering XR needs a real user gesture, and this button must exist *before* the
 * session does — so it is DOM, unlike every other control. It is also the only
 * DOM control left: once the session starts, the overlay is gone and the in-scene
 * panel is the whole interface.
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

export interface SceneShellProps {
  camera: { position: [number, number, number]; fov: number }
  /** Drives the XR stage transform: one unit is one metre in a headset. */
  extent: SceneExtent
  target: [number, number, number]
  damping: boolean
  children: ReactNode
}

export function SceneShell({ camera, extent, target, damping, children }: SceneShellProps) {
  const xrSupport = useXRSupport()

  return (
    <>
      <Canvas camera={camera}>
        <XR store={xrStore}>
          <color attach="background" args={['#12151a']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[5, 8, 6]} intensity={1.5} />
          <directionalLight position={[-6, -3, -5]} intensity={0.35} />
          <Staged extent={extent}>{children}</Staged>
          <FlatControls target={target} damping={damping} />
          <ReadySignal />
        </XR>
      </Canvas>

      <EnterVR support={xrSupport} />
    </>
  )
}
