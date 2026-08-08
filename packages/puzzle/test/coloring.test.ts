import { describe, expect, it } from 'vitest'
import {
  clearNode,
  coloringConflicts,
  decodeColoringCertificate,
  emptyColoring,
  encodeColoringCertificate,
  isColoringComplete,
  paintNode,
  parseColoring,
  uncolored,
} from '../src/coloring.js'
import { COLORING, layoutColoring } from '../src/coloring-layout.js'

/** The instance Redux ships for GRAPHCOLORING. */
const DEFAULT =
  '(({a,b,c,d,e,f,g,h,i},{{a,b},{b,c},{a,c},{d,a},{d,e},{a,e},{a,f},{f,g},{g,a},{a,h},{h,i},{i,a}}),3)'

const instance = parseColoring(DEFAULT)

describe('parseColoring', () => {
  it('reads the backend default instance', () => {
    expect(instance.nodes).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
    expect(instance.colors).toBe(3)
    expect(instance.edges).toHaveLength(12)
  })

  it('treats an edge as unordered, the way a shared wall is', () => {
    const both = parseColoring('(({a,b},{{a,b},{b,a}}),2)')
    expect(both.edges).toHaveLength(1)
  })

  it('keeps node names that contain spaces intact', () => {
    const cities = parseColoring('(({New York,Chicago},{{New York,Chicago}}),2)')
    expect(cities.nodes).toEqual(['New York', 'Chicago'])
    expect(cities.edges[0]).toMatchObject({ a: 'New York', b: 'Chicago' })
  })

  it.each([
    ['not a tuple at all', 'hello'],
    ['a missing colour limit', '(({a,b},{{a,b}}))'],
    ['a zero colour limit', '(({a,b},{{a,b}}),0)'],
    ['no nodes', '(({},{}),3)'],
    ['a duplicated node', '(({a,a},{}),3)'],
    ['an edge naming an unknown node', '(({a,b},{{a,z}}),3)'],
    ['an edge that is not a pair', '(({a,b,c},{{a,b,c}}),3)'],
  ])('rejects %s', (_why, bad) => {
    expect(() => parseColoring(bad)).toThrow(/graph colouring/)
  })
})

describe('painting', () => {
  it('colours a node and takes it off the to-do list', () => {
    const c = paintNode(instance, emptyColoring(), 'a', 0)
    expect(c.a).toBe(0)
    expect(uncolored(instance, c)).not.toContain('a')
  })

  it('does not mutate what it was given', () => {
    const before = emptyColoring()
    paintNode(instance, before, 'a', 0)
    expect(before).toEqual({})
  })

  it.each([
    ['an unknown node', 'zzz', 0],
    ['a colour past the limit', 'a', 3],
    ['a negative colour', 'a', -1],
  ])('refuses %s without throwing', (_why, node, color) => {
    const before = emptyColoring()
    expect(paintNode(instance, before, node, color)).toBe(before)
  })

  it('clears a node back to uncoloured', () => {
    const c = clearNode(paintNode(instance, emptyColoring(), 'a', 1), 'a')
    expect(c.a).toBeUndefined()
    expect(uncolored(instance, c)).toContain('a')
  })

  it('is identity when clearing something already uncoloured', () => {
    const before = emptyColoring()
    expect(clearNode(before, 'a')).toBe(before)
  })
})

describe('coloringConflicts', () => {
  it('flags a wall whose two sides match', () => {
    // a and b are adjacent.
    let c = paintNode(instance, emptyColoring(), 'a', 0)
    c = paintNode(instance, c, 'b', 0)
    expect(coloringConflicts(instance, c).map((e) => e.id)).toEqual(['a--b'])
  })

  it('says nothing about a wall with an uncoloured side', () => {
    const c = paintNode(instance, emptyColoring(), 'a', 0)
    expect(coloringConflicts(instance, c)).toEqual([])
  })

  it('is silent on a correct colouring', () => {
    const c = decodeColoringCertificate(instance, '{{a},{b,d,f,h},{c,e,g,i}}')
    expect(coloringConflicts(instance, c as Record<string, number>)).toEqual([])
  })
})

describe('isColoringComplete', () => {
  it('is false while anything is uncoloured', () => {
    expect(isColoringComplete(instance, paintNode(instance, emptyColoring(), 'a', 0))).toBe(false)
  })

  it('is true once everything has a colour, right or wrong', () => {
    let c = emptyColoring()
    for (const n of instance.nodes) c = paintNode(instance, c, n, 0)
    expect(isColoringComplete(instance, c)).toBe(true)
    // Everything one colour is complete and completely wrong — that is the
    // referee's call to make, not this function's.
    expect(coloringConflicts(instance, c)).toHaveLength(12)
  })
})

