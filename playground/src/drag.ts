import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Picking a thing up and putting it down.
 *
 * Deliberately device-agnostic, like `interaction.ts`: nothing here knows about
 * a mouse. The scene feeds it world-space points, and R3F raises the same
 * events from a touch, a mouse, or an XR controller ray — so a headset needs no
 * second implementation.
 *
 * The live drag is held in refs as well as state. State drives the render;
 * the refs let `release` be genuinely idempotent, which matters because a
 * pointerup fires on the scene *and* bubbles to the window safety net, and a
 * stale closure would otherwise drop the same block twice.
 */

export type Point3 = [number, number, number]

export interface Held {
  id: string
  point: Point3
}

export interface Drag {
  held: Held | null
  grab: (id: string, at: Point3) => void
  moveTo: (at: Point3) => void
  release: () => void
}

export function useDrag(onDrop: (id: string, at: Point3) => void): Drag {
  const liveId = useRef<string | null>(null)
  const livePoint = useRef<Point3 | null>(null)
  const [held, setHeld] = useState<Held | null>(null)

  const grab = useCallback((id: string, at: Point3) => {
    liveId.current = id
    livePoint.current = at
    setHeld({ id, point: at })
  }, [])

  const moveTo = useCallback((at: Point3) => {
    const id = liveId.current
    if (!id) return
    livePoint.current = at
    setHeld({ id, point: at })
  }, [])

  const release = useCallback(() => {
    const id = liveId.current
    const at = livePoint.current
    liveId.current = null
    livePoint.current = null
    if (!id || !at) return
    setHeld(null)
    onDrop(id, at)
  }, [onDrop])

  // A pointer released outside the canvas — or cancelled by the browser — never
  // reaches the scene, and would otherwise leave a block stuck to the cursor.
  useEffect(() => {
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [release])

  return { held, grab, moveTo, release }
}
