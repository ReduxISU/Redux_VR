import { emptyPlacement, layoutPuzzle, parseInstance, place } from '@redux-vr/puzzle'
import { useMemo } from 'react'
import { Board } from '../binpacking/Board.js'
import { TRUCKS } from '../binpacking/skins.js'
import { fitOnPlinth } from './fit.js'

/**
 * The real board, shrunk — same layout code, same crates, same blocks.
 *
 * Not a picture of the activity: a picture would drift from it the first time
 * the board changed. It is also deliberately caught *mid-puzzle* rather than
 * empty, because a half-packed truck says "there is something to do here" and
 * an empty one says nothing at all.
 */

const INSTANCE = parseInstance('((4,7,3,6,2,8),10,3)')

export function BinPackingDiorama({ size }: { size: number }) {
  const layout = useMemo(() => layoutPuzzle(INSTANCE), [])
  const placement = useMemo(() => {
    let p = emptyPlacement(INSTANCE)
    p = place(INSTANCE, p, 'i5', 0)
    p = place(INSTANCE, p, 'i1', 1)
    return p
  }, [])

  const fit = fitOnPlinth(layout.bounds.min, layout.bounds.max, size)

  return (
    <group scale={fit.scale} position={fit.position}>
      <Board
        instance={INSTANCE}
        layout={layout}
        placement={placement}
        skin={TRUCKS}
        held={null}
        target={undefined}
        interactive={false}
        onGrab={() => {}}
        onMove={() => {}}
        onDrop={() => {}}
      />
    </group>
  )
}
