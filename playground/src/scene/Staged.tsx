import { OrbitControls } from '@react-three/drei'
import { useXR } from '@react-three/xr'
import type { ReactNode } from 'react'
import { type SceneExtent, type StagePosture, stageTransform, XR_STAGE } from '../xr.js'

export type { SceneExtent }

/**
 * Place the scene for whoever is looking at it.
 *
 * Flat, the camera is fitted to the content and the content sits at its natural
 * coordinates. In a headset one unit is one metre, so a scene twenty units wide
 * would be a twenty-metre wall — the same geometry has to be normalised to human
 * scale and put at a comfortable distance instead.
 *
 * Only the placement differs. The scene itself is identical in both, which is the
 * point: VR is a way of viewing this, not a separate build of it.
 */
export function Staged({
  extent,
  posture = 'wall',
  force,
  children,
}: {
  extent: SceneExtent
  /** A diagram to stand back from, or a board to look down into. */
  posture?: StagePosture
  /** Apply the headset placement outside a session, for inspection. */
  force?: boolean
  children: ReactNode
}) {
  const session = useXR((s) => s.session)
  if (!session && !force) return <>{children}</>

  const { scale, position } = stageTransform(extent, XR_STAGE[posture])
  return (
    <group scale={scale} position={position}>
      {children}
    </group>
  )
}

/** Orbit controls belong to the mouse; in a session the headset is the camera. */
export function FlatControls({
  target,
  damping,
}: {
  target: [number, number, number]
  damping: boolean
}) {
  const session = useXR((s) => s.session)
  if (session) return null
  return <OrbitControls enableDamping={damping} makeDefault target={target} />
}
