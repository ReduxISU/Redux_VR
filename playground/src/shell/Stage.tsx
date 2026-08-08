import { useThree } from '@react-three/fiber'
import { type ReactNode, useEffect, useRef } from 'react'
import { FlatControls, Staged } from '../scene/Staged.js'
import { type StagePosture, stageAnchor, XR_STAGE } from '../xr.js'
import type { CameraFit } from './framing.js'
import { PARAMS } from './params.js'

/**
 * `?eye=1` — stand where a headset stands.
 *
 * An immersive session renders into the headset's own framebuffer, so a
 * screenshot of the page during one is blank; the questions that matter — is
 * the scene a sane size, is the text readable, can you reach the panel — cannot
 * be answered from inside. This applies the *same* stage transform and puts the
 * camera at the same eye point with a headset-like field of view, on a flat
 * screen where it can be looked at.
 *
 * An approximation of framing, and only that: it says nothing about stereo
 * depth, comfort, or per-eye resolution. Those still need hardware.
 */
const EYE_FOV = 90

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
  posture = 'wall',
  children,
}: {
  view: CameraFit
  fov: number
  damping: boolean
  /** How a headset should present this scene. Flat viewing is unaffected. */
  posture?: StagePosture
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
    const [x, y, z] = PARAMS.eye ? [0, XR_STAGE.wall.height, 0] : opening.current.position
    camera.position.set(x, y, z)
    if ('fov' in camera) {
      camera.fov = PARAMS.eye ? EYE_FOV : fov
      camera.updateProjectionMatrix()
    }
  }, [camera, fov])

  // Looking at where the scene actually ends up, which for a table means
  // looking down at it — exactly the head movement a headset wearer makes.
  const target: [number, number, number] = PARAMS.eye ? stageAnchor(posture) : view.center

  return (
    <>
      <Staged extent={view.extent} posture={posture} force={PARAMS.eye}>
        {children}
      </Staged>
      <FlatControls target={target} damping={damping} />
    </>
  )
}
