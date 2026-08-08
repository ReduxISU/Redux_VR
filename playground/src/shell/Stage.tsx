import { useThree } from '@react-three/fiber'
import { type ReactNode, useEffect, useRef } from 'react'
import { FlatControls, Staged } from '../scene/Staged.js'
import type { CameraFit } from './framing.js'

/**
 * An activity's claim on the shared canvas: where the camera goes, what the
 * orbit controls look at, and how the scene is normalised for a headset.
 *
 * Framing has to live here rather than on the canvas, because the canvas now
 * outlives every activity — `<Canvas camera={…}>` is read once, at mount, which
 * would mean whichever scene happened to be first.
 */
export function Stage({
  view,
  fov,
  damping,
  children,
}: {
  view: CameraFit
  fov: number
  damping: boolean
  children: ReactNode
}) {
  const camera = useThree((s) => s.camera)
  const opening = useRef(view)

  /**
   * Placed once, when this activity takes the canvas over.
   *
   * The fit is recomputed on every render — it depends on what is on screen —
   * but reapplying it would drag the camera back each frame and fight the
   * student's own orbiting. After the opening shot the camera is theirs.
   */
  useEffect(() => {
    const [x, y, z] = opening.current.position
    camera.position.set(x, y, z)
    if ('fov' in camera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, fov])

  return (
    <>
      <Staged extent={view.extent}>{children}</Staged>
      <FlatControls target={view.center} damping={damping} />
    </>
  )
}
