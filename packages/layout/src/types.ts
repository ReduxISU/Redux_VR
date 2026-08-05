/** Redux API shapes (the contract) and the SceneGraph shapes (our output). */

// ---------------------------------------------------------------- API contract

/** A gadget: a colored many-to-many correspondence between opaque element ids.
 *  Uniform across every reduction, though only ~10 of 20 populate it. */
export interface Gadget {
  color: string
  reductionFromIds: string[]
  reductionToIds: string[]
}

export interface ApiNode {
  id: string
  name: string
  color: string
  outline: string
  delay: string
  dashed: string
  additional: string
}

export interface ApiLink {
  id: string
  source: string
  target: string
  color: string
  dashed: string
  delay: string
  weight: string
  weighted: boolean
  directed: boolean
}

/** One frame of a graph-shaped visualization. Frames carry no discriminator —
 *  they are identified by key presence and by array position (0 = base, last = solved). */
export interface ApiGraphFrame {
  nodes: ApiNode[]
  links: ApiLink[]
}

export interface ApiLiteral {
  id: string
  literal: string
  color: string
}

export interface ApiClause {
  id: string
  literals: ApiLiteral[]
}

/** One frame of a formula-shaped visualization. */
export interface ApiFormulaFrame {
  clauses: ApiClause[]
}

export interface ApiProblem {
  problemName: string
  instance: string
  formalDefinition: string
}

export interface ApiReduction {
  reductionName: string
  reductionDefinition: string
  gadgets: Gadget[]
  reductionFrom: ApiProblem
  reductionTo: ApiProblem
}

/** Everything the layout needs, as fetched. */
export interface ReductionBundle {
  reduction: ApiReduction
  gadgets: Gadget[]
  fromFrames: ApiFormulaFrame[]
  toFrames: ApiGraphFrame[]
  solution: string
}

// ------------------------------------------------------------------ SceneGraph

export type Vec3 = readonly [number, number, number]

/** Backend color keys, resolved to hex by the renderer. `''` means unset. */
export type ColorKey = string

export interface SceneNode {
  id: string
  label: string
  position: Vec3
  color: ColorKey
  /** Group id (e.g. the clause this vertex came from). */
  group?: string
}

export interface SceneEdge {
  id: string
  source: string
  target: string
  color: ColorKey
  directed: boolean
}

/** A clause shelf, gadget hull, or any other spatial grouping. */
export interface SceneGroup {
  id: string
  label: string
  members: string[]
  centroid: Vec3
  /** Facing of the group's plane, so a renderer can outline it without
   *  re-deriving the layout's conventions. */
  normal: Vec3
  radius: number
  color: ColorKey
}

/** The representation family. Adding one costs a layout fn plus a renderer;
 *  a new reduction *within* a built family costs nothing. */
export type WorldKind = 'graph' | 'formula' | 'set' | 'table'

export interface World {
  id: 'from' | 'to'
  kind: WorldKind
  problemName: string
  origin: Vec3
  nodes: SceneNode[]
  edges: SceneEdge[]
  groups: SceneGroup[]
  bounds: { min: Vec3; max: Vec3 }
}

/** A gadget, spatialised: which source elements became which target elements. */
export interface CorrespondenceLink {
  id: string
  kind: string
  from: string[]
  to: string[]
}

export interface SceneGraph {
  reductionName: string
  worlds: World[]
  links: CorrespondenceLink[]
  frameIndex: number
  frameCount: number
}
