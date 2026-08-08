import { Billboard, Text } from '@react-three/drei'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { PALETTE } from '@redux-vr/layout'
import {
  type BinBody,
  type BinPackingInstance,
  binLoad,
  type ItemBody,
  type Placement,
  PUZZLE,
  type PuzzleLayout,
  restingPositions,
} from '@redux-vr/puzzle'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import type { Held, Point3 } from '../../drag.js'
import { FONT_URL } from '../../scene/typography.js'

/** Blocks ride above the tallest container while in hand, so nothing occludes them. */
export const LIFT = 1.2

const OUTLINE = '#46566b'
const OVER = PALETTE.ElementHighlight as string
const TARGET = PALETTE.Solution as string

/**
 * Same size, same colour, always — so a student can see at a glance that two
 * blocks are interchangeable. Paul Tol's colourblind-safe set, the one the D3
 * views already use.
 */
const TINTS = ['Cyan', 'Sand', 'Teal', 'Rose', 'Olive', 'Purple', 'Wine', 'Green', 'Indigo']
const blockColor = (size: number) => PALETTE[TINTS[size % TINTS.length] as string] as string

/** The palette spans Sand to Indigo, so a fixed ink colour is unreadable on half of it. */
function inkOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const luma = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return luma > 140 ? '#12151a' : '#f2f6fb'
}

function lineGeometry(points: number[]) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  return geo
}

/** The twelve edges of the capacity volume — an open crate, not a solid box. */
function crateEdges(bin: BinBody): number[] {
  const [cx, y0, cz] = bin.position
  const [hw, hd] = [bin.width / 2, bin.depth / 2]
  const y1 = y0 + bin.height
  const corners: [number, number][] = [
    [cx - hw, cz - hd],
    [cx + hw, cz - hd],
    [cx + hw, cz + hd],
    [cx - hw, cz + hd],
  ]

  const out: number[] = []
  corners.forEach(([ax, az], i) => {
    const [bx, bz] = corners[(i + 1) % 4] as [number, number]
    out.push(ax, y0, az, bx, y0, bz)
    out.push(ax, y1, az, bx, y1, bz)
    out.push(ax, y0, az, ax, y1, az)
  })
  return out
}

/**
 * The 0–10 scale printed up the side of the classroom truck.
 *
 * Without it the container is just a box and its height means nothing; with it,
 * "does this fit" is a question a student can answer by looking.
 */
function capacityTicks(bin: BinBody, capacity: number): number[] {
  const x = bin.position[0] - bin.width / 2
  const z = bin.position[2] + bin.depth / 2
  const out: number[] = []
  for (let unit = 1; unit < capacity; unit++) {
    const y = bin.position[1] + unit * PUZZLE.unit
    const len = unit % 5 === 0 ? 0.36 : 0.18
    out.push(x - len, y, z, x, y, z)
  }
  return out
}

function Crate({
  bin,
  instance,
  placement,
  targeted,
}: {
  bin: BinBody
  instance: BinPackingInstance
  placement: Placement
  targeted: boolean
}) {
  const edges = useMemo(() => lineGeometry(crateEdges(bin)), [bin])
  const ticks = useMemo(
    () => lineGeometry(capacityTicks(bin, instance.capacity)),
    [bin, instance.capacity],
  )

  const load = binLoad(instance, placement, bin.index)
  const over = load > instance.capacity
  const color = over ? OVER : targeted ? TARGET : OUTLINE

  return (
    <group>
      <mesh position={[bin.position[0], bin.position[1] - 0.04, bin.position[2]]}>
        <boxGeometry args={[bin.width, 0.08, bin.depth]} />
        <meshStandardMaterial color={targeted ? '#1d3b2c' : '#232c37'} roughness={0.9} />
      </mesh>

      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={targeted || over ? 1 : 0.8} />
      </lineSegments>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color={color} transparent opacity={targeted || over ? 1 : 0.9} />
      </lineSegments>

      {/* Pinned at the rim and standing in front of the crate.
          On the floor in front, the tray hides it; on the floor behind, a full
          crate hides it; riding on top of the stack, an over-full crate carries
          it off the top of the frame — which is exactly when the number matters
          most. Fixed at the rim it stays framed, and being nearest the camera it
          draws over whatever is bursting out behind it. */}
      <Billboard
        position={[
          bin.position[0],
          bin.position[1] + bin.height + 0.42,
          bin.position[2] + bin.depth / 2 + 0.35,
        ]}
      >
        <Text
          font={FONT_URL}
          fontSize={0.34}
          color={over ? OVER : '#c6d2e2'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.016}
          outlineColor="#0b0e12"
        >
          {`${load}/${instance.capacity}`}
        </Text>
      </Billboard>
    </group>
  )
}

