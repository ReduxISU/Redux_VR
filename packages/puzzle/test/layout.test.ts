import { describe, expect, it } from 'vitest'
import { parseInstance } from '../src/instance.js'
import { binAt, layoutPuzzle, PUZZLE, restingPositions } from '../src/layout.js'
import { emptyPlacement, place } from '../src/placement.js'

const instance = parseInstance('((4,7,3,6,2,8),10,3)')
const layout = layoutPuzzle(instance)

describe('layoutPuzzle', () => {
  it('opens one container per bin limit', () => {
    expect(layout.bins.map((b) => b.id)).toEqual(['b0', 'b1', 'b2'])
  })

  it('scales bin height to capacity, so the scale up the side means something', () => {
    for (const bin of layout.bins) expect(bin.height).toBeCloseTo(10 * PUZZLE.unit, 8)
  })

  it('scales block height to size, and nothing else', () => {
    for (const item of layout.items) {
      expect(item.height).toBeCloseTo(item.size * PUZZLE.unit, 8)
      // 1-D packing: the other two dimensions carry no information, so they are
      // the same for every block whatever its size.
      expect(item.width).toBe(layout.items[0]?.width)
      expect(item.depth).toBe(item.width)
    }
  })

  it('makes blocks narrower than the containers, so one sits visibly inside', () => {
    for (const item of layout.items) {
      expect(item.width).toBeLessThan(layout.bins[0]?.width as number)
    }
  })

  it('centres the bin row on the origin and spaces it evenly', () => {
    const xs = layout.bins.map((b) => b.position[0])
    expect(xs.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8)
    expect(xs[1] - (xs[0] as number)).toBeCloseTo(PUZZLE.footprint + PUZZLE.binGap, 8)
    expect(xs[2] - (xs[1] as number)).toBeCloseTo(PUZZLE.footprint + PUZZLE.binGap, 8)
  })

  it('stands the bins on the floor', () => {
    for (const bin of layout.bins) expect(bin.position[1]).toBe(0)
  })

  it('rests every block on the floor of the tray, in front of the bins', () => {
    for (const item of layout.items) {
      const slot = layout.tray[item.id]
      expect(slot).toBeDefined()
      expect(slot?.[1]).toBeCloseTo(item.height / 2, 8)
      expect(slot?.[2]).toBeGreaterThan(0)
    }
  })

  it('lays a classroom-sized instance out in a single line', () => {
    expect(new Set(Object.values(layout.tray).map((s) => s[2])).size).toBe(1)
  })

  it('wraps a large instance rather than running off sideways', () => {
    const big = layoutPuzzle(parseInstance(`((${Array(14).fill(3).join(',')}),10,5)`))
    const rows = [...new Set(Object.values(big.tray).map((s) => s[2]))].sort((a, b) => a - b)
    expect(rows.length).toBeGreaterThan(1)
    // Rows further apart than columns, or a tall block hides the one behind it.
    expect((rows[1] as number) - (rows[0] as number)).toBeGreaterThan(
      PUZZLE.footprint + PUZZLE.trayGap,
    )
  })

  it('never overlaps two tray slots', () => {
    const slots = Object.values(layout.tray)
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const [a, b] = [slots[i], slots[j]]
        const apart =
          Math.abs((a?.[0] as number) - (b?.[0] as number)) >= PUZZLE.footprint ||
          Math.abs((a?.[2] as number) - (b?.[2] as number)) >= PUZZLE.footprint
        expect(apart).toBe(true)
      }
    }
  })

  it('bounds everything it laid out', () => {
    const { min, max } = layout.bounds
    for (const bin of layout.bins) {
      expect(bin.position[1] + bin.height).toBeLessThanOrEqual(max[1] + 1e-9)
    }
    for (const slot of Object.values(layout.tray)) {
      for (let i = 0; i < 3; i++) {
        expect(slot[i] as number).toBeGreaterThanOrEqual((min[i] as number) - 1e-9)
        expect(slot[i] as number).toBeLessThanOrEqual((max[i] as number) + 1e-9)
      }
    }
  })

  it('is deterministic', () => {
    expect(layoutPuzzle(instance)).toEqual(layoutPuzzle(instance))
  })

  it('handles a one-bin one-item instance without dividing by zero', () => {
    const tiny = layoutPuzzle(parseInstance('((3),5,1)'))
    expect(tiny.bins[0]?.position[0]).toBe(0)
    expect(Object.values(tiny.tray).flat().every(Number.isFinite)).toBe(true)
  })
})

