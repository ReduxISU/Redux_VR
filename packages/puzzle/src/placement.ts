import { itemId, itemIndex, sizeOf } from './instance.js'
import type { BinPackingInstance, Placement } from './types.js'

/**
 * Every operation returns a new Placement, and returns the *same* one when
 * nothing changed — so a scene can compare by identity.
 *
 * Nothing here decides whether an arrangement is correct. `binLoad` and
 * `overflowingBins` exist so a bin can glow while a block is still in the
 * student's hand; the verdict belongs to the backend verifier, which is the
 * referee for the classroom, the web GUI and the headset alike.
 */

export function emptyPlacement(instance: BinPackingInstance): Placement {
  return { bins: Array.from({ length: instance.binLimit }, () => []) }
}

/** Which bin holds `id`, or undefined while it is still in the tray. */
export function binOf(placement: Placement, id: string): number | undefined {
  const index = placement.bins.findIndex((bin) => bin.includes(id))
  return index === -1 ? undefined : index
}

function withoutItem(placement: Placement, id: string): Placement {
  return { bins: placement.bins.map((bin) => bin.filter((held) => held !== id)) }
}

function isKnownItem(instance: BinPackingInstance, id: string): boolean {
  const index = itemIndex(id)
  return index !== undefined && index < instance.sizes.length
}

/** Unplaced items, in instance order. Derived, so it cannot drift from `bins`. */
export function trayItems(instance: BinPackingInstance, placement: Placement): string[] {
  const held = new Set(placement.bins.flat())
  return instance.sizes.map((_, i) => itemId(i)).filter((id) => !held.has(id))
}

/**
 * Move an item onto the top of a bin, from wherever it was.
 *
 * An unknown item or an out-of-range bin is a no-op rather than a throw: this
 * is a state reducer driven by a drag, and refusing the move is the safe
 * reduction.
 */
export function place(
  instance: BinPackingInstance,
  placement: Placement,
  id: string,
  binIndex: number,
): Placement {
  const target = placement.bins[binIndex]
  if (!target || !isKnownItem(instance, id)) return placement
  return {
    bins: withoutItem(placement, id).bins.map((bin, i) => (i === binIndex ? [...bin, id] : bin)),
  }
}

export function returnToTray(placement: Placement, id: string): Placement {
  return binOf(placement, id) === undefined ? placement : withoutItem(placement, id)
}

export function binLoad(
  instance: BinPackingInstance,
  placement: Placement,
  binIndex: number,
): number {
  const bin = placement.bins[binIndex] ?? []
  return bin.reduce((sum, id) => sum + (sizeOf(instance, id) ?? 0), 0)
}

/** Bins holding more than they can — an affordance, not a verdict. */
export function overflowingBins(instance: BinPackingInstance, placement: Placement): number[] {
  return placement.bins
    .map((_, i) => i)
    .filter((i) => binLoad(instance, placement, i) > instance.capacity)
}

/** Everything placed somewhere. Gates *asking* the verifier, it does not answer for it. */
export function isComplete(instance: BinPackingInstance, placement: Placement): boolean {
  return trayItems(instance, placement).length === 0
}
