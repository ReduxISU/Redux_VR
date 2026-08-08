/**
 * Graph colouring: give every region a colour so no two touching regions match.
 *
 * The worksheet's second game, and the one that introduces the word *graph* —
 * "maps or networks in computer science are called graphs".
 *
 * Names are prefixed because bin packing got to this package first and owns the
 * unqualified ones.
 */

export interface ColoringEdge {
  id: string
  a: string
  b: string
}

export interface ColoringInstance {
  nodes: string[]
  edges: ColoringEdge[]
  /** How many colours are allowed. The K in the instance. */
  colors: number
}

/** Which colour index each node carries. Absent means still uncoloured. */
export type Coloring = Record<string, number>

const SHAPE = /^\(\(\{([^{}]*)\},\{(.*)\}\),(-?\d+)\)$/

/** Unordered: {a,b} and {b,a} are one edge, as they are one wall on a map. */
const edgeKey = (a: string, b: string) => (a < b ? `${a}--${b}` : `${b}--${a}`)

export function parseColoring(instance: string): ColoringInstance {
  // Trimmed per token rather than stripped wholesale: node names may contain
  // spaces (TSP ships cities like "Los Angeles"), and renaming them here would
  // desync the certificate we send back from the instance the backend parsed.
  const shape = SHAPE.exec(instance.trim())
  if (!shape) {
    throw new Error(`graph colouring: expected (({a,b},{{a,b}}),3) — got "${instance}"`)
  }

  const [, nodeList = '', edgeList = '', k = ''] = shape
  const nodes = nodeList
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '')
  if (nodes.length === 0) throw new Error('graph colouring: the instance has no nodes')
  if (new Set(nodes).size !== nodes.length) {
    throw new Error('graph colouring: the same node is listed twice')
  }

  const colors = Number(k)
  if (!Number.isInteger(colors) || colors <= 0) {
    throw new Error(
      `graph colouring: the colour limit must be a positive whole number — got "${k}"`,
    )
  }

  const known = new Set(nodes)
  const seen = new Map<string, ColoringEdge>()
  for (const raw of edgeList.match(/\{[^{}]*\}/g) ?? []) {
    const ends = raw
      .slice(1, -1)
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n !== '')
    if (ends.length !== 2) throw new Error(`graph colouring: "${raw}" is not a pair of nodes`)
    const [a = '', b = ''] = ends
    if (!known.has(a) || !known.has(b)) {
      throw new Error(`graph colouring: "${raw}" joins a node the instance never declared`)
    }
    const id = edgeKey(a, b)
    if (!seen.has(id)) seen.set(id, { id, a, b })
  }

  return { nodes, edges: [...seen.values()], colors }
}

export function emptyColoring(): Coloring {
  return {}
}

/** Out-of-range colours and unknown nodes are refused, not clamped. */
export function paintNode(
  instance: ColoringInstance,
  coloring: Coloring,
  node: string,
  color: number,
): Coloring {
  const known = instance.nodes.includes(node)
  if (!known || color < 0 || color >= instance.colors) return coloring
  if (coloring[node] === color) return coloring
  return { ...coloring, [node]: color }
}

export function clearNode(coloring: Coloring, node: string): Coloring {
  if (!(node in coloring)) return coloring
  const next = { ...coloring }
  delete next[node]
  return next
}

/**
 * Edges whose two ends share a colour.
 *
 * An affordance — the wall a student can see is wrong — never a verdict. Whether
 * the whole map is correctly coloured is the backend verifier's call.
 */
export function coloringConflicts(instance: ColoringInstance, coloring: Coloring): ColoringEdge[] {
  return instance.edges.filter((e) => {
    const a = coloring[e.a]
    return a !== undefined && a === coloring[e.b]
  })
}

export function uncolored(instance: ColoringInstance, coloring: Coloring): string[] {
  return instance.nodes.filter((n) => coloring[n] === undefined)
}

/** Everything coloured. Gates *asking* the referee; it does not answer for it. */
export function isColoringComplete(instance: ColoringInstance, coloring: Coloring): boolean {
  return uncolored(instance, coloring).length === 0
}

/**
 * The colour classes, in the shape `GraphColoringVerifier` reads:
 * `{{a},{b,d,f,h},{c,e,g,i}}`.
 *
 * Checked against the live API rather than inferred (2026-08-07): this is
 * byte-for-byte what `solve?solver=graphcoloringgreedy` returns for the default
 * instance, and the verifier answers `"True"` for it. Class order does not
 * matter, but the verifier splits on the literal `"},{"` — so no spaces — and
 * rejects a class count above K, a node left out, and any class holding two
 * adjacent nodes.
 */
export function encodeColoringCertificate(instance: ColoringInstance, coloring: Coloring): string {
  const classes: string[] = []
  for (let color = 0; color < instance.colors; color++) {
    const members = instance.nodes.filter((n) => coloring[n] === color)
    if (members.length > 0) classes.push(`{${members.join(',')}}`)
  }
  return classes.length === 0 ? '' : `{${classes.join(',')}}`
}

/**
 * A solver's answer, laid back onto the board.
 *
 * `undefined` for anything that will not lay out — the empty string a solver
 * gives when it found nothing, a malformed answer, a node the instance never
 * had, a node in two classes at once, or more classes than there are colours.
 */
export function decodeColoringCertificate(
  instance: ColoringInstance,
  certificate: string,
): Coloring | undefined {
  const compact = certificate.replace(/\s+/g, '')
  if (!/^\{(\{[^{}]*\},?)+\}$/.test(compact)) return undefined

  const classes = compact.slice(1, -1).match(/\{[^{}]*\}/g) ?? []
  if (classes.length > instance.colors) return undefined

  const known = new Set(instance.nodes)
  const coloring: Coloring = {}
  for (const [color, group] of classes.entries()) {
    for (const node of group.slice(1, -1).split(',')) {
      if (node === '') continue
      if (!known.has(node) || coloring[node] !== undefined) return undefined
      coloring[node] = color
    }
  }
  return coloring
}
