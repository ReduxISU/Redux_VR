import { Billboard, Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import type { ActivityProps } from '../../App.js'
import { FONT_URL } from '../../scene/typography.js'
import { type ActivityMeta, shelf } from '../../shell/activities.js'
import { boxCorners, fitCamera, type V3 } from '../../shell/framing.js'
import { PARAMS } from '../../shell/params.js'
import { SceneShell } from '../../shell/SceneShell.js'
import { BinPackingDiorama } from './BinPackingDiorama.js'
import { ReductionDiorama } from './ReductionDiorama.js'

/**
 * The front door: a shelf of problems, each holding a working miniature of
 * itself rather than an icon.
 *
 * There is no split between a "kids' menu" and a "real Redux menu". The
 * worksheet's whole arc is a ladder — play a packing game, learn it has a name,
 * meet the same problem in a new costume, and eventually watch one problem turn
 * into another — and the last rung already exists. Two doors would cut that
 * ladder in half; one shelf with a CS end keeps it whole.
 */

/**
 * Ranks rather than one long row.
 *
 * A shelf of five is a 5:1 strip of content in a 16:9 frame — most of the screen
 * ends up empty and every exhibit ends up tiny. Two ranks put the same plinths
 * in a box the shape of the window. In a headset it reads the same way: a room
 * with a front row and a back row, rather than a wall you have to pan along.
 */
const PLINTH = {
  width: 2.9,
  depth: 2.9,
  height: 0.45,
  pitchX: 4.1,
  pitchZ: 4.8,
  cols: 3,
  model: 2.7,
  /**
   * A consistent height across every plinth, like a gallery.
   * Higher than the miniatures are tall: a raised camera projects the back of a
   * deep model well above its own world height, so clearance has to be generous.
   */
  plateY: 1.85,
}

const FOV = 30
const FRAMING_MARGIN = 1.06
/** Steep enough that the back rank clears the front one. */
const VIEW_DIR: V3 = [0, 0.72, 1]

const WING_LABEL: Record<string, string> = {
  k12: 'start here',
  cs: 'for computer scientists',
}

function Diorama({ id, size }: { id: string; size: number }) {
  if (id === 'binpacking') return <BinPackingDiorama size={size} />
  if (id === 'reduction') return <ReductionDiorama size={size} />
  return null
}

/** An unbuilt problem: the plinth is there, the model is not. Deliberately. */
function EmptyModel({ size }: { size: number }) {
  return (
    <group position={[0, size * 0.16, 0]}>
      <mesh>
        <boxGeometry args={[size * 0.32, size * 0.32, size * 0.32]} />
        <meshBasicMaterial color="#2f3947" wireframe transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

function Plinth({
  meta,
  spot,
  onOpen,
}: {
  meta: ActivityMeta
  spot: [number, number]
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const ready = meta.status === 'ready'
  const lit = hovered && ready

  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!ready) return
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const leave = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = 'auto'
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (ready) onOpen()
  }

  return (
    <group position={[spot[0], 0, spot[1]]}>
      {/* One catch volume over the whole plinth, so the entire exhibit is the
          target rather than whichever tiny block happens to be under the cursor.
          Invisible, and the models inside raise no pointer events of their own. */}
      <mesh
        position={[0, PLINTH.plateY / 2, 0]}
        visible={false}
        onPointerOver={enter}
        onPointerOut={leave}
        onClick={click}
      >
        <boxGeometry args={[PLINTH.width, PLINTH.plateY + PLINTH.height, PLINTH.depth]} />
      </mesh>

      <mesh position={[0, -PLINTH.height / 2, 0]}>
        <boxGeometry args={[PLINTH.width, PLINTH.height, PLINTH.depth]} />
        <meshStandardMaterial
          color={lit ? '#233043' : ready ? '#1b2129' : '#161a20'}
          roughness={0.85}
        />
      </mesh>

      {ready ? <Diorama id={meta.id} size={PLINTH.model} /> : <EmptyModel size={PLINTH.model} />}

      {/* The name plate is the lesson, not decoration: the worksheet spends a
          whole page on "this game has a name, and knowing it lets you recognise
          the game again". */}
      <Billboard position={[0, PLINTH.plateY, 0]}>
        <Text
          font={FONT_URL}
          fontSize={0.17}
          color={ready ? (lit ? '#ffffff' : '#e7ecf3') : '#6b7787'}
          anchorX="center"
          anchorY="middle"
          maxWidth={PLINTH.width * 1.5}
          outlineWidth={0.01}
          outlineColor="#0b0e12"
        >
          {meta.title}
        </Text>
        <Text
          font={FONT_URL}
          position={[0, -0.24, 0]}
          fontSize={0.115}
          color={ready ? '#8fa0b6' : '#5c6675'}
          anchorX="center"
          anchorY="middle"
          maxWidth={PLINTH.width * 1.4}
          outlineWidth={0.008}
          outlineColor="#0b0e12"
        >
          {ready ? meta.blurb : 'not built yet — add it'}
        </Text>
      </Billboard>
    </group>
  )
}

export function HallActivity({ onNavigate }: ActivityProps) {
  const exhibits = shelf()
  const rows = Math.ceil(exhibits.length / PLINTH.cols)

  /** Each rank centred on its own count, so a short back rank is not lopsided. */
  const spot = (i: number): [number, number] => {
    const row = Math.floor(i / PLINTH.cols)
    const inRow = Math.min(PLINTH.cols, exhibits.length - row * PLINTH.cols)
    return [
      ((i % PLINTH.cols) - (inRow - 1) / 2) * PLINTH.pitchX,
      // Later ranks sit further from the viewer.
      ((rows - 1) / 2 - row) * PLINTH.pitchZ,
    ]
  }

  const halfX = ((PLINTH.cols - 1) * PLINTH.pitchX + PLINTH.width) / 2
  const halfZ = ((rows - 1) * PLINTH.pitchZ + PLINTH.depth) / 2
  const view = fitCamera(
    boxCorners([-halfX, -PLINTH.height, -halfZ], [halfX, PLINTH.plateY + 0.6, halfZ]),
    window.innerWidth / window.innerHeight,
    { fov: FOV, margin: FRAMING_MARGIN, viewDir: VIEW_DIR },
  )

  return (
    <>
      <SceneShell
        camera={{ position: view.position, fov: FOV }}
        extent={view.extent}
        target={view.center}
        damping={!PARAMS.static}
      >
        {exhibits.map((meta, i) => (
          <Plinth key={meta.id} meta={meta} spot={spot(i)} onOpen={() => onNavigate(meta.id)} />
        ))}

        {/* Which part of the collection you are looking at, written on the floor
            in front of that wing's plinths. */}
        {(['k12', 'cs'] as const).map((wing) => {
          const spots = exhibits
            .map((e, i) => [e, spot(i)] as const)
            .filter(([e]) => e.wing === wing)
          if (spots.length === 0) return null
          const cx = spots.reduce((sum, [, p]) => sum + p[0], 0) / spots.length
          const front = Math.max(...spots.map(([, p]) => p[1]))
          return (
            <Text
              key={wing}
              font={FONT_URL}
              position={[cx, 0.01, front + PLINTH.depth / 2 + 0.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.2}
              color="#5c6675"
              anchorX="center"
              anchorY="middle"
            >
              {WING_LABEL[wing] ?? wing}
            </Text>
          )
        })}
      </SceneShell>

      <div className="hud">
        <div>
          <strong>Redux</strong>
        </div>
        <div className="dim">pick a problem</div>
        <div className="dim">
          {exhibits.filter((e) => e.status === 'ready').length} of {exhibits.length} built
        </div>
        <div className="dim">{exhibits.map((e) => e.title).join(' · ')}</div>
      </div>
    </>
  )
}
