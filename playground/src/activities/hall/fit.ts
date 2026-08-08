import type { V3 } from '../../shell/framing.js'

export interface Miniature {
  scale: number
  /** Applied after scaling, so the model is centred over its plinth and rests on it. */
  position: [number, number, number]
}

/**
 * Shrink a model onto a plinth top: centred in x and z, standing on y = 0, no
 * wider than `size`. Depth counts too — a shelf of miniatures reads badly if a
 * deep one overhangs its own pedestal.
 */
export function fitOnPlinth(min: V3, max: V3, size: number): Miniature {
  const spread = Math.max(max[0] - min[0], max[2] - min[2], 1e-6)
  const scale = size / spread
  return {
    scale,
    position: [(-(min[0] + max[0]) / 2) * scale, -min[1] * scale, (-(min[2] + max[2]) / 2) * scale],
  }
}
