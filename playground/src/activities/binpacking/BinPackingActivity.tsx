import {
  type BinPackingInstance,
  binAt,
  binLoad,
  decodeCertificate,
  emptyPlacement,
  encodeCertificate,
  layoutPuzzle,
  overflowingBins,
  parseInstance,
  place,
  returnToTray,
  trayItems,
} from '@redux-vr/puzzle'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ActivityProps } from '../../App.js'
import { solvePacking, verifyPacking } from '../../api/binpacking.js'
import { type Point3, useDrag } from '../../drag.js'
import { boxCorners, fitCamera, type V3 } from '../../shell/framing.js'
import { PARAMS } from '../../shell/params.js'
import { SceneShell } from '../../shell/SceneShell.js'
import { Board, LIFT } from './Board.js'
import { Controls, type Verdict } from './Controls.js'
import { containerLabel, loadLabel, nextSkin, resolveSkin } from './skins.js'

/**
 * Bin packing you can pick up.
 *
 * The digital twin of the classroom kit: a row of containers with a capacity
 * scale up the side, and numbered blocks waiting in front of them.
 *
 * Nothing here rules on an arrangement. An over-full crate turns amber because
 * a student can *see* it is over-full; whether the whole board is a solution is
 * the backend verifier's call, and the only way to find out is to ask it.
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

/** Half-extents of the control row, so the camera frames it with the board. */
const CONTROLS = { halfWidth: 6.4, halfHeight: 0.85, lift: 0.85, gap: 1.9 }

