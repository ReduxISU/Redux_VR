import { describe, expect, it } from 'vitest'
import { parseInstance } from '../src/instance.js'
import {
  binLoad,
  binOf,
  emptyPlacement,
  isComplete,
  overflowingBins,
  place,
  returnToTray,
  trayItems,
} from '../src/placement.js'

const instance = parseInstance('((4,7,3,6,2,8),10,3)')

describe('emptyPlacement', () => {
  it('opens one bin per bin limit, all empty', () => {
    expect(emptyPlacement(instance).bins).toEqual([[], [], []])
  })

  it('starts with every item in the tray', () => {
    expect(trayItems(instance, emptyPlacement(instance))).toEqual([
      'i0',
      'i1',
      'i2',
      'i3',
      'i4',
      'i5',
    ])
  })
})

describe('place', () => {
  it('moves an item out of the tray and onto a bin', () => {
    const p = place(instance, emptyPlacement(instance), 'i1', 0)
    expect(p.bins[0]).toEqual(['i1'])
    expect(binOf(p, 'i1')).toBe(0)
    expect(trayItems(instance, p)).not.toContain('i1')
  })

  it('stacks in the order the student dropped them', () => {
    let p = emptyPlacement(instance)
    p = place(instance, p, 'i5', 0)
    p = place(instance, p, 'i4', 0)
    expect(p.bins[0]).toEqual(['i5', 'i4'])
  })

  it('never leaves a copy behind when moving between bins', () => {
    let p = place(instance, emptyPlacement(instance), 'i1', 0)
    p = place(instance, p, 'i1', 2)
    expect(p.bins.flat().filter((id) => id === 'i1')).toHaveLength(1)
    expect(binOf(p, 'i1')).toBe(2)
  })

  it('does not mutate the placement it was given', () => {
    const before = emptyPlacement(instance)
    place(instance, before, 'i1', 0)
    expect(before.bins).toEqual([[], [], []])
  })

  it.each([
    ['an unknown id', 'nope', 0],
    ['an item past the end of the instance', 'i99', 0],
    ['a bin past the bin limit', 'i0', 3],
    ['a negative bin', 'i0', -1],
  ])('refuses %s without throwing, returning the same placement', (_why, id, bin) => {
    const before = emptyPlacement(instance)
    expect(place(instance, before, id, bin)).toBe(before)
  })
})

describe('returnToTray', () => {
  it('puts a placed item back', () => {
    const placed = place(instance, emptyPlacement(instance), 'i1', 0)
    const p = returnToTray(placed, 'i1')
    expect(binOf(p, 'i1')).toBeUndefined()
    expect(trayItems(instance, p)).toContain('i1')
  })

  it('keeps the tray in instance order however items came back', () => {
    let p = emptyPlacement(instance)
    p = place(instance, p, 'i0', 0)
    p = place(instance, p, 'i3', 0)
    p = returnToTray(p, 'i3')
    p = returnToTray(p, 'i0')
    expect(trayItems(instance, p)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4', 'i5'])
  })

  it('is identity for an item already in the tray', () => {
    const before = emptyPlacement(instance)
    expect(returnToTray(before, 'i1')).toBe(before)
  })
})

describe('load and overflow', () => {
  const pack = (bins: string[][]) => ({ bins })

  it('sums the sizes in a bin', () => {
    expect(binLoad(instance, pack([['i5', 'i4'], [], []]), 0)).toBe(10)
  })

  it('reports nothing for an empty or unknown bin', () => {
    expect(binLoad(instance, emptyPlacement(instance), 0)).toBe(0)
    expect(binLoad(instance, emptyPlacement(instance), 9)).toBe(0)
  })

  it('flags only bins past capacity, not bins exactly at it', () => {
    // i5+i4 = 10 = capacity; i1+i3 = 13 > capacity.
    const p = pack([['i5', 'i4'], ['i1', 'i3'], []])
    expect(overflowingBins(instance, p)).toEqual([1])
  })

  it('flags nothing on an empty board', () => {
    expect(overflowingBins(instance, emptyPlacement(instance))).toEqual([])
  })
})

describe('isComplete', () => {
  it('is false while anything is still in the tray', () => {
    expect(isComplete(instance, place(instance, emptyPlacement(instance), 'i0', 0))).toBe(false)
  })

  it('is true once every item is in some bin, legal or not', () => {
    // Deliberately illegal — everything crammed into one bin. Completeness is
    // "have you finished arranging", never "is it right".
    const all = { bins: [['i0', 'i1', 'i2', 'i3', 'i4', 'i5'], [], []] }
    expect(isComplete(instance, all)).toBe(true)
    expect(overflowingBins(instance, all)).toEqual([0])
  })
})
