import { type ColoringInstance, coloringEdgeId } from './coloring.js'

/**
 * A map for a colouring instance — the picture students meet the problem in
 * before anyone says the word *graph*.
 *
 * The backend has no geometry: an instance is a set of nodes and a set of
 * pairs. A map is therefore *authored*, and an authored map can lie — draw two
 * regions touching that the instance never joined, and the puzzle on screen
 * stops being the puzzle being verified.
 *
 * So adjacency is never asserted here, only derived. Regions are polygons over
 * an integer lattice, two regions share a border exactly when they share a
 * whole edge of it, and `mapDepicts` refuses any map whose derived adjacency is
 * not precisely the instance's. Meeting at a single corner is not a border,
 * which is what lets separate petals sit around a hub without touching.
 */

export type MapPoint = readonly [number, number]
export type Segment = readonly [MapPoint, MapPoint]

export interface MapRegion {
  id: string
  /** Closed ring of lattice points, in order. The last joins back to the first. */
  polygon: MapPoint[]
}

export interface ColoringMap {
  id: string
  regions: MapRegion[]
}

function walls(region: MapRegion): Segment[] {
  const n = region.polygon.length
  return region.polygon.map((p, i) => [p, region.polygon[(i + 1) % n] as MapPoint] as Segment)
}

const cross = (a: MapPoint, b: MapPoint) => a[0] * b[1] - a[1] * b[0]
const sub = (a: MapPoint, b: MapPoint): MapPoint => [a[0] - b[0], a[1] - b[1]]

/**
 * Do two walls run along each other for some distance?
 *
 * Overlap rather than equality: neighbours are under no obligation to break a
 * shared border at the same points, and a rule that demanded it would quietly
 * *miss* a border whenever one side happened to carry an extra vertex. Length
 * must be positive, so meeting at a single corner does not count — which is
 * what lets four petals ring a hub without touching each other.
 *
 * Exact, because the lattice is integers.
 */
function overlap([p1, p2]: Segment, [q1, q2]: Segment): boolean {
  const d = sub(p2, p1)
  if (cross(d, sub(q1, p1)) !== 0 || cross(d, sub(q2, p1)) !== 0) return false

  const axis = Math.abs(d[0]) >= Math.abs(d[1]) ? 0 : 1
  const [a1, a2] = [p1[axis], p2[axis]].sort((x, y) => x - y) as [number, number]
  const [b1, b2] = [q1[axis], q2[axis]].sort((x, y) => x - y) as [number, number]
  return Math.min(a2, b2) - Math.max(a1, b1) > 0
}

export function mapCentroid(region: MapRegion): MapPoint {
  const n = region.polygon.length || 1
  const sum = region.polygon.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / n, sum[1] / n]
}

/** The stretch two walls share, if any — the border itself, not just its existence. */
function overlapSegment(x: Segment, y: Segment): Segment | undefined {
  if (!overlap(x, y)) return undefined
  const d = sub(x[1], x[0])
  const axis = Math.abs(d[0]) >= Math.abs(d[1]) ? 0 : 1
  const ends = [...x, ...y].slice().sort((p, q) => p[axis] - q[axis]) as MapPoint[]
  // Collinear and overlapping, so the middle two endpoints bound the shared run.
  return [ends[1] as MapPoint, ends[2] as MapPoint]
}

/**
 * Where two regions actually touch.
 *
 * Lets the border between a clashing pair be marked on the map itself, rather
 * than only on the graph it lifts into — the wall is what a student is looking
 * at when the regions are still flat.
 */
export function mapBorder(map: ColoringMap, a: string, b: string): Segment | undefined {
  const first = map.regions.find((r) => r.id === a)
  const second = map.regions.find((r) => r.id === b)
  if (!first || !second) return undefined
  for (const x of walls(first)) {
    for (const y of walls(second)) {
      const shared = overlapSegment(x, y)
      if (shared) return shared
    }
  }
  return undefined
}

