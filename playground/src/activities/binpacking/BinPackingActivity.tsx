import {
  type BinPackingInstance,
  binAt,
  binLoad,
  emptyPlacement,
  isComplete,
  layoutPuzzle,
  overflowingBins,
  parseInstance,
  place,
  returnToTray,
  trayItems,
} from '@redux-vr/puzzle'
import { useCallback, useMemo, useState } from 'react'
import { type Point3, useDrag } from '../../drag.js'
import { boxCorners, fitCamera, type V3 } from '../../shell/framing.js'
import { PARAMS } from '../../shell/params.js'
import { SceneShell } from '../../shell/SceneShell.js'
import { Board, LIFT } from './Board.js'

/**
 * Bin packing you can pick up.
 *
 * The digital twin of the classroom kit: a row of containers with a capacity
 * scale up the side, and numbered blocks waiting in front of them. Nothing here
 * judges the arrangement — an over-full crate turns amber because the student
 * can see it is over-full, not because anything has ruled on it. The verifier
 * is the referee, and it is not wired up yet.
 */

/** The instance Redux itself ships for BINPACKING. */
const DEFAULT_INSTANCE = '((4,7,3,6,2,8),10,3)'

/**
 * Longer lens than the reduction view's 45°.
 *
 * The board is deep — containers at the back, blocks waiting at the front — and
 * a wide lens makes the near blocks tower over the crates they are headed for.
 * Compressing the perspective puts the two at comparable size, so the target of
 * the puzzle looks like the target.
 */
const FOV = 30
const FRAMING_MARGIN = 1.08
/**
 * Looking down at about 46°.
 *
 * Steep enough that the tray projects *below* the containers rather than across
 * them — a near-frontal view puts the waiting blocks between the camera and the
 * crates, hiding the very place blocks have to land. Not so steep that the
 * capacity scale up the side foreshortens away.
 */
const VIEW_DIR: V3 = [0, 1.05, 1]

function Puzzle({ instance, source }: { instance: BinPackingInstance; source: string }) {
  const layout = useMemo(() => layoutPuzzle(instance), [instance])
  const [placement, setPlacement] = useState(() => emptyPlacement(instance))

  const drop = useCallback(
    (id: string, at: Point3) => {
      const bin = binAt(layout, at)
      setPlacement((current) =>
        bin === undefined ? returnToTray(current, id) : place(instance, current, id, bin),
      )
    },
    [instance, layout],
  )

  const { held, grab, moveTo, release } = useDrag(drop)
  const target = held ? binAt(layout, held.point) : undefined

  const view = useMemo(() => {
    // Include the carry height, or a lifted block is framed off the top.
    const tallest = Math.max(...layout.items.map((i) => i.height), 0)
    const { min, max } = layout.bounds
    const ceiling: V3 = [max[0], Math.max(max[1], LIFT + tallest), max[2]]
    return fitCamera(boxCorners(min, ceiling), window.innerWidth / window.innerHeight, {
      fov: FOV,
      margin: FRAMING_MARGIN,
      viewDir: VIEW_DIR,
    })
  }, [layout])

  const left = trayItems(instance, placement)
  const over = overflowingBins(instance, placement)

  return (
    <>
      <SceneShell
        camera={{ position: view.position, fov: FOV }}
        extent={view.extent}
        target={view.center}
        damping={!PARAMS.static}
      >
        <Board
          instance={instance}
          layout={layout}
          placement={placement}
          held={held}
          target={target}
          onGrab={grab}
          onMove={moveTo}
          onDrop={release}
        />
      </SceneShell>

      <div className="hud">
        <div>
          <strong>Bin Packing</strong>
        </div>
        <div className="dim">{source}</div>
        <div className="dim">
          capacity {instance.capacity} · {instance.binLimit} bins
        </div>
        <div className="dim">
          {placement.bins
            .map((_, i) => `bin ${i + 1}: ${binLoad(instance, placement, i)}/${instance.capacity}`)
            .join(' · ')}
        </div>
        <div className="dim">
          {left.length} to place
          {over.length > 0 ? ` · ${over.length} over capacity` : ''}
          {isComplete(instance, placement) && over.length === 0 ? ' · everything fits' : ''}
        </div>
      </div>
    </>
  )
}

export function BinPackingActivity() {
  const source = PARAMS.instance ?? DEFAULT_INSTANCE
  try {
    // Parsing outside the stateful component keeps the failure path hook-free.
    return <Puzzle instance={parseInstance(source)} source={source} />
  } catch (err) {
    return <div className="hud">{(err as Error).message}</div>
  }
}
