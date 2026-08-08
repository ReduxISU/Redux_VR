/**
 * What this app can show, as data.
 *
 * Metadata only — deliberately no component imports. The hall lists every
 * activity to draw its name plates, and must not drag every scene's three.js
 * graph into memory to do it. The dispatcher in `App.tsx` is the only place
 * that maps an id to a component.
 */

/** Which end of the shelf an activity sits on. The hall itself is neither. */
export type Wing = 'hub' | 'k12' | 'cs'

export interface ActivityMeta {
  id: string
  title: string
  wing: Wing
  /** One line, readable by a student. Shown on the plinth. */
  blurb: string
  /**
   * `planned` entries have no scene yet and are listed anyway.
   *
   * Redux's own pitch is to *catch 'em all*, and it is crowd-sourced: an empty
   * plinth with a name on it advertises the gap and invites someone to fill it.
   * Hiding the gaps would make a four-problem shelf look finished.
   */
  status: 'ready' | 'planned'
}

export const DEFAULT_ACTIVITY = 'hall'

export const ACTIVITIES: Record<string, ActivityMeta> = {
  hall: {
    id: 'hall',
    title: 'Redux',
    wing: 'hub',
    blurb: 'Pick a problem',
    status: 'ready',
  },
  binpacking: {
    id: 'binpacking',
    title: 'Bin Packing',
    wing: 'k12',
    blurb: 'Fit everything in, without overfilling anything',
    status: 'ready',
  },
  graphcoloring: {
    id: 'graphcoloring',
    title: 'Graph Coloring',
    wing: 'k12',
    blurb: 'Colour the map so no two neighbours match',
    status: 'planned',
  },
  tsp: {
    id: 'tsp',
    title: 'Travelling Salesperson',
    wing: 'k12',
    blurb: 'Visit every city, drive as little as you can',
    status: 'planned',
  },
  cuttingstock: {
    id: 'cuttingstock',
    title: 'Cutting Stock',
    wing: 'k12',
    blurb: 'Cut the boards with nothing left over',
    status: 'planned',
  },
  reduction: {
    id: 'reduction',
    title: 'Reductions',
    wing: 'cs',
    blurb: 'Turn one problem into another, and the answer back again',
    status: 'ready',
  },
}

/** Shelf order: the K-12 wing first, the CS wing at the far end. */
const WING_ORDER: Wing[] = ['k12', 'cs']

/** Everything the hall puts on a plinth — which is everything but the hall. */
export function shelf(): ActivityMeta[] {
  return Object.values(ACTIVITIES)
    .filter((a) => a.wing !== 'hub')
    .sort((a, b) => WING_ORDER.indexOf(a.wing) - WING_ORDER.indexOf(b.wing))
}

/**
 * Unknown ids, and ids that are only planned, both fall back — a name plate is
 * a promise about the future, not a route.
 *
 * `hasOwn` rather than `in`: `?activity=constructor` would otherwise resolve to
 * an inherited Object property and be handed to the dispatcher as a component.
 */
export function resolveActivityId(requested: string | null | undefined): string {
  if (!requested || !Object.hasOwn(ACTIVITIES, requested)) return DEFAULT_ACTIVITY
  return ACTIVITIES[requested]?.status === 'ready' ? requested : DEFAULT_ACTIVITY
}
