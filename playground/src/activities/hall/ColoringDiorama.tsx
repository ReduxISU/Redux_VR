import { emptyColoring, layoutColoring, paintNode, parseColoring } from '@redux-vr/puzzle'
import { useMemo } from 'react'
import { Regions } from '../coloring/Regions.js'
import { fitOnPlinth } from './fit.js'

/**
 * The real map, shrunk — same layout code, same regions.
 *
 * Caught part-coloured, and deliberately with one clash showing: the amber
 * border is what the puzzle is *about*, and a tidy finished map on the plinth
 * would say there is nothing left to do here.
 */

const INSTANCE = parseColoring(
  '(({a,b,c,d,e,f,g,h,i},{{a,b},{b,c},{a,c},{d,a},{d,e},{a,e},{a,f},{f,g},{g,a},{a,h},{h,i},{i,a}}),3)',
)

export function ColoringDiorama({ size }: { size: number }) {
  const layout = useMemo(() => layoutColoring(INSTANCE), [])
  const coloring = useMemo(() => {
    let c = emptyColoring()
    c = paintNode(INSTANCE, c, 'a', 0)
    c = paintNode(INSTANCE, c, 'b', 1)
    c = paintNode(INSTANCE, c, 'c', 1)
    c = paintNode(INSTANCE, c, 'd', 1)
    c = paintNode(INSTANCE, c, 'f', 2)
    return c
  }, [])

  const fit = fitOnPlinth(layout.bounds.min, layout.bounds.max, size)

  return (
    <group scale={fit.scale} position={fit.position}>
      <Regions instance={INSTANCE} layout={layout} coloring={coloring} interactive={false} />
    </group>
  )
}
