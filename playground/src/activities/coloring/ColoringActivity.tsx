import { useFrame } from '@react-three/fiber'
import {
  type Coloring,
  type ColoringInstance,
  clearNode,
  coloringConflicts,
  decodeColoringCertificate,
  emptyColoring,
  encodeColoringCertificate,
  layoutColoring,
  mapBounds,
  mapFor,
  paintNode,
  parseColoring,
  uncolored,
} from '@redux-vr/puzzle'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ActivityProps } from '../../App.js'
import { solveColoring, verifyColoring } from '../../api/coloring.js'
import { boxCorners, fitCamera, type V3 } from '../../shell/framing.js'
import { Hud } from '../../shell/hud.js'
import { PARAMS } from '../../shell/params.js'
import { Stage } from '../../shell/Stage.js'
import { Controls, type Verdict } from './Controls.js'
import { LIFT_HEIGHT, type Places, placesFromMap, Regions } from './Regions.js'

/**
 * Colour the map so no two touching regions match.
 *
 * The worksheet's second game, and the one that names the abstraction: the
 * regions here are laid flat and looked down on, because students arrive at
 * graphs *through* maps.
 *
 * As with bin packing, nothing here rules on the answer. A wall between two
 * matching regions turns amber because a student can see it is wrong; whether
 * the whole map is correctly coloured is the backend verifier's call.
 */

/** The instance Redux itself ships for GRAPHCOLORING. */
const DEFAULT_INSTANCE =
  '(({a,b,c,d,e,f,g,h,i},{{a,b},{b,c},{a,c},{d,a},{d,e},{a,e},{a,f},{f,g},{g,a},{a,h},{h,i},{i,a}}),3)'

const FOV = 32
const FRAMING_MARGIN = 1.12
/** Nearly overhead: a map is read from above, and these regions lie flat. */
const VIEW_DIR: V3 = [0, 1.75, 1]

/** Half-extents of the control block — swatch tray plus button row. */
const CONTROLS = { halfWidth: 6.4, halfHeight: 1.7, lift: 0.9, gap: 2.2 }

/**
 * Eases the map up and down.
 *
 * A cut would show the two states; the travel is what says they are the same
 * thing. Frozen for screenshots, where a half-raised map is just a blurred one.
 */
function LiftDriver({
  target,
  value,
  onChange,
}: {
  target: number
  value: number
  onChange: (next: number) => void
}) {
  useFrame((_, delta) => {
    if (Math.abs(target - value) < 0.002) {
      if (value !== target) onChange(target)
      return
    }
    onChange(value + (target - value) * Math.min(1, delta * 5))
  })
  return null
}

