import { binId, itemsOf } from './instance.js'
import type {
  BinBody,
  BinPackingInstance,
  ItemBody,
  Placement,
  PuzzleLayout,
  Vec3,
} from './types.js'

/**
 * Where the board sits, in world units.
 *
 * Deliberately the geometry of the classroom kit: a row of open containers with
 * a capacity scale up the side, and the blocks waiting in front of them. The
 * digital twin should be recognisable to a student who packed the plywood one
 * ten minutes earlier.
 */
export const PUZZLE = {
  /** World height of one unit of capacity — a capacity-10 bin stands 3.5 tall. */
  unit: 0.35,
  /** Bins and blocks share a square footprint: in 1-D packing only height means anything. */
  footprint: 1.6,
  binGap: 0.7,
  trayGap: 0.34,
  /** Depth from the bin row to the first tray row. */
  trayOffset: 2.6,
} as const

function binRowWidth(count: number): number {
  return count * PUZZLE.footprint + Math.max(0, count - 1) * PUZZLE.binGap
}

/**
 * Fixed slots, keyed by the item's index rather than its position in a queue.
 * A block pulled out and put back returns to the gap it left, instead of the
 * tray resorting itself under the student's hands.
 */
function trayGrid(items: ItemBody[], rowWidth: number): Record<string, Vec3> {
  const pitch = PUZZLE.footprint + PUZZLE.trayGap
  // About as wide as the bins it feeds, so the two read as one arrangement.
  const cols = Math.max(1, Math.min(items.length, Math.round((rowWidth + PUZZLE.trayGap) / pitch)))

  const slots: Record<string, Vec3> = {}
  items.forEach((item, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, items.length - row * cols)
    slots[item.id] = [
      ((i % cols) - (inRow - 1) / 2) * pitch,
      item.height / 2,
      PUZZLE.trayOffset + row * pitch,
    ]
  })
  return slots
}

/** The board at rest. A bin filled past capacity pokes out of the top of this. */
function boundsOf(bins: BinBody[], items: ItemBody[], tray: Record<string, Vec3>) {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const add = (lo: Vec3, hi: Vec3) => {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i] as number, lo[i] as number)
      max[i] = Math.max(max[i] as number, hi[i] as number)
    }
  }

  for (const bin of bins) {
    const [x, y, z] = bin.position
    const hw = bin.width / 2
    const hd = bin.depth / 2
    add([x - hw, y, z - hd], [x + hw, y + bin.height, z + hd])
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  for (const [id, [x, y, z]] of Object.entries(tray)) {
    const item = byId.get(id)
    if (!item) continue
    const [hw, hh, hd] = [item.width / 2, item.height / 2, item.depth / 2]
    add([x - hw, y - hh, z - hd], [x + hw, y + hh, z + hd])
  }

  const empty: Vec3 = [0, 0, 0]
  return Number.isFinite(min[0]) ? { min, max } : { min: empty, max: empty }
}

export function layoutPuzzle(instance: BinPackingInstance): PuzzleLayout {
  const items: ItemBody[] = itemsOf(instance).map((item) => ({
    ...item,
    width: PUZZLE.footprint,
    depth: PUZZLE.footprint,
    height: item.size * PUZZLE.unit,
  }))

  const pitch = PUZZLE.footprint + PUZZLE.binGap
  const bins: BinBody[] = Array.from({ length: instance.binLimit }, (_, index) => ({
    id: binId(index),
    index,
    position: [(index - (instance.binLimit - 1) / 2) * pitch, 0, 0],
    width: PUZZLE.footprint,
    depth: PUZZLE.footprint,
    height: instance.capacity * PUZZLE.unit,
  }))

  const tray = trayGrid(items, binRowWidth(instance.binLimit))
  return { bins, items, tray, bounds: boundsOf(bins, items, tray) }
}

/**
 * Every item's resting place: its tray slot, or stacked on what is already in
 * its bin. Blocks sit flush on each other, so a full bin reads as a solid
 * column against the capacity scale.
 */
export function restingPositions(layout: PuzzleLayout, placement: Placement): Record<string, Vec3> {
  const byId = new Map(layout.items.map((item) => [item.id, item]))
  const positions: Record<string, Vec3> = { ...layout.tray }

  layout.bins.forEach((bin, index) => {
    let stacked = 0
    for (const id of placement.bins[index] ?? []) {
      const item = byId.get(id)
      if (!item) continue
      positions[id] = [
        bin.position[0],
        bin.position[1] + stacked + item.height / 2,
        bin.position[2],
      ]
      stacked += item.height
    }
  })

  return positions
}