function Block({
  item,
  position,
  held,
  onGrab,
}: {
  item: ItemBody
  position: Point3
  held: boolean
  onGrab: (id: string, at: Point3) => void
}) {
  const grab = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // Lift straight up rather than jumping to the cursor: the block stays under
    // the hand that reached for it until the pointer actually moves.
    onGrab(item.id, [position[0], LIFT + item.height / 2, position[2]])
  }
  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'grab'
  }
  const leave = () => {
    document.body.style.cursor = 'auto'
  }

  return (
    <group position={position}>
      {/* No `raycast` toggle to mute the block while it is carried: switching that
          prop back to undefined strips the mesh's raycast for good, so a block
          could be placed once and then never picked up again. It does not need
          muting anyway — it has no move or up handler, so R3F carries those
          straight through to the plane behind it. */}
      <mesh onPointerDown={grab} onPointerOver={enter} onPointerOut={leave}>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial
          color={blockColor(item.size)}
          roughness={0.55}
          metalness={0.05}
          emissive={held ? blockColor(item.size) : '#000000'}
          emissiveIntensity={held ? 0.35 : 0}
        />
      </mesh>
      {/* Flat on the face, not billboarded: a numbered block carries its number
          the way the plywood one does, and a rotating quad clips into the box. */}
      <Text
        font={FONT_URL}
        position={[0, 0, item.depth / 2 + 0.01]}
        fontSize={Math.min(0.42, item.height * 0.62)}
        color={inkOn(blockColor(item.size))}
        anchorX="center"
        anchorY="middle"
      >
        {String(item.size)}
      </Text>
    </group>
  )
}

/**
 * A large invisible sheet at carry height, mounted only while something is held.
 *
 * Every pointer sample during a drag lands on this, so the drag point is just
 * the hit point — no ray maths, no pointer capture, and identical behaviour for
 * a mouse, a finger and a controller ray.
 */
function CarryPlane({ onMove, onDrop }: { onMove: (at: Point3) => void; onDrop: () => void }) {
  const track = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onMove([e.point.x, e.point.y, e.point.z])
  }
  return (
    <mesh
      position={[0, LIFT, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      onPointerMove={track}
      onPointerUp={onDrop}
    >
      <planeGeometry args={[400, 400]} />
    </mesh>
  )
}

/** Orbiting while dragging spins the board out from under the block. */
function OrbitGate({ locked }: { locked: boolean }) {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  useEffect(() => {
    if (!controls) return
    controls.enabled = !locked
    return () => {
      controls.enabled = true
    }
  }, [controls, locked])
  return null
}

export interface BoardProps {
  instance: BinPackingInstance
  layout: PuzzleLayout
  placement: Placement
  held: Held | null
  /** Bin the held block would land in, if released now. */
  target: number | undefined
  onGrab: (id: string, at: Point3) => void
  onMove: (at: Point3) => void
  onDrop: () => void
}

export function Board({
  instance,
  layout,
  placement,
  held,
  target,
  onGrab,
  onMove,
  onDrop,
}: BoardProps) {
  const resting = useMemo(() => restingPositions(layout, placement), [layout, placement])

  return (
    <group>
      {layout.bins.map((bin) => (
        <Crate
          key={bin.id}
          bin={bin}
          instance={instance}
          placement={placement}
          targeted={target === bin.index}
        />
      ))}

      {layout.items.map((item) => {
        const carried = held?.id === item.id
        const at = carried ? held.point : (resting[item.id] ?? [0, 0, 0])
        return <Block key={item.id} item={item} position={at} held={carried} onGrab={onGrab} />
      })}

      {held && <CarryPlane onMove={onMove} onDrop={onDrop} />}
      <OrbitGate locked={held !== null} />
    </group>
  )
}