function Puzzle({
  instance,
  source,
  onNavigate,
}: {
  instance: ColoringInstance
  source: string
  onNavigate: (id: string) => void
}) {
  /**
   * A map when one provably depicts this instance, and the plain graph
   * otherwise — most instances have no map, and a non-planar one can have none.
   * Drawing an approximate map would be drawing a different problem.
   */
  const map = useMemo(() => mapFor(instance), [instance])
  const layout = useMemo(() => layoutColoring(instance), [instance])
  const places: Places = useMemo(
    () => (map ? placesFromMap(map) : (layout.positions as Places)),
    [map, layout],
  )
  const [coloring, setColoring] = useState<Coloring>(emptyColoring)
  const [active, setActive] = useState(0)
  const [verdict, setVerdict] = useState<Verdict>({ state: 'idle' })
  const [hinting, setHinting] = useState(false)
  const [hintNote, setHintNote] = useState<string | null>(null)
  const [raised, setRaised] = useState(() => (map && !PARAMS.lift ? 0 : 1))
  const [lift, setLift] = useState(() => (map && !PARAMS.lift ? 0 : 1))

  /** Any answer older than the board it was asked about is thrown away. */
  const asked = useRef(0)
  const forget = useCallback(() => {
    asked.current += 1
    setVerdict({ state: 'idle' })
    setHintNote(null)
  }, [])

  /**
   * Clicking a region paints it with the colour in hand; clicking one that
   * already has that colour takes it back off. One gesture, no eraser tool to
   * find, and undoing a mistake is the same move that made it.
   */
  const paint = useCallback(
    (node: string) => {
      setColoring((current) =>
        current[node] === active
          ? clearNode(current, node)
          : paintNode(instance, current, node, active),
      )
      forget()
    },
    [instance, active, forget],
  )

  const certificate = encodeColoringCertificate(instance, coloring)

  const check = useCallback(async () => {
    const ticket = (asked.current += 1)
    setVerdict({ state: 'asking' })
    try {
      const fits = await verifyColoring(source, certificate)
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
      const answer = await solveColoring(source)
      const laid = decodeColoringCertificate(instance, answer)
      if (ticket !== asked.current) return
      if (laid) setColoring(laid)
      else setHintNote('Greedy could not colour this one within the limit.')
    } catch (err) {
      if (ticket === asked.current) setHintNote(`Could not reach Redux — ${(err as Error).message}`)
    } finally {
      setHinting(false)
    }
  }, [source, instance])

  const reset = useCallback(() => {
    setColoring(emptyColoring())
    forget()
  }, [forget])

  const bounds = useMemo(() => {
    if (!map) return layout.bounds
    const { min, max } = mapBounds(map)
    return { min: [min[0], 0, min[1]] as V3, max: [max[0], 0, max[1]] as V3 }
  }, [map, layout])

  const controlAnchor: [number, number, number] = [0, CONTROLS.lift, bounds.max[2] + CONTROLS.gap]

  const view = useMemo(() => {
    const { min, max } = bounds
    const controlsZ = max[2] + CONTROLS.gap
    // Framed for the lifted state too, or raising the map carries it off the top.
    const ceiling: V3 = [max[0], max[1] + LIFT_HEIGHT + 0.6, max[2]]
    return fitCamera(
      [
        ...boxCorners(min, ceiling),
        [-CONTROLS.halfWidth, CONTROLS.lift - CONTROLS.halfHeight, controlsZ],
        [CONTROLS.halfWidth, CONTROLS.lift + CONTROLS.halfHeight, controlsZ],
      ],
      window.innerWidth / window.innerHeight,
      { fov: FOV, margin: FRAMING_MARGIN, viewDir: VIEW_DIR },
    )
  }, [bounds])

  const left = uncolored(instance, coloring)
  const clashes = coloringConflicts(instance, coloring)

  return (
    <>
      <Stage view={view} fov={FOV} damping={!PARAMS.static}>
        <Regions
          instance={instance}
          places={places}
          coloring={coloring}
          {...(map ? { map } : {})}
          lift={lift}
          onPaint={paint}
        />
        {map && !PARAMS.static && <LiftDriver target={raised} value={lift} onChange={setLift} />}
        <Controls
          anchor={controlAnchor}
          verdict={verdict}
          colors={instance.colors}
          active={active}
          remaining={left.length}
          clashes={clashes.length}
          hinting={hinting}
          hintNote={hintNote}
          paintedAnything={certificate !== ''}
          {...(map
            ? {
                lifted: raised > 0.5,
                onLift: () => {
                  const next = raised > 0.5 ? 0 : 1
                  setRaised(next)
                  if (PARAMS.static) setLift(next)
                },
              }
            : {})}
          onColor={setActive}
          onCheck={check}
          onHint={hint}
          onReset={reset}
          onExit={() => onNavigate('hall')}
        />
      </Stage>

      <Hud.In>
        <div className="hud">
          <div>
            <strong>Graph Coloring</strong>
          </div>
          <div className="dim">{source}</div>
          <div className="dim">
            {instance.nodes.length} regions · {instance.edges.length} borders · {instance.colors}{' '}
            colours
          </div>
          <div className="dim">
            {map
              ? `map: ${map.id} · ${raised > 0.5 ? 'lifted' : 'flat'}`
              : 'map: none — graph only'}
          </div>
          <div className="dim">
            {left.length} uncoloured
            {clashes.length > 0 ? ` · ${clashes.length} clashing` : ''}
            {left.length === 0 && clashes.length === 0 ? ' · ready to check' : ''}
          </div>
          {/* What actually goes on the wire — the colour classes, in the
              backend's own syntax. */}
          <div className="dim">certificate: {certificate || '(nothing coloured)'}</div>
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
      </Hud.In>
    </>
  )
}

export function ColoringActivity({ onNavigate }: ActivityProps) {
  const source = PARAMS.instance ?? DEFAULT_INSTANCE
  try {
    // Parsing outside the stateful component keeps the failure path hook-free.
    return <Puzzle instance={parseColoring(source)} source={source} onNavigate={onNavigate} />
  } catch (err) {
    return (
      <Hud.In>
        <div className="hud">{(err as Error).message}</div>
      </Hud.In>
    )
  }
}
