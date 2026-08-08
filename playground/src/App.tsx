import type { ComponentType } from 'react'
import { BinPackingActivity } from './activities/binpacking/BinPackingActivity.js'
import { ReductionActivity } from './activities/reduction/ReductionActivity.js'
import { resolveActivityId } from './shell/activities.js'
import { PARAMS } from './shell/params.js'

/**
 * The dispatcher: pick an activity, render it.
 *
 * This is the only module that knows activities have components — the registry
 * in `shell/activities.ts` stays metadata so a hub can list scenes it is not
 * currently rendering.
 */

const VIEWS: Record<string, ComponentType> = {
  binpacking: BinPackingActivity,
  reduction: ReductionActivity,
}

const ACTIVITY = resolveActivityId(PARAMS.activity)

if (PARAMS.activity && PARAMS.activity !== ACTIVITY) {
  console.warn(`unknown ?activity=${PARAMS.activity} — showing ${ACTIVITY}`)
}

export function App() {
  const View = VIEWS[ACTIVITY] ?? ReductionActivity
  return <View />
}
