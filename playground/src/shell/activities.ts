/**
 * What this app can show, as data.
 *
 * Metadata only — deliberately no component imports. A hub that lists every
 * activity needs each one's name and wing, but must not drag every scene's
 * three.js graph into memory to draw a name plate. The dispatcher in `App.tsx`
 * is the only place that maps an id to a component.
 */

/** Which end of the shelf an activity sits on. */
export type Wing = 'k12' | 'cs'

export interface ActivityMeta {
  id: string
  title: string
  wing: Wing
  /** One line, readable by a student. Destined for a plinth name plate. */
  blurb: string
}

export const DEFAULT_ACTIVITY = 'reduction'

export const ACTIVITIES: Record<string, ActivityMeta> = {
  reduction: {
    id: 'reduction',
    title: 'Reductions',
    wing: 'cs',
    blurb: 'Turn one problem into another, and the answer back again',
  },
}

/**
 * Unknown and missing ids both fall back, so a typo shows something.
 *
 * `hasOwn` rather than `in`: `?activity=constructor` would otherwise resolve to
 * an inherited Object property and be handed to the dispatcher as a component.
 */
export function resolveActivityId(requested: string | null | undefined): string {
  return requested && Object.hasOwn(ACTIVITIES, requested) ? requested : DEFAULT_ACTIVITY
}
