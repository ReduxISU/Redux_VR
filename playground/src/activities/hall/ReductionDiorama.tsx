import { buildScene, type World } from '@redux-vr/layout'
import { useMemo } from 'react'
import { fixtureBundle } from '../../api/redux.js'
import { FormulaWorld } from '../../scene/FormulaWorld.js'
import { GraphWorld } from '../../scene/GraphWorld.js'
import type { V3 } from '../../shell/framing.js'
import { fitOnPlinth } from './fit.js'

/**
 * The two-world reduction, shrunk — built from the committed fixtures rather
 * than the live API.
 *
 * The hall has to draw instantly and offline: a plinth that waits on a network
 * round trip is empty exactly when a student is deciding what to look at, and
 * prod has been down before. The fixtures are a real capture of the real
 * endpoint, so this is still the actual reduction, not a mock-up.
 *
 * No `intents` are passed, so nothing inside claims a pointer event and the
 * whole plinth stays one clickable thing.
 */

function worldBounds(worlds: World[]): { min: V3; max: V3 } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const w of worlds) {
    for (let i = 0; i < 3; i++) {
      const origin = w.origin[i] as number
      min[i] = Math.min(min[i] as number, origin + (w.bounds.min[i] as number) * w.scale)
      max[i] = Math.max(max[i] as number, origin + (w.bounds.max[i] as number) * w.scale)
    }
  }
  return { min, max }
}

export function ReductionDiorama({ size }: { size: number }) {
  const scene = useMemo(() => buildScene(fixtureBundle()), [])
  const bounds = useMemo(() => worldBounds(scene.worlds), [scene])
  const fit = fitOnPlinth(bounds.min, bounds.max, size)

  return (
    <group scale={fit.scale} position={fit.position}>
      {scene.worlds.map((world) =>
        world.kind === 'formula' ? (
          <FormulaWorld key={world.id} world={world} />
        ) : (
          <GraphWorld key={world.id} world={world} />
        ),
      )}
    </group>
  )
}
