import { describe, expect, it } from 'vitest'
import cliqueFrames from '../../../fixtures/clique-frames.json' with { type: 'json' }
import gadgets from '../../../fixtures/gadgets.json' with { type: 'json' }
import meta from '../../../fixtures/meta.json' with { type: 'json' }
import reduce from '../../../fixtures/reduce.json' with { type: 'json' }
import sat3Frames from '../../../fixtures/sat3-frames.json' with { type: 'json' }
import { buildScene, layoutFormula } from '../src/index.js'
import type { AnyFrame, ApiReduction, Gadget, ReductionBundle } from '../src/types.js'

const frames = sat3Frames as unknown as AnyFrame[]

const bundle: ReductionBundle = {
  reduction: reduce as unknown as ApiReduction,
  gadgets: gadgets as Gadget[],
  from: { problemName: '3SAT', frames },
  to: { problemName: 'Clique', frames: cliqueFrames as unknown as AnyFrame[] },
  solution: meta.solution,
}

const CLAUSE_COUNT = 3
const LITERALS_PER_CLAUSE = 3

describe('layoutFormula', () => {
  const clauses = frames[0]?.clauses ?? []
  const { positions, shelves } = layoutFormula(clauses)

  it('places every literal exactly once', () => {
    expect(positions.size).toBe(CLAUSE_COUNT * LITERALS_PER_CLAUSE)
    expect(shelves.size).toBe(CLAUSE_COUNT)
  })

  it('keeps the panel flat — a formula is symbolic, not spatial', () => {
    for (const p of positions.values()) expect(p[2]).toBe(0)
  })

  it('stacks clauses top to bottom in reading order', () => {
    const ys = clauses.map((c) => shelves.get(c.id)?.center[1] ?? 0)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] as number).toBeLessThan(ys[i - 1] as number)
    }
  })

  it('centres each clause and orders its literals left to right', () => {
    for (const clause of clauses) {
      const xs = clause.literals.map((l) => positions.get(l.id)?.[0] ?? 0)
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] as number).toBeGreaterThan(xs[i - 1] as number)
      }
      const sum = xs.reduce((a, b) => a + b, 0)
      expect(Math.abs(sum)).toBeLessThan(1e-9)
    }
  })

  it('sizes each shelf to enclose its literals', () => {
    for (const clause of clauses) {
      const shelf = shelves.get(clause.id)
      const widest = Math.max(
        ...clause.literals.map((l) => Math.abs(positions.get(l.id)?.[0] ?? 0)),
      )
      expect(shelf?.halfWidth ?? 0).toBeGreaterThan(widest)
    }
  })
})

describe('buildScene with both worlds', () => {
  const scene = buildScene(bundle)

  it('produces one formula world and one graph world', () => {
    expect(scene.worlds.map((w) => `${w.id}:${w.kind}`)).toEqual(['from:formula', 'to:graph'])
  })

  it('gives the formula world literals and no edges', () => {
    const from = scene.worlds.find((w) => w.id === 'from')
    expect(from?.nodes).toHaveLength(CLAUSE_COUNT * LITERALS_PER_CLAUSE)
    expect(from?.edges).toEqual([])
    expect(from?.groups).toHaveLength(CLAUSE_COUNT)
  })

  it('separates the worlds along x without overlap', () => {
    const from = scene.worlds.find((w) => w.id === 'from')
    const to = scene.worlds.find((w) => w.id === 'to')
    if (!from || !to) throw new Error('expected two worlds')
    const fromRight = from.origin[0] + from.bounds.max[0]
    const toLeft = to.origin[0] + to.bounds.min[0]
    expect(fromRight).toBeLessThan(toLeft)
  })

  it('marks the satisfying literals in the solved frame', () => {
    const from = scene.worlds.find((w) => w.id === 'from')
    const satisfied = from?.nodes.filter((n) => n.color === 'Solution').map((n) => n.id)
    // One satisfied literal per clause is what makes the clique selectable.
    expect(satisfied?.length).toBeGreaterThanOrEqual(CLAUSE_COUNT)
  })

  it('links every gadget source to a real literal', () => {
    const from = scene.worlds.find((w) => w.id === 'from')
    const literalIds = new Set(from?.nodes.map((n) => n.id))
    const clauseIds = new Set(from?.groups.map((g) => g.id))
    for (const link of scene.links) {
      for (const id of link.from) {
        expect(literalIds.has(id) || clauseIds.has(id)).toBe(true)
      }
    }
  })

  it('is deterministic across runs', () => {
    expect(JSON.stringify(buildScene(bundle))).toBe(JSON.stringify(buildScene(bundle)))
  })
})
