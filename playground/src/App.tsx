import { type ComponentType, useCallback } from 'react'
import { BinPackingActivity } from './activities/binpacking/BinPackingActivity.js'
import { HallActivity } from './activities/hall/HallActivity.js'
import { ReductionActivity } from './activities/reduction/ReductionActivity.js'
import { resolveActivityId } from './shell/activities.js'
import { PARAMS } from './shell/params.js'

/**
 * The dispatcher: pick an activity, render it.
 *
 * This is the only module that knows activities have components — the registry
 * in `shell/activities.ts` stays metadata so the hall can list scenes it is not
 * currently rendering.
 */

export interface ActivityProps {
  /** Move to another activity. Every scene needs a way back to the hall. */
  onNavigate: (id: string) => void
}

const VIEWS: Record<string, ComponentType<ActivityProps>> = {
  hall: HallActivity,
  binpacking: BinPackingActivity,
  reduction: ReductionActivity,
}

const INITIAL = resolveActivityId(PARAMS.activity)

if (PARAMS.activity && PARAMS.activity !== INITIAL) {
  console.warn(`unknown or unbuilt ?activity=${PARAMS.activity} — showing ${INITIAL}`)
}

/**
 * Changing rooms loads a new URL.
 *
 * Swapping the activity in React state would be faster, but every activity
 * mounts its own `SceneShell`, so switching types tears the `<Canvas>` down and
 * builds a new one anyway — and an in-scene click never lands again afterwards,
 * presumably because the pointer system is still holding a mesh that unmounted
 * mid-event. A real reload is at least a path that is exercised constantly.
 *
 * The prize for fixing this properly is XR: an immersive session cannot survive
 * either a reload *or* a new WebGL context, so changing rooms in a headset will
 * always drop the student back to the page until one `<Canvas>` spans the whole
 * app. That needs the HUD to cross from R3F's reconciler back to the DOM — a
 * tunnel, not a `react-dom` portal — which is a piece of work in its own right,
 * and worth doing before anyone tries this on hardware.
 */
export function App() {
  const navigate = useCallback((id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('activity', resolveActivityId(id))
    window.location.assign(url.toString())
  }, [])

  const View = VIEWS[INITIAL] ?? HallActivity
  return <View onNavigate={navigate} />
}
