import type { BinPackingInstance, Item, Placement } from './types.js'

/**
 * The instance travels as one string, both ways, exactly as the backend writes
 * it: `((4,7,3,6,2,8),10,3)`. Hiding that string from students is the point of
 * the K-12 interface — but it is still what goes on the wire.
 */

const SHAPE = /^\(\(([^()]*)\),(-?\d+),(-?\d+)\)$/

export function itemId(index: number): string {
  return `i${index}`
}

export function binId(index: number): string {
  return `b${index}`
}

/** `undefined` rather than NaN for anything that is not one of our ids. */
export function itemIndex(id: string): number | undefined {
  const n = /^i(\d+)$/.exec(id)
  return n ? Number(n[1]) : undefined
}

function positiveInt(raw: string, what: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`bin packing: ${what} must be a positive whole number — got "${raw}"`)
  }
  return n
}

export function parseInstance(instance: string): BinPackingInstance {
  // Whitespace is decoration: Redux_GUI strips it before parsing too.
  const shape = SHAPE.exec(instance.replace(/\s+/g, ''))
  if (!shape) {
    throw new Error(`bin packing: expected ((4,7,3),10,3) — got "${instance}"`)
  }

  const [, list = '', capacity = '', binLimit = ''] = shape
  if (list === '') throw new Error('bin packing: the item list is empty')

  return {
    sizes: list.split(',').map((raw) => positiveInt(raw, 'an item size')),
    capacity: positiveInt(capacity, 'the bin capacity'),
    binLimit: positiveInt(binLimit, 'the bin limit'),
  }
}

export function itemsOf(instance: BinPackingInstance): Item[] {
  return instance.sizes.map((size, index) => ({ id: itemId(index), index, size }))
}

export function sizeOf(instance: BinPackingInstance, id: string): number | undefined {
  const index = itemIndex(id)
  return index === undefined ? undefined : instance.sizes[index]
}

/**
 * The student's arrangement, in the shape `BinPackingVerifier` reads:
 * `((8,2),(7,3),(6,4))` — sizes, not ids, since the verifier checks the
 * multiset against S.
 *
 * Empty bins are dropped: the verifier counts *non-empty* bins against K, so
 * shipping them would only risk confusing its parser. An arrangement with
 * nothing placed encodes as `""`, which is the backend's own "no solution".
 *
 * Checked against the live API rather than inferred (2026-08-07): for
 * `((4,7,3,6,2,8),10,3)`, `solve?solver=binpackingffd` returns exactly
 * `((8,2),(7,3),(6,4))` — the same string this produces — and the verifier
 * answers `"True"` for it. Stack order does not matter (`((2,8),(3,7),(4,6))`
 * also verifies); an incomplete or over-capacity arrangement answers `"False"`.
 */
export function encodeCertificate(instance: BinPackingInstance, placement: Placement): string {
  const bins = placement.bins
    .filter((bin) => bin.length > 0)
    .map((bin) => `(${bin.map((id) => sizeOf(instance, id) ?? 0).join(',')})`)
  return bins.length === 0 ? '' : `(${bins.join(',')})`
}

/**
 * A solver's answer, laid back out on the board.
 *
 * The inverse of `encodeCertificate`, and harder, because a certificate names
 * sizes while the board moves *items*: two blocks of size 4 are interchangeable
 * to the verifier but distinct on the table. Each size is matched to some
 * unused item of that size — any choice is as good as another.
 *
 * `undefined` for anything that will not lay out: the empty string a solver
 * returns when it found nothing, a malformed answer, more bins than the
 * instance allows, or a size the instance never had. A hint that cannot be
 * trusted should not be shown.
 */
export function decodeCertificate(
  instance: BinPackingInstance,
  certificate: string,
): Placement | undefined {
  const compact = certificate.replace(/\s+/g, '')
  if (!/^\((\([^()]*\),?)+\)$/.test(compact)) return undefined

  const groups = compact.slice(1, -1).match(/\(([^()]*)\)/g) ?? []
  if (groups.length > instance.binLimit) return undefined

  const spare = new Map<number, number[]>()
  instance.sizes.forEach((size, index) => {
    spare.set(size, [...(spare.get(size) ?? []), index])
  })

  const bins: string[][] = Array.from({ length: instance.binLimit }, () => [])
  for (const [binIndex, group] of groups.entries()) {
    const body = group.slice(1, -1)
    if (body === '') continue
    for (const raw of body.split(',')) {
      const index = spare.get(Number(raw))?.shift()
      if (index === undefined) return undefined
      bins[binIndex]?.push(itemId(index))
    }
  }
  return { bins }
}
