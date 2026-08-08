import type { SceneExtent } from '../xr.js'

/**
 * Fit a camera to whatever is actually on screen.
 *
 * Fits the bounding *box* in view space rather than a bounding sphere: content
 * laid out side by side forms a wide, shallow slab, and a sphere around that is
 * far larger than the slab itself — fitting the sphere leaves everything small.
 * Uses the real viewport aspect, so the horizontal budget is spent rather than
 * wasted.
 *
 * Shared by every activity: the subjects differ, the arithmetic does not.
 */

export type V3 = readonly [number, number, number]

export interface FitOptions {
  fov: number
  /** Slack so labels and edges are not clipped at the frame. */
  margin: number
  /** Direction from the subject toward the camera. */
  viewDir: V3
}

export interface CameraFit {
  center: [number, number, number]
  position: [number, number, number]
  /** Reused to normalise the scene to human scale inside a headset. */
  extent: SceneExtent
}

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

/** The eight corners of an axis-aligned box, as fit points. */
export function boxCorners(min: V3, max: V3): V3[] {
  const corners: V3[] = []
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) corners.push([x, y, z])
    }
  }
  return corners
}

export function fitCamera(points: V3[], aspect: number, options: FitOptions): CameraFit {
  const origin: [number, number, number] = [0, 0, 0]
  if (points.length === 0) {
    return { center: origin, position: [0, 0, 1], extent: { center: origin, width: 1 } }
  }

  const axis = (i: number) => points.map((p) => p[i] as number)
  const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2
  const center: V3 = [mid(axis(0)), mid(axis(1)), mid(axis(2))]

  const forward = unit(options.viewDir)
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

  const tanY = Math.tan((options.fov * Math.PI) / 360)
  const tanX = tanY * aspect
  const distance =
    Math.max((halfH * options.margin) / tanY, (halfW * options.margin) / tanX, 1) + halfD

  return {
    center: center as [number, number, number],
    position: [
      center[0] + forward[0] * distance,
      center[1] + forward[1] * distance,
      center[2] + forward[2] * distance,
    ],
    extent: { center: center as [number, number, number], width: halfW * 2 },
  }
}
