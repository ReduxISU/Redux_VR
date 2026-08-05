import { boundingRadius, boundsOf, centroid, layoutClusters } from './clique.js'
import { detectFrameKind } from './frames.js'
import { dedupeLinks, resolveGroups } from './parse.js'
import { layoutFormula } from './sat3.js'
import type {
  AnyFrame,
  ApiFormulaFrame,
  ApiGraphFrame,
  CorrespondenceLink,
  ReductionBundle,
  SceneEdge,
  SceneGraph,
  SceneGroup,
  SceneNode,
  Vec3,
  World,
  WorldSource,
} from './types.js'

export interface BuildOptions {
  /** Which visualization frame to render. 0 = base, last = solved. */
  frameIndex?: number
  /** Empty space between the two worlds. */
  worldGap?: number
  /** Target width of the source world as a fraction of the target world's. */
  sourceWidthFraction?: number
}

const ORIGIN: Vec3 = [0, 0, 0]
type Side = 'from' | 'to'

function graphWorld(
  frame: ApiGraphFrame,
  side: Side,
  problemName: string,
  gadgets: ReductionBundle['gadgets'],
): World {
  const groups = resolveGroups(frame.nodes, gadgets)
  const { positions, frames } = layoutClusters(groups)

  const nodeGroup = new Map<string, string>()
  for (const [groupId, members] of groups) {
    for (const id of members) nodeGroup.set(id, groupId)
  }

  const nodes: SceneNode[] = frame.nodes.map((n) => ({
    id: n.id,
    label: n.name,
    position: positions.get(n.id) ?? ORIGIN,
    color: n.color,
    group: nodeGroup.get(n.id),
  }))

  const known = new Set(nodes.map((n) => n.id))
  const edges: SceneEdge[] = dedupeLinks(frame.links)
    .filter((l) => known.has(l.source) && known.has(l.target))
    .map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      color: l.color,
      directed: l.directed,
    }))

  // A single group means no partition was recovered — drawing one hull around
  // every vertex would assert a structure the reduction does not have.
  const partitioned = groups.size > 1
  const sceneGroups: SceneGroup[] = partitioned
    ? [...groups].map(([id, members]) => {
        const points = members.map((m) => positions.get(m) ?? ORIGIN)
        const center = centroid(points)
        return {
          id,
          label: id,
          members,
          centroid: center,
          normal: frames.get(id)?.normal ?? ([0, 0, 1] as Vec3),
          radius: boundingRadius(points, center),
          color: 'ClauseHighlight',
        }
      })
    : []

  // Group hulls are drawn around their members, so bounds must cover them too or
  // the world will overlap its neighbour by the hull radius.
  const extremes = sceneGroups.flatMap((g) => [
    [g.centroid[0] - g.radius, g.centroid[1] - g.radius, g.centroid[2] - g.radius] as Vec3,
    [g.centroid[0] + g.radius, g.centroid[1] + g.radius, g.centroid[2] + g.radius] as Vec3,
  ])

  return {
    id: side,
    kind: 'graph',
    problemName,
    origin: ORIGIN,
    scale: 1,
    nodes,
    edges,
    groups: sceneGroups,
    bounds: boundsOf([...nodes.map((n) => n.position), ...extremes]),
  }
}

function formulaWorld(frame: ApiFormulaFrame, side: Side, problemName: string): World {
  const { positions, shelves } = layoutFormula(frame.clauses)

  const nodes: SceneNode[] = frame.clauses.flatMap((clause) =>
    clause.literals.map((literal) => ({
      id: literal.id,
      label: literal.literal,
      position: positions.get(literal.id) ?? ORIGIN,
      color: literal.color,
      group: clause.id,
    })),
  )

  // A formula has no edges — adjacency is expressed by shelf membership.
  const groups: SceneGroup[] = frame.clauses.map((clause) => {
    const shelf = shelves.get(clause.id)
    return {
      id: clause.id,
      label: clause.id,
      members: clause.literals.map((l) => l.id),
      centroid: shelf?.center ?? ORIGIN,
      normal: [0, 0, 1] as Vec3,
      radius: shelf?.halfWidth ?? 1,
      color: 'ClauseHighlight',
    }
  })

  const extremes = groups.flatMap((g) => [
    [g.centroid[0] - g.radius, g.centroid[1] - 0.4, 0] as Vec3,
    [g.centroid[0] + g.radius, g.centroid[1] + 0.4, 0] as Vec3,
  ])

  return {
    id: side,
    kind: 'formula',
    problemName,
    origin: ORIGIN,
    scale: 1,
    nodes,
    edges: [],
    groups,
    bounds: boundsOf([...nodes.map((n) => n.position), ...extremes]),
  }
}