describe('restingPositions', () => {
  it('gives every item somewhere to be', () => {
    const at = restingPositions(layout, emptyPlacement(instance))
    for (const item of layout.items) expect(at[item.id]).toEqual(layout.tray[item.id])
  })

  it('stacks blocks flush, so a full bin reads as a solid column', () => {
    let p = emptyPlacement(instance)
    p = place(instance, p, 'i5', 0) // size 8
    p = place(instance, p, 'i4', 0) // size 2
    const at = restingPositions(layout, p)
    const [lower, upper] = [layout.items[5], layout.items[4]]

    expect(at.i5?.[1]).toBeCloseTo((lower?.height as number) / 2, 8)
    const lowerTop = (at.i5?.[1] as number) + (lower?.height as number) / 2
    expect((at.i4?.[1] as number) - (upper?.height as number) / 2).toBeCloseTo(lowerTop, 8)
  })

  it('parks a placed block over its own bin', () => {
    const p = place(instance, emptyPlacement(instance), 'i1', 2)
    const at = restingPositions(layout, p)
    expect(at.i1?.[0]).toBeCloseTo(layout.bins[2]?.position[0] as number, 8)
    expect(at.i1?.[2]).toBeCloseTo(layout.bins[2]?.position[2] as number, 8)
  })

  it('lets an overfilled bin stick out of the top, rather than hiding it', () => {
    // The block poking above the capacity line is the "it does not fit" moment.
    let p = emptyPlacement(instance)
    for (const id of ['i0', 'i1', 'i2', 'i3', 'i4', 'i5']) p = place(instance, p, id, 0)
    const top = Math.max(
      ...layout.items.map((i) => (restingPositions(layout, p)[i.id]?.[1] as number) + i.height / 2),
    )
    expect(top).toBeGreaterThan(layout.bins[0]?.height as number)
  })

  it('returns a block to the slot it left', () => {
    const before = restingPositions(layout, emptyPlacement(instance))
    const p = place(instance, emptyPlacement(instance), 'i2', 1)
    const after = restingPositions(layout, { bins: p.bins.map((b) => b.filter((i) => i !== 'i2')) })
    expect(after.i2).toEqual(before.i2)
  })
})

describe('binAt', () => {
  const centre = (i: number) => layout.bins[i]?.position as [number, number, number]

  it('catches a block let go right over a container', () => {
    for (const bin of layout.bins) {
      expect(binAt(layout, [bin.position[0], 9, bin.position[2]])).toBe(bin.index)
    }
  })

  it('ignores height, so carry height never matters', () => {
    const [x, , z] = centre(1)
    for (const y of [0, 1.2, 50]) expect(binAt(layout, [x, y, z])).toBe(1)
  })

  it('leaves no dead gap between neighbouring containers', () => {
    const [x0] = centre(0)
    const [x1] = centre(1)
    const between = binAt(layout, [(x0 + x1) / 2, 1.2, 0])
    expect(between === 0 || between === 1).toBe(true)
  })

  it('snaps to the nearer container when let go in a gap', () => {
    const [x0] = centre(0)
    const [x1] = centre(1)
    expect(binAt(layout, [x0 + (x1 - x0) * 0.3, 1.2, 0])).toBe(0)
    expect(binAt(layout, [x0 + (x1 - x0) * 0.7, 1.2, 0])).toBe(1)
  })

  it('does not claim a block dropped back on the tray', () => {
    for (const slot of Object.values(layout.tray)) {
      expect(binAt(layout, [slot[0], 1.2, slot[2]])).toBeUndefined()
    }
  })

  it('does not claim a block dropped well past the end of the row', () => {
    const [xEnd] = centre(2)
    expect(binAt(layout, [xEnd + PUZZLE.footprint * 3, 1.2, 0])).toBeUndefined()
  })
})
