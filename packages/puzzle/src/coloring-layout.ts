import type { ColoringInstance } from './coloring.js'
import type { Vec3 } from './types.js'

/**
 * Laid out flat, like a map on a table.
 *
 * Nodes are low discs rather than floating spheres: the worksheet arrives at
 * graphs *through* map colouring, so a region you look down on is the closer
 * metaphor — and it leaves the door open for the map to lift into the graph
 * later, which is the one thing this view can do that a flat diagram cannot.
 */
export const COLORING = {
  radius: 0.45,
  height: 0.22,
  /** Arc length each ring node wants, so a big instance grows its ring. */
  pitch: 1.55,
  minRing: 2.6,
  /**
   * A node joined to at least this share of the others goes in the middle.
   * The classic textbook picture of a hub-and-spokes map, and the shape of the
   * instance Redux ships.
   */
  hubShare: 0.7,
} as const

export interface ColoringLayout {
  positions: Record<string, Vec3>
  /** The node at the centre, if the instance has one. */
  hub?: string
  ringRadius: number
  bounds: { min: Vec3; max: Vec3 }
}

function degrees(instance: ColoringInstance): Map<string, number> {
  const count = new Map(instance.nodes.map((n) => [n, 0]))
  for (const e of instance.edges) {
    count.set(e.a, (count.get(e.a) ?? 0) + 1)
    if (e.b !== e.a) count.set(e.b, (count.get(e.b) ?? 0) + 1)
  }
  return count
}

function pickHub(instance: ColoringInstance): string | undefined {
  if (instance.nodes.length < 4) return undefined
  const degree = degrees(instance)
  const best = instance.nodes.reduce((a, b) =>
    (degree.get(b) ?? 0) > (degree.get(a) ?? 0) ? b : a,
  )
  const share = (degree.get(best) ?? 0) / (instance.nodes.length - 1)
  return share >= COLORING.hubShare ? best : undefined
}

export function layoutColoring(instance: ColoringInstance): ColoringLayout {
  const hub = pickHub(instance)
  const ring = instance.nodes.filter((n) => n !== hub)
  const ringRadius = Math.max(COLORING.minRing, (ring.length * COLORING.pitch) / (2 * Math.PI))

  const positions: Record<string, Vec3> = {}
  if (hub) positions[hub] = [0, 0, 0]
  ring.forEach((node, i) => {
    // Start at the back and go round, so the first node is never under the HUD.
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(ring.length, 1)
    positions[node] = [Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius]
  })

  const reach = ringRadius + COLORING.radius
  return {
    positions,
    ...(hub ? { hub } : {}),
    ringRadius,
    bounds: { min: [-reach, 0, -reach], max: [reach, COLORING.height, reach] },
  }
}
