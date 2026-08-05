import type { ApiClause, Vec3 } from './types.js'

export interface FormulaLayoutOptions {
  /** Horizontal gap between literal tokens within a clause. */
  literalSpacing?: number
  /** Vertical gap between clause shelves. */
  clauseSpacing?: number
  /** Slack added either side of the outermost literals. */
  shelfPadding?: number
}

export interface Shelf {
  center: Vec3
  halfWidth: number
}

export interface FormulaLayout {
  positions: Map<string, Vec3>
  shelves: Map<string, Shelf>
}

/**
 * Clause-shelf layout.
 *
 * A formula is symbolic, not spatial: the useful arrangement is the one students
 * already read, so clauses stack top-to-bottom and literals run left-to-right in
 * a flat panel. Depth is deliberately unused here — 3D earns its place on the
 * graph side, and forcing it on the formula side would only hurt legibility.
 *
 * Deterministic by construction.
 */
export function layoutFormula(
  clauses: ApiClause[],
  options: FormulaLayoutOptions = {},
): FormulaLayout {
  const literalSpacing = options.literalSpacing ?? 1.15
  const clauseSpacing = options.clauseSpacing ?? 1.0
  const shelfPadding = options.shelfPadding ?? 0.62

  const positions = new Map<string, Vec3>()
  const shelves = new Map<string, Shelf>()
  const top = ((clauses.length - 1) / 2) * clauseSpacing

  clauses.forEach((clause, i) => {
    const y = top - i * clauseSpacing
    const n = clause.literals.length
    const halfSpan = ((n - 1) / 2) * literalSpacing

    clause.literals.forEach((literal, j) => {
      positions.set(literal.id, [j * literalSpacing - halfSpan, y, 0])
    })

    shelves.set(clause.id, {
      center: [0, y, 0],
      halfWidth: halfSpan + shelfPadding,
    })
  })

  return { positions, shelves }
}
