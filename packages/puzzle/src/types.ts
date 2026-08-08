export type Vec3 = [number, number, number]

/**
 * Bin packing, decision variant: can every item fit into at most `binLimit`
 * bins of size `capacity`?
 *
 * Mirrors the backend grammar `{(S,C,K) | S is list, C is int, K is int}` —
 * `S` is an ordered *list*, so repeated sizes are normal and items are told
 * apart by position, never by size.
 */
export interface BinPackingInstance {
  sizes: number[]
  capacity: number
  binLimit: number
}

export interface Item {
  id: string
  /** Position in the instance's list. The item's identity. */
  index: number
  size: number
}

/**
 * Who is in which bin.
 *
 * The tray is *derived* — an item is untrayed exactly when some bin holds it —
 * so the two can never disagree. Each bin holds an ordered list because the
 * scene stacks the blocks; the order is how the student piled them, and the
 * verifier ignores it.
 */
export interface Placement {
  bins: string[][]
}

/** An open-topped container. `position` is the centre of its floor. */
export interface BinBody {
  id: string
  index: number
  position: Vec3
  width: number
  depth: number
  /** capacity × unit — the 0–10 scale printed up the side of the classroom truck. */
  height: number
}

/**
 * A block. Only `height` varies: this is *one-dimensional* bin packing, so the
 * other two dimensions carry no information and must not look like they do.
 */
export interface ItemBody {
  id: string
  index: number
  size: number
  width: number
  depth: number
  height: number
}

export interface PuzzleLayout {
  bins: BinBody[]
  items: ItemBody[]
  /**
   * Where an unplaced item rests. Keyed by id and derived from the item's
   * index, so a block returns to the slot it came from instead of the tray
   * resorting itself under the student's hands.
   */
  tray: Record<string, Vec3>
  bounds: { min: Vec3; max: Vec3 }
}
