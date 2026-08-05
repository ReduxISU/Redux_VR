export const LAYOUT_VERSION = '0.1.0'

export type { ClusterLayout, ClusterLayoutOptions, GroupFrame } from './clique.js'
export { boundingRadius, boundsOf, centroid, layoutClusters } from './clique.js'
export { edgeColor, nodeColor, PALETTE } from './colors.js'
export type { LinkSegment } from './links.js'
export { certificateSegments, relatedIds, resolveLinks, worldPoint } from './links.js'
export { dedupeLinks, groupsFromGadgets, groupsFromNameSuffix, resolveGroups } from './parse.js'
export type { FormulaLayout, FormulaLayoutOptions, Shelf } from './sat3.js'
export { layoutFormula } from './sat3.js'
export type { BuildOptions } from './scene.js'
export { buildScene } from './scene.js'
export * from './types.js'

/** Deterministic PRNG. Layout must never call Math.random(). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
