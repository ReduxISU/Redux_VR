import { createXRStore } from '@react-three/xr'
import { useEffect, useState } from 'react'
import { PARAMS } from './shell/params.js'

/**
 * `?emulate=1` — run on the software headset the XR store bundles.
 *
 * On localhost the store installs an emulated Quest 3 when no real runtime
 * answers, which is the only way to see this project in stereo without
 * hardware. It refuses to install over a *native* runtime, though — and headless
 * Chromium, plus some desktop browsers, expose a `navigator.xr` that exists and
 * supports nothing. The result is neither runtime: the real one can start no
 * session, and the emulator steps aside for it.
 *
 * Hiding the useless one lets the emulator through. Deliberately opt-in and
 * never automatic: doing this where a headset is actually plugged in would take
 * away the very thing it is trying to provide.
 */
if (PARAMS.emulate && typeof navigator !== 'undefined' && navigator.xr != null) {
  Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined })
}

/**
 * The XR session store.
 *
 * Created once at module scope: a session outlives any component, and recreating
 * the store on re-render would drop it. Controllers get the library's default
 * pointer implementation, which raises ordinary R3F pointer events from the
 * targeting ray — the same events a mouse raises, so `interaction.ts` handles
 * both without branching.
 */
export const xrStore = createXRStore({
  /**
   * No synthetic room around the scene.
   *
   * The emulator's environment module ships its own three (0.165) whose renderer
   * calls `material.onBuild`, a hook three 0.185 no longer has — so every
   * emulated session threw on repeat and buried anything real in the noise. The
   * rooms are set dressing for passthrough demos and this scene supplies its own
   * background, so they cost several megabytes of lazily-loaded chunks to hide
   * genuine errors.
   */
  emulate: { syntheticEnvironment: false },
})

export type XRSupport = 'checking' | 'supported' | 'emulated' | 'unsupported' | 'insecure'

/**
 * Whether this browser can start an immersive session, and on what.
 *
 * `navigator.xr` is only exposed in a secure context. `localhost` counts as one,
 * so local development needs no certificate — but a headset connecting over the
 * LAN does, which is worth reporting distinctly from "no WebXR here at all".
 *
 * **Emulated is reported separately from supported, deliberately.** On localhost
 * `createXRStore` installs a software Quest 3 when no real runtime answers, and
 * a session on that proves the scene *runs* in stereo — it says nothing about
 * comfort, reach, or whether text is legible at a real per-eye resolution. A
 * button that said plain "Enter VR" would quietly overstate what has been shown.
 */
export function useXRSupport(): XRSupport {
  const [support, setSupport] = useState<XRSupport>('checking')

  useEffect(() => {
    let cancelled = false

    const check = () => {
      const xr = navigator.xr
      if (!xr) {
        setSupport(window.isSecureContext ? 'unsupported' : 'insecure')
        return
      }
      const emulated = xrStore.getState().emulator != null
      xr.isSessionSupported('immersive-vr')
        .then((ok) => {
          if (!cancelled) setSupport(ok ? (emulated ? 'emulated' : 'supported') : 'unsupported')
        })
        .catch(() => !cancelled && setSupport('unsupported'))
    }

    check()
    // The emulator installs its runtime asynchronously, long after this first
    // check has already concluded there is no headset. Without re-checking when
    // it lands, the entry button stays disabled on the one machine — a developer
    // laptop — where an immersive session is actually available.
    const unsubscribe = xrStore.subscribe((state, previous) => {
      if (state.emulator !== previous.emulator) check()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return support
}

export interface StageConfig {
  /** Width the whole scene is normalised to. */
  width: number
  /** Height of the scene's centre. */
  height: number
  /** Distance in front of the viewer. */
  distance: number
}

/**
 * Metres. A headset renders in real-world scale; the flat view does not care.
 *
 * Two postures, because these scenes are not all the same kind of object. A
 * reduction is a diagram — a wall you stand back from and read. A puzzle board
 * is a *table*: the classroom kit sits on a desk and students look down into
 * the trucks.
 *
 * Staging a table as a wall was the first thing an emulated session showed, and
 * it is badly wrong rather than merely unflattering: a board laid flat on the
 * floor plane, floated to standing eye height and pushed 2.5 m out, is seen
 * edge-on and nearly unreadable, and the control row lands on top of it.
 */
export const XR_STAGE = {
  wall: { width: 3.0, height: 1.6, distance: 2.5 } as StageConfig,
  /**
   * Desk-sized and close, so a standing viewer looks down into it.
   *
   * ⚠️ Sized for an adult. Reach is roughly 0.6–0.7 m, so the far edge of a
   * 1.1 m board is already at the limit — and a ten-year-old's arms are shorter
   * than that. Whether children can reach the back row is a hardware question
   * and one of the reasons this needs a real headset.
   */
  table: { width: 1.1, height: 0.95, distance: 0.62 } as StageConfig,
} as const

export type StagePosture = keyof typeof XR_STAGE

/** Where a staged scene's centre ends up — what a viewer would look at. */
export function stageAnchor(posture: StagePosture): [number, number, number] {
  const stage = XR_STAGE[posture]
  return [0, stage.height, -stage.distance]
}

export interface SceneExtent {
  center: [number, number, number]
  width: number
}

export interface StageTransform {
  scale: number
  position: [number, number, number]
}

/**
 * Normalise the scene to human scale and park it in front of the viewer.
 *
 * In a headset one unit is one metre, so a scene twenty units across would be a
 * twenty-metre wall. The geometry is unchanged — only where and how large it sits.
 *
 * Pure, so the arithmetic is testable even though stereo rendering is not.
 */
export function stageTransform(
  extent: SceneExtent,
  stage: StageConfig = XR_STAGE.wall,
): StageTransform {
  const scale = stage.width / Math.max(extent.width, 1e-6)
  return {
    scale,
    position: [
      -extent.center[0] * scale,
      stage.height - extent.center[1] * scale,
      -stage.distance - extent.center[2] * scale,
    ],
  }
}