/** Every pair of regions whose outlines run along each other for some distance. */
export function mapAdjacency(map: ColoringMap): Set<string> {
  const outlines = map.regions.map((r) => [r, walls(r)] as const)
  const found = new Set<string>()
  for (let i = 0; i < outlines.length; i++) {
    for (let j = i + 1; j < outlines.length; j++) {
      const [a, aw] = outlines[i] as [MapRegion, Segment[]]
      const [b, bw] = outlines[j] as [MapRegion, Segment[]]
      if (aw.some((x) => bw.some((y) => overlap(x, y)))) found.add(coloringEdgeId(a.id, b.id))
    }
  }
  return found
}

/**
 * Does this map draw exactly the instance it claims to?
 *
 * Both directions matter. A missing border would hide a constraint the student
 * is being marked against; an extra one would invent a rule the verifier does
 * not enforce, and the student would be "wrong" about something that was never
 * asked.
 */
export function mapDepicts(instance: ColoringInstance, map: ColoringMap): boolean {
  const regions = map.regions.map((r) => r.id)
  if (regions.length !== instance.nodes.length) return false
  if (!regions.every((id) => instance.nodes.includes(id))) return false

  const drawn = mapAdjacency(map)
  const declared = new Set(instance.edges.map((e) => e.id))
  return drawn.size === declared.size && [...declared].every((id) => drawn.has(id))
}

export function mapBounds(map: ColoringMap): { min: MapPoint; max: MapPoint } {
  const points = map.regions.flatMap((r) => r.polygon)
  if (points.length === 0) return { min: [0, 0], max: [0, 0] }
  return {
    min: [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))],
    max: [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))],
  }
}

/**
 * A hub with four two-part petals around it — the shape of the instance Redux
 * ships for GRAPHCOLORING, where one region touches all eight others and the
 * rest pair up.
 *
 * Each petal runs along one side of the hub and meets its neighbouring petals
 * only at a corner, which is exactly the adjacency the instance declares. The
 * hub is a plain square: two petals share each of its sides, and the overlap
 * rule sees both without the square needing to be broken up to say so.
 */
export const HUB_AND_PETALS: ColoringMap = {
  id: 'hub-and-petals',
  regions: [
    {
      id: 'a',
      polygon: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ],
    },
    {
      id: 'b',
      polygon: [
        [-2, -5],
        [0, -5],
        [0, -2],
        [-2, -2],
      ],
    },
    {
      id: 'c',
      polygon: [
        [0, -5],
        [2, -5],
        [2, -2],
        [0, -2],
      ],
    },
    {
      id: 'd',
      polygon: [
        [2, -2],
        [5, -2],
        [5, 0],
        [2, 0],
      ],
    },
    {
      id: 'e',
      polygon: [
        [2, 0],
        [5, 0],
        [5, 2],
        [2, 2],
      ],
    },
    {
      id: 'f',
      polygon: [
        [-2, 2],
        [0, 2],
        [0, 5],
        [-2, 5],
      ],
    },
    {
      id: 'g',
      polygon: [
        [0, 2],
        [2, 2],
        [2, 5],
        [0, 5],
      ],
    },
    {
      id: 'h',
      polygon: [
        [-5, -2],
        [-2, -2],
        [-2, 0],
        [-5, 0],
      ],
    },
    {
      id: 'i',
      polygon: [
        [-5, 0],
        [-2, 0],
        [-2, 2],
        [-5, 2],
      ],
    },
  ],
}

const MAPS: ColoringMap[] = [HUB_AND_PETALS]

/**
 * The map for this instance, if one of the authored maps genuinely depicts it.
 *
 * Undefined is a normal answer — most instances have no map, and a
 * non-planar one *can* have none. The view falls back to the plain graph
 * rather than drawing something that is not the problem.
 */
export function mapFor(instance: ColoringInstance): ColoringMap | undefined {
  return MAPS.find((map) => mapDepicts(instance, map))
}
