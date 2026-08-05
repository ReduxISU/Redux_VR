import { describe, expect, it } from 'vitest'
import cliqueFrames from '../../../fixtures/clique-frames.json' with { type: 'json' }
import cliqueSourceFrames from '../../../fixtures/clique-source-frames.json' with { type: 'json' }
import gadgets from '../../../fixtures/gadgets.json' with { type: 'json' }
import reduce from '../../../fixtures/reduce.json' with { type: 'json' }
import sat3Frames from '../../../fixtures/sat3-frames.json' with { type: 'json' }
import vcFrames from '../../../fixtures/vertexcover-frames.json' with { type: 'json' }
import vcGadgets from '../../../fixtures/vertexcover-gadgets.json' with { type: 'json' }
import { buildScene, buildWorld, detectFrameKind, isRenderable } from '../src/index.js'
import type { AnyFrame, ApiReduction, Gadget, ReductionBundle } from '../src/types.js'

const graphFrames = cliqueFrames as unknown as AnyFrame[]
const formulaFrames = sat3Frames as unknown as AnyFrame[]
// Real CLIQUE -> VERTEXCOVER capture: vertices named "1".."6", no clause suffix,
// and identity gadgets — what a typical graph-to-graph reduction actually returns.
const vcSource = cliqueSourceFrames as unknown as AnyFrame[]
const vcTarget = vcFrames as unknown as AnyFrame[]

function bundleOf(from: AnyFrame[], to: AnyFrame[], g: Gadget[] = []): ReductionBundle {
  return {
    reduction: reduce as unknown as ApiReduction,
    gadgets: g,
    from: { problemName: 'Source', frames: from },
    to: { problemName: 'Target', frames: to },
    solution: '',
  }
}

describe('detectFrameKind', () => {
  it('identifies a graph frame by its keys, not by declared metadata', () => {
    expect(detectFrameKind(graphFrames[0])).toBe('graph')
  })

  it('identifies a formula frame by its keys', () => {
    expect(detectFrameKind(formulaFrames[0])).toBe('formula')
  })

  it('returns undefined for a family it cannot draw', () => {
    expect(detectFrameKind({ data: { list: [] } } as unknown as AnyFrame)).toBeUndefined()
    expect(detectFrameKind(undefined)).toBeUndefined()
    expect(isRenderable(undefined)).toBe(false)
  })
})

describe('buildWorld', () => {
  it('builds either family on either side', () => {
    expect(
      buildWorld(graphFrames[0] as AnyFrame, 'from', { problemName: 'X', frames: [] }, [])?.kind,
    ).toBe('graph')
    expect(
      buildWorld(formulaFrames[0] as AnyFrame, 'to', { problemName: 'X', frames: [] }, [])?.kind,
    ).toBe('formula')
  })

  it('refuses an unknown family rather than drawing something wrong', () => {
    const alien = { columns: [], rows: [] } as unknown as AnyFrame
    expect(buildWorld(alien, 'to', { problemName: 'X', frames: [] }, [])).toBeUndefined()
  })
})

describe('graph-to-graph reductions', () => {
  // Most reductions map vertices one-to-one and publish no grouping gadgets.
  const scene = buildScene(bundleOf(vcSource, vcTarget, vcGadgets as Gadget[]))

  it('renders both sides as graphs', () => {
    expect(scene.worlds.map((w) => w.kind)).toEqual(['graph', 'graph'])
  })

  it('draws no hulls when no partition was recovered', () => {
    // Asserting a clause structure that the reduction does not have would be a lie.
    for (const world of scene.worlds) expect(world.groups).toEqual([])
  })

  it('still separates the two worlds along x', () => {
    const [from, to] = scene.worlds
    if (!from || !to) throw new Error('expected two worlds')
    expect(from.origin[0] + from.bounds.max[0] * from.scale).toBeLessThan(
      to.origin[0] + to.bounds.min[0] * to.scale,
    )
  })

  it('places every vertex distinctly — no collapse to the origin', () => {
    const to = scene.worlds[1]
    const seen = new Set(to?.nodes.map((n) => n.position.join(',')))
    expect(seen.size).toBe(to?.nodes.length)
  })
})

describe('formula-to-formula reductions', () => {
  const scene = buildScene(bundleOf(formulaFrames, formulaFrames))

  it('renders both sides as formulas', () => {
    expect(scene.worlds.map((w) => w.kind)).toEqual(['formula', 'formula'])
  })

  it('keeps both panels flat', () => {
    for (const world of scene.worlds) {
      for (const node of world.nodes) expect(node.position[2]).toBe(0)
    }
  })
})

describe('missing source frames', () => {
  it('renders the target alone rather than failing', () => {
    const scene = buildScene(bundleOf([], graphFrames, gadgets as Gadget[]))
    expect(scene.worlds).toHaveLength(1)
    expect(scene.worlds[0]?.id).toBe('to')
  })

  it('throws only when the target itself cannot be drawn', () => {
    expect(() => buildScene(bundleOf(graphFrames, []))).toThrow(/no target visualization frames/)
  })
})
