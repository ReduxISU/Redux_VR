import { emptyColoring, mapBounds, mapFor, paintNode, parseColoring } from '@redux-vr/puzzle'
import { useMemo } from 'react'
import { placesFromMap, Regions } from '../coloring/Regions.js'
import { fitOnPlinth } from './fit.js'

/**
 * The real map, shrunk — same geometry, same regions.
 *
 * Shown flat rather than lifted: the map is what a student meets first, and a
 * plinth should advertise the way in. Caught part-coloured and deliberately
 * with a clash showing, because the amber border is what the puzzle is *about*
 * and a tidy finished map would say there is nothing left to do here.
 */

const INSTANCE = parseColoring(
  '(({a,b,c,d,e,f,g,h,i},{{a,b},{b,c},{a,c},{d,a},{d,e},{a,e},{a,f},{f,g},{g,a},{a,h},{h,i},{i,a}}),3)',
)

export function ColoringDiorama({ size }: { size: number }) {
  const map = useMemo(() => mapFor(INSTANCE), [])
  const coloring = useMemo(() => {
    let c = emptyColoring()
    c = paintNode(INSTANCE, c, 'a', 0)
    c = paintNode(INSTANCE, c, 'b', 1)
    c = paintNode(INSTANCE, c, 'c', 1)
    c = paintNode(INSTANCE, c, 'd', 1)
    c = paintNode(INSTANCE, c, 'f', 2)
    return c
  }, [])

  if (!map) return null

  const { min, max } = mapBounds(map)
  const fit = fitOnPlinth([min[0], 0, min[1]], [max[0], 0, max[1]], size)

  return (
    <group scale={fit.scale} position={fit.position}>
      <Regions
        instance={INSTANCE}
        places={placesFromMap(map)}
        coloring={coloring}
        map={map}
        lift={0}
        interactive={false}
      />
    </group>
  )
}
