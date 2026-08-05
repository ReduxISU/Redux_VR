import { boundingRadius, boundsOf, centroid, layoutClusters } from './clique.js'
import { dedupeLinks, resolveGroups } from './parse.js'
import type {
  ApiGraphFrame,
  CorrespondenceLink,
  ReductionBundle,
  SceneEdge,
  SceneGraph,
  SceneGroup,
  SceneNode,
  Vec3,
  World,
} from './types.js'

export interface BuildOptions {
  /** Which visualization frame to render. 0 = base, last = solved. */
  frameIndex?: number
  origin?: Vec3
}

function graphWorld(frame: ApiGraphFrame, bundle: ReductionBundle, origin: Vec3): World {
  const groups = resolveGroups(frame.nodes, bundle.gadgets)
  const { positions, frames } = layoutClusters(groups)

  const nodeGroup = new Map<string, string>()
  for (const [groupId, members] of groups) {
    for (const id of members) nodeGroup.set(id, groupId)
  }

  const nodes: SceneNode[] = frame.nodes.map((n) => ({
    id: n.id,
    label: n.name,
    position: positions.get(n.id) ?? [0, 0, 0],
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

  const sceneGroups: SceneGroup[] = [...groups].map(([id, members]) => {
    const points = members.map((m) => positions.get(m) ?? ([0, 0, 0] as Vec3))
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

  return {
    id: 'to',
    kind: 'graph',
    problemName: bundle.reduction.reductionTo.problemName,
    origin,
    nodes,
    edges,
    groups: sceneGroups,
    bounds: boundsOf(nodes.map((n) => n.position)),
  }
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

/**
 * Reduction JSON -> positioned scene. Pure and deterministic: the same bundle
 * always produces byte-identical positions, so CI can snapshot them.
 */
export function buildScene(bundle: ReductionBundle, options: BuildOptions = {}): SceneGraph {
  const frameCount = bundle.toFrames.length
  const requested = options.frameIndex ?? frameCount - 1
  const frameIndex = Math.min(Math.max(requested, 0), Math.max(frameCount - 1, 0))
  const frame = bundle.toFrames[frameIndex]
  if (!frame) throw new Error('reduction bundle has no visualization frames')

  return {
    reductionName: bundle.reduction.reductionName,
    worlds: [graphWorld(frame, bundle, options.origin ?? [0, 0, 0])],
    links: correspondences(bundle),
    frameIndex,
    frameCount,
  }
}
