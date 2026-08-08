import { describe, expect, it } from 'vitest'
import { encodeCertificate, itemsOf, parseInstance } from '../src/instance.js'
import { emptyPlacement, place } from '../src/placement.js'
import type { BinPackingInstance } from '../src/types.js'

/** The instance the Redux UI ships for BINPACKING. */
const DEFAULT = '((4,7,3,6,2,8),10,3)'

describe('parseInstance', () => {
  it('reads the backend default instance', () => {
    expect(parseInstance(DEFAULT)).toEqual({
      sizes: [4, 7, 3, 6, 2, 8],
      capacity: 10,
      binLimit: 3,
    })
  })

  it('ignores whitespace, as Redux_GUI does', () => {
    expect(parseInstance(' ( (4, 7, 3), 10, 2 ) ')).toEqual({
      sizes: [4, 7, 3],
      capacity: 10,
      binLimit: 2,
    })
  })

  it('keeps repeated sizes as separate items', () => {
    // Two 5s are two blocks, not one. Items are identified by position.
    expect(parseInstance('((5,5),10,1)').sizes).toEqual([5, 5])
  })

  it('accepts a single item', () => {
    expect(parseInstance('((4),10,1)').sizes).toEqual([4])
  })

  it.each([
    ['not a tuple at all', 'hello'],
    ['a missing item list', '(10,3)'],
    ['a missing field', '((4,7),10)'],
    ['nested parentheses in the list', '(((4),7),10,3)'],
    ['a trailing field', '((4,7),10,3,1)'],
    ['an empty list', '((),10,3)'],
  ])('rejects %s', (_why, bad) => {
    expect(() => parseInstance(bad)).toThrow(/bin packing/)
  })

  it.each([
    ['a zero size', '((4,0),10,3)'],
    ['a negative size', '((4,-2),10,3)'],
    ['a fractional size', '((4,2.5),10,3)'],
    ['a zero capacity', '((4,2),0,3)'],
    ['a zero bin limit', '((4,2),10,0)'],
  ])('rejects %s', (_why, bad) => {
    expect(() => parseInstance(bad)).toThrow(/positive whole number/)
  })

  it('names the offending value so a student can see what broke', () => {
    expect(() => parseInstance('((4,x),10,3)')).toThrow(/"x"/)
  })
})

describe('encodeCertificate', () => {
  const instance: BinPackingInstance = parseInstance(DEFAULT)
  const items = itemsOf(instance)

  /** Pack by item index, one array of indices per bin. */
  const pack = (bins: number[][]) =>
    bins.reduce(
      (acc, indices, binIndex) =>
        indices.reduce((p, i) => place(instance, p, items[i]?.id ?? '', binIndex), acc),
      emptyPlacement(instance),
    )

  it('writes sizes in the shape BinPackingVerifier reads', () => {
    // FFD's answer for this instance: 8+2, 7+3, 6+4.
    const placement = pack([
      [5, 4],
      [1, 2],
      [3, 0],
    ])
    expect(encodeCertificate(instance, placement)).toBe('((8,2),(7,3),(6,4))')
  })

  it('drops empty bins, since the verifier counts only non-empty ones against K', () => {
    const placement = pack([[5, 4], [], [3]])
    expect(encodeCertificate(instance, placement)).toBe('((8,2),(6))')
  })

  it('encodes nothing placed as the backend\'s own "no solution"', () => {
    expect(encodeCertificate(instance, emptyPlacement(instance))).toBe('')
  })

  it('wraps a single used bin', () => {
    expect(encodeCertificate(instance, pack([[0]]))).toBe('((4))')
  })

  it('reports stack order, which the verifier ignores', () => {
    expect(encodeCertificate(instance, pack([[4, 5]]))).toBe('((2,8))')
    expect(encodeCertificate(instance, pack([[5, 4]]))).toBe('((8,2))')
  })

  it('carries every item exactly once when everything is placed', () => {
    const placement = pack([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    const encoded = encodeCertificate(instance, placement)
    const sizes = [...encoded.matchAll(/\d+/g)].map((m) => Number(m[0])).sort((a, b) => a - b)
    expect(sizes).toEqual([...instance.sizes].sort((a, b) => a - b))
  })
})
