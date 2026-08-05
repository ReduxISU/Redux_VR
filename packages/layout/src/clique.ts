import type { Vec3 } from './types.js'

export interface ClusterLayoutOptions {
  /** Radius of each group's ring of members. */
  groupRadius?: number
  /** Distance from origin to each group anchor. Derived from group count if unset. */
  clusterRadius?: number
}

/** Where a group sits and which way its ring faces. */
export interface GroupFrame {
  anchor: Vec3
  normal: Vec3
}

export interface ClusterLayout {
  positions: Map<string, Vec3>
  frames: Map<string, GroupFrame>
}

const UP: Vec3 = [0, 1, 0]

function normalize([x, y, z]: Vec3): Vec3 {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Evenly spaced points on a sphere — used once a ring would get too crowded. */
function fibonacciSphere(count: number, radius: number): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius] as Vec3
  })
}

const RING_MAX_GROUPS = 8
/** Anchor spacing relative to group size. Large enough that groups read as separate
 *  objects rather than one cloud — the partition is the pedagogical content. */
const SEPARATION = 3.6

/** Group anchors: a ring for a few groups, a sphere for many. */
function anchorPositions(count: number, radius: number): Vec3[] {
  if (count > RING_MAX_GROUPS) return fibonacciSphere(count, radius)
  // Quarter-turn phase so the first group sits front-centre rather than off to one
  // side: from a default front view that spreads the rest left and right instead of
  // stacking two of them along the line of sight.
  return Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count + Math.PI / 2
    return [Math.cos(theta) * radius, 0, Math.sin(theta) * radius] as Vec3
  })
}

/**
 * Clause-anchored layout.
 *
 * The reduced graph is not arbitrary: it is k groups with *zero* intra-group
 * edges, so every edge crosses between groups. A generic force-directed layout
 * dissolves that structure into a hairball. Anchoring each group and ringing its
 * members keeps the partition visible — which is the whole pedagogical point,
 * since the clique must contain exactly one vertex per clause.
 *
 * Deterministic by construction: no seed, no relaxation, no Math.random.
 */
export function layoutClusters(
  groups: Map<string, string[]>,
  options: ClusterLayoutOptions = {},
): ClusterLayout {
  const groupRadius = options.groupRadius ?? 0.9
  const count = groups.size
  const clusterRadius =
    options.clusterRadius ??
    Math.max(3, (groupRadius * SEPARATION) / Math.sin(Math.PI / Math.max(count, 2)))

  const positions = new Map<string, Vec3>()
  const frames = new Map<string, GroupFrame>()

  // Only some reductions carry gadget groupings. When there is no partition to
  // preserve — most graph-to-graph reductions map vertices one-to-one — a single
  // ring would read as a flat wheel, so spread the vertices over a sphere instead.
  const only = count === 1 ? [...groups.entries()][0] : undefined
  if (only) {
    const [groupId, members] = only
    const radius = Math.max(1.8, 0.62 * Math.sqrt(members.length) + 0.6)
    const points = fibonacciSphere(members.length, radius)
    members.forEach((id, i) => positions.set(id, points[i] ?? ([0, 0, 0] as Vec3)))
    frames.set(groupId, { anchor: [0, 0, 0], normal: [0, 0, 1] })
    return { positions, frames }
  }

  const anchors = anchorPositions(count, clusterRadius)

  let g = 0
  for (const [groupId, members] of groups) {
    const anchor = anchors[g] ?? ([0, 0, 0] as Vec3)
    g += 1

    // Ring lies in the plane facing the anchor's radial direction, so each group
    // reads face-on from an orbiting camera instead of edge-on.
    const radial = normalize(anchor[0] === 0 && anchor[2] === 0 ? [0, 0, 1] : anchor)
    const u = normalize(cross(UP, radial))
    const v = normalize(cross(radial, u))
    frames.set(groupId, { anchor, normal: radial })

    members.forEach((id, j) => {
      if (members.length === 1) {
        positions.set(id, anchor)
        return
      }
      // Start at the top of the ring so member order reads consistently.
      const phi = (2 * Math.PI * j) / members.length + Math.PI / 2
      const c = Math.cos(phi) * groupRadius
      const s = Math.sin(phi) * groupRadius
      positions.set(id, [
        anchor[0] + u[0] * c + v[0] * s,
        anchor[1] + u[1] * c + v[1] * s,
        anchor[2] + u[2] * c + v[2] * s,
      ])
    })
  }

  return { positions, frames }
}

export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0]
  const sum = points.reduce<[number, number, number]>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0],
  )
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

export function boundsOf(points: Vec3[]): { min: Vec3; max: Vec3 } {
  if (points.length === 0) return { min: [0, 0, 0], max: [0, 0, 0] }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i] as number, p[i] as number)
      max[i] = Math.max(max[i] as number, p[i] as number)
    }
  }
  return { min, max }
}

/** Radius of the sphere enclosing `points` about their centroid — used to frame a camera. */
export function boundingRadius(points: Vec3[], about: Vec3): number {
  return points.reduce(
    (max, p) => Math.max(max, Math.hypot(p[0] - about[0], p[1] - about[1], p[2] - about[2])),
    0,
  )
}
