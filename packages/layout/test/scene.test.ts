import { describe, expect, it } from 'vitest'
import cliqueFrames from '../../../fixtures/clique-frames.json' with { type: 'json' }
import gadgets from '../../../fixtures/gadgets.json' with { type: 'json' }
import meta from '../../../fixtures/meta.json' with { type: 'json' }
import reduce from '../../../fixtures/reduce.json' with { type: 'json' }
import sat3Frames from '../../../fixtures/sat3-frames.json' with { type: 'json' }
import { buildScene, dedupeLinks, resolveGroups } from '../src/index.js'
import type {
  AnyFrame,
  ApiGraphFrame,
  ApiReduction,
  Gadget,
  ReductionBundle,
} from '../src/types.js'

const bundle: ReductionBundle = {
  reduction: reduce as unknown as ApiReduction,
  gadgets: gadgets as Gadget[],
  from: { problemName: '3SAT', frames: sat3Frames as unknown as AnyFrame[] },
  to: { problemName: 'Clique', frames: cliqueFrames as unknown as AnyFrame[] },
  solution: meta.solution,
}

const CLAUSE_COUNT = 3
const LITERALS_PER_CLAUSE = 3
const UNIQUE_EDGES = 21

describe('dedupeLinks', () => {
  it('collapses the backend double-emission: 42 raw links -> 21 unique edges', () => {
    const raw = (cliqueFrames as unknown as ApiGraphFrame[])[0]?.links ?? []
    expect(raw).toHaveLength(UNIQUE_EDGES * 2)
    expect(dedupeLinks(raw)).toHaveLength(UNIQUE_EDGES)
  })

  it('keeps a set color over an unset one', () => {
    const base = {
      id: 'a-b',
      source: 'a',
      target: 'b',
      dashed: '',
      delay: '',
      weight: '1',
      weighted: false,
      directed: false,
    }
    const out = dedupeLinks([
      { ...base, color: '' },
      { ...base, id: 'b-a', source: 'b', target: 'a', color: 'Solution' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.color).toBe('Solution')
  })

  it('does not merge opposing directed edges', () => {
    const base = { dashed: '', delay: '', weight: '1', weighted: false, directed: true, color: '' }
    const out = dedupeLinks([
      { ...base, id: 'a-b', source: 'a', target: 'b' },
      { ...base, id: 'b-a', source: 'b', target: 'a' },
    ])
    expect(out).toHaveLength(2)
  })
})

describe('resolveGroups', () => {
  it('derives clause groups from gadgets, not from node names', () => {
    const frame = (cliqueFrames as unknown as ApiGraphFrame[])[0]
    const groups = resolveGroups(frame?.nodes ?? [], gadgets as Gadget[])
    expect(groups.size).toBe(CLAUSE_COUNT)
    for (const members of groups.values()) expect(members).toHaveLength(LITERALS_PER_CLAUSE)
  })

  it('falls back to the name suffix when a reduction populates no gadgets', () => {
    const frame = (cliqueFrames as unknown as ApiGraphFrame[])[0]
    const groups = resolveGroups(frame?.nodes ?? [], [])
    expect(groups.size).toBe(CLAUSE_COUNT)
  })
})

describe('buildScene', () => {
  const scene = buildScene(bundle)
  // Select by id: the scene grew a second world, and index order is not the contract.
  const world = scene.worlds.find((w) => w.id === 'to')

  it('produces one graph world with every vertex placed', () => {
    expect(world?.kind).toBe('graph')
    expect(world?.nodes).toHaveLength(CLAUSE_COUNT * LITERALS_PER_CLAUSE)
    expect(world?.edges).toHaveLength(UNIQUE_EDGES)
  })

  it('holds the Sipser invariant: no edge joins two vertices of the same clause', () => {
    const group = new Map(world?.nodes.map((n) => [n.id, n.group]))
    const intra = (world?.edges ?? []).filter((e) => group.get(e.source) === group.get(e.target))
    expect(intra).toEqual([])
  })

  it('separates clause groups spatially — no two anchors coincide', () => {
    const centroids = world?.groups.map((g) => g.centroid) ?? []
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        const a = centroids[i]
        const b = centroids[j]
        if (!a || !b) continue
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1)
      }
    }
  })

  it('resolves every gadget target to a real vertex', () => {
    const ids = new Set(world?.nodes.map((n) => n.id))
    for (const link of scene.links) {
      for (const target of link.to) expect(ids.has(target)).toBe(true)
    }
  })

  it('selects the solved frame by default and marks the k-clique', () => {
    expect(scene.frameIndex).toBe(scene.frameCount - 1)
    const solution = world?.nodes.filter((n) => n.color === 'Solution').map((n) => n.label)
    expect(solution?.sort()).toEqual(['x1_0', 'x1_1', 'x2_2'])
  })

  it('renders the base frame when asked', () => {
    const base = buildScene(bundle, { frameIndex: 0 })
    expect(base.frameIndex).toBe(0)
    const graph = base.worlds.find((w) => w.id === 'to')
    expect(graph?.nodes.every((n) => n.color === '')).toBe(true)
  })

  it('is deterministic — identical positions across runs', () => {
    const nodes = (s: ReturnType<typeof buildScene>) =>
      JSON.stringify(s.worlds.find((w) => w.id === 'to')?.nodes)
    expect(nodes(buildScene(bundle))).toBe(nodes(buildScene(bundle)))
  })

  it('matches the position snapshot', () => {
    const positions = Object.fromEntries(
      (world?.nodes ?? []).map((n) => [n.label, n.position.map((v) => Number(v.toFixed(4)))]),
    )
    expect(positions).toMatchSnapshot()
  })
})
