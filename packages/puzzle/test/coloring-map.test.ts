import { describe, expect, it } from 'vitest'
import { parseColoring } from '../src/coloring.js'
import {
  type ColoringMap,
  HUB_AND_PETALS,
  mapAdjacency,
  mapBorder,
  mapBounds,
  mapCentroid,
  mapDepicts,
  mapFor,
} from '../src/coloring-map.js'

const DEFAULT =
  '(({a,b,c,d,e,f,g,h,i},{{a,b},{b,c},{a,c},{d,a},{d,e},{a,e},{a,f},{f,g},{g,a},{a,h},{h,i},{i,a}}),3)'
const instance = parseColoring(DEFAULT)

describe('mapAdjacency', () => {
  const drawn = mapAdjacency(HUB_AND_PETALS)

  it('joins two regions that share a whole wall', () => {
    expect(drawn).toContain('a--b')
    expect(drawn).toContain('b--c')
  })

  it('does not join regions that meet at a single corner', () => {
    // The north and east petals touch only at (2,-2). A corner is not a border,
    // which is the whole reason separate petals can ring a hub.
    expect(drawn).not.toContain('c--d')
    expect(drawn).not.toContain('e--g')
    expect(drawn).not.toContain('b--h')
    expect(drawn).not.toContain('f--i')
  })

  it('finds exactly the borders the instance declares, and no others', () => {
    expect([...drawn].sort()).toEqual([...instance.edges.map((e) => e.id)].sort())
  })

  it('sees a border even when the two sides break it up differently', () => {
    // The hub is one square; two petals share each of its sides. Neither side
    // carries the other's vertices, and the border is a border regardless.
    expect(drawn).toContain('a--b')
    expect(drawn).toContain('a--c')
  })

  it('is symmetric — a wall belongs to both its sides', () => {
    const flipped: ColoringMap = {
      ...HUB_AND_PETALS,
      regions: [...HUB_AND_PETALS.regions].reverse(),
    }
    expect([...mapAdjacency(flipped)].sort()).toEqual([...drawn].sort())
  })
})

describe('mapDepicts', () => {
  it('accepts the map authored for this instance', () => {
    expect(mapDepicts(instance, HUB_AND_PETALS)).toBe(true)
  })

  it('rejects a map that invents a border the instance never declared', () => {
    // Slide the east petal over so it shares a wall with the north one.
    const lying: ColoringMap = {
      id: 'lying',
      regions: HUB_AND_PETALS.regions.map((r) =>
        r.id === 'c'
          ? {
              ...r,
              polygon: [
                [0, -5],
                [5, -5],
                [5, -2],
                [0, -2],
              ],
            }
          : r,
      ),
    }
    expect(mapAdjacency(lying)).toContain('c--d')
    expect(mapDepicts(instance, lying)).toBe(false)
  })

  it('rejects a map missing a border the instance does declare', () => {
    const gapped: ColoringMap = {
      id: 'gapped',
      regions: HUB_AND_PETALS.regions.map((r) =>
        r.id === 'b'
          ? {
              ...r,
              polygon: [
                [-2, -9],
                [0, -9],
                [0, -6],
                [-2, -6],
              ],
            }
          : r,
      ),
    }
    expect(mapDepicts(instance, gapped)).toBe(false)
  })

  it('rejects a map for a different instance', () => {
    const other = parseColoring('(({a,b,c},{{a,b}}),3)')
    expect(mapDepicts(other, HUB_AND_PETALS)).toBe(false)
  })
})

describe('mapFor', () => {
  it('finds the authored map for the shipped instance', () => {
    expect(mapFor(instance)?.id).toBe('hub-and-petals')
  })

  it('has no map for an instance nobody drew, rather than inventing one', () => {
    const cycle = parseColoring('(({a,b,c,d,e},{{a,b},{b,c},{c,d},{d,e},{e,a}}),3)')
    expect(mapFor(cycle)).toBeUndefined()
  })
})

describe('geometry helpers', () => {
  it('centres the hub on the origin', () => {
    const hub = HUB_AND_PETALS.regions.find((r) => r.id === 'a')
    expect(mapCentroid(hub as never)).toEqual([0, 0])
  })

  it('puts each petal out on its own side', () => {
    const at = (id: string) => mapCentroid(HUB_AND_PETALS.regions.find((r) => r.id === id) as never)
    expect(at('b')[1]).toBeLessThan(0)
    expect(at('f')[1]).toBeGreaterThan(0)
    expect(at('d')[0]).toBeGreaterThan(0)
    expect(at('h')[0]).toBeLessThan(0)
  })

  it('bounds the whole map', () => {
    expect(mapBounds(HUB_AND_PETALS)).toEqual({ min: [-5, -5], max: [5, 5] })
  })
})

describe('mapBorder', () => {
  it('returns the stretch two regions actually share', () => {
    // b and c meet along x = 0, from z = -5 to z = -2.
    expect(mapBorder(HUB_AND_PETALS, 'b', 'c')).toEqual([
      [0, -5],
      [0, -2],
    ])
  })

  it('returns the same wall whichever side is asked first', () => {
    expect(mapBorder(HUB_AND_PETALS, 'c', 'b')).toEqual(mapBorder(HUB_AND_PETALS, 'b', 'c'))
  })

  it('clips to the shorter side when one region runs past the other', () => {
    // The hub's south side spans x -2..2; f only covers -2..0.
    expect(mapBorder(HUB_AND_PETALS, 'a', 'f')).toEqual([
      [-2, 2],
      [0, 2],
    ])
  })

  it('has nothing for regions that only touch at a corner', () => {
    expect(mapBorder(HUB_AND_PETALS, 'c', 'd')).toBeUndefined()
  })

  it('has nothing for a region that is not on the map', () => {
    expect(mapBorder(HUB_AND_PETALS, 'a', 'zz')).toBeUndefined()
  })
})
