/**
 * URL parameters, parsed in one place.
 *
 * Two levels live in the same query string and must not be confused:
 * `activity` is the top-level split — which scene the shell renders — while
 * `mode` belongs to the reduction activity and means its highlight mode
 * (reduction | gadgets | solution). `mode` was taken first, so the new
 * top-level knob is `activity`.
 */

export interface AppParams {
  /** Which activity to render. Null means "the default one". */
  activity: string | null
  /** Freeze animation and damping so screenshots are comparable. */
  static: boolean

  /**
   * A problem instance, in the backend's own string form. Lets a printed kit
   * or a worksheet carry the exact puzzle a class is working on.
   */
  instance: string | null
  /** Which costume an activity opens in. Presentation only — never the puzzle. */
  skin: string | null

  // Below here: owned by the reduction activity.
  fixtures: boolean
  frame: number | null
  world: string
  focus: string | null
  reduction: string | null
  menuOpen: boolean
  mode: string | null
}

export function readParams(search: string): AppParams {
  const p = new URLSearchParams(search)
  const frame = p.get('frame')
  return {
    activity: p.get('activity'),
    static: p.get('static') === '1',
    instance: p.get('instance'),
    skin: p.get('skin'),
    fixtures: p.get('source') === 'fixtures',
    frame: frame === null ? null : Number(frame),
    world: p.get('world') ?? 'both',
    focus: p.get('focus'),
    reduction: p.get('reduction'),
    menuOpen: p.get('menu') === 'open',
    mode: p.get('mode'),
  }
}

/**
 * Read once at load. Nothing writes back to the URL yet, so a snapshot is honest.
 *
 * The guard keeps this module importable from vitest, which runs in node with no
 * `window`; `readParams` is the part under test.
 */
export const PARAMS = readParams(typeof window === 'undefined' ? '' : window.location.search)
