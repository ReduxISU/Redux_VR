import { type ComponentType, useCallback, useState } from 'react'
import { BinPackingActivity } from './activities/binpacking/BinPackingActivity.js'
import { HallActivity } from './activities/hall/HallActivity.js'
import { ReductionActivity } from './activities/reduction/ReductionActivity.js'
import { resolveActivityId } from './shell/activities.js'
import { PARAMS } from './shell/params.js'
import { SceneShell } from './shell/SceneShell.js'

/**
 * The dispatcher: pick an activity, render it into the shared canvas.
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

export function App() {
  const [activity, setActivity] = useState(INITIAL)

  /**
   * Swapped in place. The canvas belongs to the shell above, so changing rooms
   * keeps the WebGL context — and with it any immersive session, which cannot
   * survive either a reload or a new context.
   *
   * That placement is also what makes the scene stay clickable. While each
   * activity mounted its own canvas, one switch left every later in-scene click
   * dead; measured, and the fix was the shared canvas, not deferring the state
   * change out of the click that caused it.
   *
   * `pushState` keeps the address bar honest, so a link to one activity still
   * works and a printed instance still opens the puzzle it names.
   */
  const navigate = useCallback((id: string) => {
    const next = resolveActivityId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('activity', next)
    window.history.pushState({ activity: next }, '', url)
    setActivity(next)
  }, [])

  const View = VIEWS[activity] ?? HallActivity
  return (
    <SceneShell>
      <View onNavigate={navigate} />
    </SceneShell>
  )
}