/**
 * Build whichever world the frame describes.
 *
 * Either side of a reduction may be any family — most reductions are graph to
 * graph, and SAT to SAT3 is formula to formula. Dispatching on the frame rather
 * than hardcoding "source is a formula, target is a graph" is what makes the next
 * reduction a configuration change instead of new code.
 */
export function buildWorld(
  frame: AnyFrame,
  side: Side,
  source: WorldSource,
  gadgets: ReductionBundle['gadgets'],
): World | undefined {
  const kind = detectFrameKind(frame)
  if (kind === 'graph') return graphWorld(frame as ApiGraphFrame, side, source.problemName, gadgets)
  if (kind === 'formula') return formulaWorld(frame as ApiFormulaFrame, side, source.problemName)
  return undefined
}

const width = (w: World) => (w.bounds.max[0] - w.bounds.min[0]) * w.scale

/** Enlarge a compact symbolic world so it carries comparable visual weight to a
 *  sprawling spatial one — otherwise it reads as a caption rather than a peer. */
function matchVisualWeight(from: World, to: World, fraction: number): void {
  const natural = from.bounds.max[0] - from.bounds.min[0]
  if (natural <= 0) return
  from.scale = Math.min(Math.max((width(to) * fraction) / natural, 1), 4)
}

/** Push the two worlds apart along x so neither overlaps the gap between them. */
function placeSideBySide(from: World, to: World, gap: number): void {
  const half = gap / 2
  from.origin = [-half - from.bounds.max[0] * from.scale, 0, 0]
  to.origin = [half - to.bounds.min[0] * to.scale, 0, 0]
}

/** Gadgets, carried through verbatim — the wire between the two worlds. */
function correspondences(bundle: ReductionBundle): CorrespondenceLink[] {
  return bundle.gadgets.map((g, i) => ({
    id: `gadget-${i}`,
    kind: g.color,
    from: g.reductionFromIds,
    to: g.reductionToIds,
  }))
}

function clampIndex(requested: number, count: number): number {
  return Math.min(Math.max(requested, 0), Math.max(count - 1, 0))
}

/**
 * Reduction JSON -> positioned scene. Pure and deterministic: the same bundle
 * always produces byte-identical positions, so CI can snapshot them.
 */
export function buildScene(bundle: ReductionBundle, options: BuildOptions = {}): SceneGraph {
  const frameCount = bundle.to.frames.length
  const requested = options.frameIndex ?? frameCount - 1
  const frameIndex = clampIndex(requested, frameCount)

  const toFrame = bundle.to.frames[frameIndex]
  if (!toFrame) throw new Error('reduction bundle has no target visualization frames')

  const to = buildWorld(toFrame, 'to', bundle.to, bundle.gadgets)
  if (!to) throw new Error(`unsupported target representation for ${bundle.to.problemName}`)

  // The two problems are visualized independently and need not have the same
  // number of frames, so the source index is clamped on its own.
  const fromFrame = bundle.from.frames[clampIndex(requested, bundle.from.frames.length)]
  const from = fromFrame ? buildWorld(fromFrame, 'from', bundle.from, bundle.gadgets) : undefined

  const worlds: World[] = []
  if (from) {
    matchVisualWeight(from, to, options.sourceWidthFraction ?? 0.62)
    placeSideBySide(from, to, options.worldGap ?? 4.5)
    worlds.push(from)
  }
  worlds.push(to)

  return {
    reductionName: bundle.reduction.reductionName,
    worlds,
    links: correspondences(bundle),
    frameIndex,
    frameCount,
  }
}