function Puzzle({
  instance,
  source,
  onNavigate,
}: {
  instance: BinPackingInstance
  source: string
  onNavigate: (id: string) => void
}) {
  const layout = useMemo(() => layoutPuzzle(instance), [instance])
  const [placement, setPlacement] = useState(() => emptyPlacement(instance))
  const [verdict, setVerdict] = useState<Verdict>({ state: 'idle' })
  const [hinting, setHinting] = useState(false)
  const [hintNote, setHintNote] = useState<string | null>(null)
  const [skin, setSkin] = useState(() => resolveSkin(PARAMS.skin))

  /**
   * Any answer older than the board it was asked about is thrown away. Moving a
   * block while a check is in flight would otherwise leave a verdict on screen
   * that describes an arrangement the student has already changed.
   */
  const asked = useRef(0)
  const forget = useCallback(() => {
    asked.current += 1
    setVerdict({ state: 'idle' })
    setHintNote(null)
  }, [])

  const drop = useCallback(
    (id: string, at: Point3) => {
      const bin = binAt(layout, at)
      setPlacement((current) =>
        bin === undefined ? returnToTray(current, id) : place(instance, current, id, bin),
      )
      forget()
    },
    [instance, layout, forget],
  )

  const { held, grab, moveTo, release } = useDrag(drop)
  const target = held ? binAt(layout, held.point) : undefined
  const certificate = encodeCertificate(instance, placement)

  const check = useCallback(async () => {
    const ticket = (asked.current += 1)
    setVerdict({ state: 'asking' })
    try {
      const fits = await verifyPacking(source, certificate)
      if (ticket === asked.current) setVerdict({ state: 'answered', fits })
    } catch (err) {
      // Never fall back to deciding locally: a guessed verdict is worse than none.
      if (ticket === asked.current) {
        setVerdict({ state: 'unreachable', message: (err as Error).message })
      }
    }
  }, [source, certificate])

  const hint = useCallback(async () => {
    const ticket = (asked.current += 1)
    setHinting(true)
    setHintNote(null)
    setVerdict({ state: 'idle' })
    try {
      const answer = await solvePacking(source)
      const laid = decodeCertificate(instance, answer)
      if (ticket !== asked.current) return
      if (laid) setPlacement(laid)
      else setHintNote('First Fit Decreasing could not pack this one.')
    } catch (err) {
      if (ticket === asked.current) setHintNote(`Could not reach Redux — ${(err as Error).message}`)
    } finally {
      setHinting(false)
    }
  }, [source, instance])

  const reset = useCallback(() => {
    setPlacement(emptyPlacement(instance))
    forget()
  }, [instance, forget])

  /**
   * Only the words change.
   *
   * The placement is deliberately untouched — watching your own arrangement
   * survive the costume change is the entire lesson. So is the verdict: a
   * packing Redux has already called correct is *still* correct in the other
   * telling, because it is the same instance and the same answer. Clearing it
   * here would teach the opposite of the thing this button exists to teach.
   */
  const changeSkin = useCallback(() => setSkin(nextSkin), [])

  const controlAnchor: [number, number, number] = [
    0,
    CONTROLS.lift,
    layout.bounds.max[2] + CONTROLS.gap,
  ]

  const view = useMemo(() => {
    // Include the carry height and the control row, or a lifted block and the
    // buttons that judge it both frame off the edges.
    const tallest = Math.max(...layout.items.map((i) => i.height), 0)
    const { min, max } = layout.bounds
    const ceiling: V3 = [max[0], Math.max(max[1], LIFT + tallest), max[2]]
    const controlsZ = max[2] + CONTROLS.gap
    return fitCamera(
      [
        ...boxCorners(min, ceiling),
        [-CONTROLS.halfWidth, CONTROLS.lift - CONTROLS.halfHeight, controlsZ],
        [CONTROLS.halfWidth, CONTROLS.lift + CONTROLS.halfHeight, controlsZ],
      ],
      window.innerWidth / window.innerHeight,
      { fov: FOV, margin: FRAMING_MARGIN, viewDir: VIEW_DIR },
    )
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
          skin={skin}
          held={held}
          target={target}
          onGrab={grab}
          onMove={moveTo}
          onDrop={release}
        />
        <Controls
          anchor={controlAnchor}
          verdict={verdict}
          remaining={left.length}
          hinting={hinting}
          hintNote={hintNote}
          placedAnything={certificate !== ''}
          nextSkinTitle={nextSkin(skin).short}
          onCheck={check}
          onHint={hint}
          onReset={reset}
          onSkin={changeSkin}
          onExit={() => onNavigate('hall')}
        />
      </SceneShell>

      <div className="hud">
        <div>
          <strong>Bin Packing</strong>
        </div>
        <div className="dim">{source}</div>
        <div className="dim">
          costume: {skin.title} · capacity {instance.capacity} {skin.unitName} · {instance.binLimit}{' '}
          {skin.container.toLowerCase()}s
        </div>
        <div className="dim">
          {placement.bins
            .map(
              (_, i) =>
                `${containerLabel(skin, i)}: ${loadLabel(skin, binLoad(instance, placement, i), instance.capacity)}`,
            )
            .join(' · ')}
        </div>
        <div className="dim">
          {left.length} to place
          {over.length > 0 ? ` · ${over.length} over capacity` : ''}
          {left.length === 0 && over.length === 0 ? ' · ready to check' : ''}
        </div>
        {/* What actually goes on the wire. The K-12 view hides this syntax, but
            it is the same string the web GUI sends, and it makes the referee's
            answer something a student can be shown rather than told. */}
        <div className="dim">certificate: {certificate || '(nothing placed)'}</div>
        {hintNote && <div className="dim">hint: {hintNote}</div>}
        <div className="dim">
          referee:{' '}
          {verdict.state === 'answered'
            ? verdict.fits
              ? 'True'
              : 'False'
            : verdict.state === 'unreachable'
              ? `unreachable — ${verdict.message}`
              : verdict.state}
        </div>
      </div>
    </>
  )
}

export function BinPackingActivity({ onNavigate }: ActivityProps) {
  const source = PARAMS.instance ?? DEFAULT_INSTANCE
  try {
    // Parsing outside the stateful component keeps the failure path hook-free.
    return <Puzzle instance={parseInstance(source)} source={source} onNavigate={onNavigate} />
  } catch (err) {
    return <div className="hud">{(err as Error).message}</div>
  }
}