describe('encodeColoringCertificate', () => {
  it("writes greedy's own answer, byte for byte", () => {
    const c = decodeColoringCertificate(instance, '{{a},{b,d,f,h},{c,e,g,i}}')
    expect(encodeColoringCertificate(instance, c as Record<string, number>)).toBe(
      '{{a},{b,d,f,h},{c,e,g,i}}',
    )
  })

  it('drops a colour nobody used', () => {
    let c = emptyColoring()
    c = paintNode(instance, c, 'a', 0)
    c = paintNode(instance, c, 'b', 2)
    expect(encodeColoringCertificate(instance, c)).toBe('{{a},{b}}')
  })

  it("encodes an untouched board as the backend's own no-solution", () => {
    expect(encodeColoringCertificate(instance, emptyColoring())).toBe('')
  })

  it('never spaces a class, since the verifier splits on the literal "},{"', () => {
    const c = decodeColoringCertificate(instance, '{{a},{b,d,f,h},{c,e,g,i}}')
    expect(encodeColoringCertificate(instance, c as Record<string, number>)).not.toMatch(/\s/)
  })
})

describe('decodeColoringCertificate', () => {
  it('round-trips whatever the board encodes', () => {
    let c = emptyColoring()
    instance.nodes.forEach((n, i) => {
      c = paintNode(instance, c, n, i % 3)
    })
    const encoded = encodeColoringCertificate(instance, c)
    expect(
      encodeColoringCertificate(instance, decodeColoringCertificate(instance, encoded) as never),
    ).toBe(encoded)
  })

  it('accepts the classes in any order, as the verifier does', () => {
    expect(decodeColoringCertificate(instance, '{{b,d,f,h},{a},{c,e,g,i}}')).toBeDefined()
  })

  it.each([
    ['the empty answer a solver gives when it found nothing', ''],
    ['a node the instance never had', '{{a},{zz}}'],
    ['a node in two classes at once', '{{a},{a}}'],
    ['more classes than there are colours', '{{a},{b},{c},{d}}'],
    ['a bare list with no classes', '{a,b}'],
    ['unbalanced braces', '{{a},{b}'],
  ])('refuses %s', (_why, bad) => {
    expect(decodeColoringCertificate(instance, bad)).toBeUndefined()
  })
})

describe('layoutColoring', () => {
  const layout = layoutColoring(instance)

  it('gives every node a place', () => {
    for (const n of instance.nodes) expect(layout.positions[n]).toBeDefined()
  })

  it('puts the hub in the middle when one node touches nearly everything', () => {
    // `a` is adjacent to all eight others.
    expect(layout.hub).toBe('a')
    expect(layout.positions.a).toEqual([0, 0, 0])
  })

  it('lies flat, so it reads as a map seen from above', () => {
    for (const p of Object.values(layout.positions)) expect(p[1]).toBe(0)
  })

  it('rings the rest evenly around the hub', () => {
    const ring = instance.nodes.filter((n) => n !== layout.hub)
    for (const n of ring) {
      const p = layout.positions[n] as [number, number, number]
      expect(Math.hypot(p[0], p[2])).toBeCloseTo(layout.ringRadius, 8)
    }
  })

  it('never overlaps two nodes', () => {
    const all = Object.values(layout.positions)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const [p, q] = [all[i], all[j]] as [number, number, number][]
        expect(Math.hypot(p[0] - q[0], p[2] - q[2])).toBeGreaterThan(COLORING.radius * 2)
      }
    }
  })

  it('grows the ring rather than crowding it as the instance gets bigger', () => {
    const many = Array.from({ length: 30 }, (_, i) => `n${i}`)
    const big = layoutColoring(parseColoring(`(({${many.join(',')}},{}),3)`))
    expect(big.ringRadius).toBeGreaterThan(layout.ringRadius)
  })

  it('leaves the middle empty when no node dominates', () => {
    // A plain cycle: every node has degree 2, so none is a hub.
    const cycle = parseColoring('(({a,b,c,d,e},{{a,b},{b,c},{c,d},{d,e},{e,a}}),3)')
    expect(layoutColoring(cycle).hub).toBeUndefined()
  })

  it('is deterministic', () => {
    expect(layoutColoring(instance)).toEqual(layoutColoring(instance))
  })
})
