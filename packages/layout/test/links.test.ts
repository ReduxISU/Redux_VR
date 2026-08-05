import { describe, expect, it } from 'vitest'
import cliqueFrames from '../../../fixtures/clique-frames.json' with { type: 'json' }
import gadgets from '../../../fixtures/gadgets.json' with { type: 'json' }
import meta from '../../../fixtures/meta.json' with { type: 'json' }
import reduce from '../../../fixtures/reduce.json' with { type: 'json' }
import sat3Frames from '../../../fixtures/sat3-frames.json' with { type: 'json' }
import {
  buildScene,
  certificateSegments,
  relatedIds,
  resolveLinks,
  worldPoint,
} from '../src/index.js'
import type {
  ApiFormulaFrame,
  ApiGraphFrame,
  ApiReduction,
  Gadget,
  ReductionBundle,
} from '../src/types.js'

const bundle: ReductionBundle = {
  reduction: reduce as unknown as ApiReduction,
  gadgets: gadgets as Gadget[],
  fromFrames: sat3Frames as unknown as ApiFormulaFrame[],
  toFrames: cliqueFrames as unknown as ApiGraphFrame[],
  solution: meta.solution,
}

const scene = buildScene(bundle)
const segments = resolveLinks(scene)
const from = scene.worlds.find((w) => w.id === 'from')
const to = scene.worlds.find((w) => w.id === 'to')

describe('worldPoint', () => {
  it('resolves a literal id against the formula world', () => {
    expect(from && worldPoint(from, '0-1')).toBeDefined()
  })

  it('resolves a clause id to its group, not a node', () => {
    expect(from && worldPoint(from, '0')).toBeDefined()
    expect(from?.nodes.some((n) => n.id === '0')).toBe(false)
  })

  it('applies the world transform, so points are in world space', () => {
    if (!from) throw new Error('no formula world')
    const local = from.nodes.find((n) => n.id === '0-1')?.position
    const world = worldPoint(from, '0-1')
    if (!local || !world) throw new Error('missing point')
    expect(world[0]).toBeCloseTo(local[0] * from.scale + from.origin[0], 10)
  })

  it('returns undefined for an unknown id rather than the origin', () => {
    expect(from && worldPoint(from, 'nope')).toBeUndefined()
  })
})

describe('resolveLinks', () => {
  it('expands one-to-one gadgets per pair and collapses whole-group targets', () => {
    // 9 literal->vertex segments, plus 1 (not 3) per clause->cluster gadget.
    expect(segments).toHaveLength(9 + 3)
    const clauseLinks = segments.filter((s) => s.kind === 'ClauseHighlight')
    expect(clauseLinks).toHaveLength(3)
    expect(clauseLinks.map((s) => s.toId).sort()).toEqual(['0', '1', '2'])
  })

  it('places every endpoint on the correct side of the gap', () => {
    if (!from || !to) throw new Error('expected two worlds')
    const divide = (from.origin[0] + from.bounds.max[0] * from.scale + to.origin[0]) / 2
    for (const s of segments) {
      expect(s.from[0]).toBeLessThan(divide)
      expect(s.to[0]).toBeGreaterThan(divide)
    }
  })

  it('marks exactly the certificate segments as in-solution', () => {
    const solvedVertices = new Set(segments.filter((s) => s.inSolution).map((s) => s.toId))
    expect([...solvedVertices].sort()).toEqual(['x1_0', 'x1_1', 'x2_2'])
  })

  it('drops segments whose endpoints do not resolve', () => {
    const broken = buildScene({
      ...bundle,
      gadgets: [
        { color: 'ElementHighlight', reductionFromIds: ['9-9'], reductionToIds: ['ghost'] },
      ],
    })
    expect(resolveLinks(broken)).toEqual([])
  })
})

describe('certificateSegments', () => {
  const cert = certificateSegments(segments)

  it('keeps only element-level links carrying the solution', () => {
    expect(cert).toHaveLength(3)
    expect(cert.every((s) => s.inSolution)).toBe(true)
    expect(cert.every((s) => s.kind === 'ElementHighlight')).toBe(true)
  })

  it('maps the k-clique back to one satisfied literal per clause', () => {
    const clauses = cert.map((s) => s.fromId.split('-')[0])
    expect([...new Set(clauses)].sort()).toEqual(['0', '1', '2'])
  })
})

describe('relatedIds', () => {
  it('walks forward from a literal to its vertex', () => {
    expect(relatedIds(scene, '0-1').has('!x2_0')).toBe(true)
  })

  it('walks backward from a vertex to its literal — the direction the API lacks', () => {
    expect(relatedIds(scene, '!x2_0').has('0-1')).toBe(true)
  })

  it('relates a clause to all three of its vertices', () => {
    expect(relatedIds(scene, '0')).toEqual(new Set(['x1_0', '!x2_0', 'x3_0']))
  })

  it('returns an empty set for an unknown id', () => {
    expect(relatedIds(scene, 'nope').size).toBe(0)
  })
})
