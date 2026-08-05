import { createXRStore } from '@react-three/xr'
import { useEffect, useState } from 'react'

/**
 * The XR session store.
 *
 * Created once at module scope: a session outlives any component, and recreating
 * the store on re-render would drop it. Controllers get the library's default
 * pointer implementation, which raises ordinary R3F pointer events from the
 * targeting ray — the same events a mouse raises, so `interaction.ts` handles
 * both without branching.
 */
export const xrStore = createXRStore()

export type XRSupport = 'checking' | 'supported' | 'unsupported' | 'insecure'

/**
 * Whether this browser can start an immersive session.
 *
 * `navigator.xr` is only exposed in a secure context. `localhost` counts as one,
 * so local development needs no certificate — but a headset connecting over the
 * LAN does, which is worth reporting distinctly from "no WebXR here at all".
 */
export function useXRSupport(): XRSupport {
  const [support, setSupport] = useState<XRSupport>('checking')

  useEffect(() => {
    const xr = navigator.xr
    if (!xr) {
      setSupport(window.isSecureContext ? 'unsupported' : 'insecure')
      return
    }
    let cancelled = false
    xr.isSessionSupported('immersive-vr')
      .then((ok) => !cancelled && setSupport(ok ? 'supported' : 'unsupported'))
      .catch(() => !cancelled && setSupport('unsupported'))
    return () => {
      cancelled = true
    }
  }, [])

  return support
}

/** Metres. A headset renders in real-world scale; the flat view does not care. */
export const XR_STAGE = {
  /** Width the whole scene is normalised to, like a large wall display. */
  width: 3.0,
  /** Centre height — roughly standing eye level. */
  height: 1.6,
  /** Distance in front of the viewer. */
  distance: 2.5,
} as const

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
  stage: typeof XR_STAGE = XR_STAGE,
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
