import { Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { PALETTE } from '@redux-vr/layout'
import {
  COLORING,
  type Coloring,
  type ColoringInstance,
  type ColoringLayout,
  coloringConflicts,
} from '@redux-vr/puzzle'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { FONT_URL } from '../../scene/typography.js'
import { inkOn, paintColor, UNPAINTED } from './palette.js'

const CLASH = PALETTE.ElementHighlight as string
const WALL = '#46566b'

function lineGeometry(points: number[]) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  return geo
}

/**
 * Every wall, and then the offending ones again on top.
 *
 * Two passes rather than per-edge colouring: a clash is the thing a student is
 * hunting for, so it is drawn last, brighter, and a hair higher off the table
 * where nothing can hide it.
 */
function Walls({
  instance,
  layout,
  coloring,
}: {
  instance: ColoringInstance
  layout: ColoringLayout
  coloring: Coloring
}) {
  const at = layout.positions
  const geometry = (edges: typeof instance.edges, y: number) =>
    lineGeometry(
      edges.flatMap((e) => {
        const a = at[e.a] ?? [0, 0, 0]
        const b = at[e.b] ?? [0, 0, 0]
        return [a[0], y, a[2], b[0], y, b[2]]
      }),
    )

  const all = useMemo(() => geometry(instance.edges, 0.02), [instance, layout])
  const clashing = coloringConflicts(instance, coloring)
  const bad = useMemo(() => geometry(clashing, 0.05), [clashing, layout])

  return (
    <>
      <lineSegments geometry={all}>
        <lineBasicMaterial color={WALL} transparent opacity={0.6} />
      </lineSegments>
      <lineSegments geometry={bad}>
        <lineBasicMaterial color={CLASH} transparent opacity={1} />
      </lineSegments>
    </>
  )
}

function Region({
  id,
  position,
  color,
  clashing,
  onPaint,
}: {
  id: string
  position: [number, number, number]
  color: number | undefined
  clashing: boolean
  onPaint: (id: string) => void
}) {
  const painted = color !== undefined
  const fill = painted ? paintColor(color) : UNPAINTED
  const ink = painted ? inkOn(fill) : '#c6d2e2'

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onPaint(id)
  }
  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    document.body.style.cursor = 'auto'
  }

  return (
    <group position={position}>
      <mesh
        position={[0, COLORING.height / 2, 0]}
        onClick={click}
        onPointerOver={enter}
        onPointerOut={leave}
      >
        <cylinderGeometry args={[COLORING.radius, COLORING.radius, COLORING.height, 28]} />
        <meshStandardMaterial color={fill} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* A ring, not a fill: it marks the clash without repainting the region a
          student just chose, which would hide the mistake they need to see. */}
      {clashing && (
        <mesh position={[0, COLORING.height + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[COLORING.radius * 1.05, COLORING.radius * 1.28, 28]} />
          <meshBasicMaterial color={CLASH} />
        </mesh>
      )}

      {/* Flat on the lid, read from above, like a label on a map. */}
      <group position={[0, COLORING.height + 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text
          font={FONT_URL}
          position={[0, painted ? 0.09 : 0, 0]}
          fontSize={0.28}
          color={ink}
          anchorX="center"
          anchorY="middle"
        >
          {id}
        </Text>
        {painted && (
          <Text
            font={FONT_URL}
            position={[0, -0.14, 0]}
            fontSize={0.16}
            color={ink}
            fillOpacity={0.8}
            anchorX="center"
            anchorY="middle"
          >
            {/* The colour's number: hue must never be the only thing that says
                two regions differ. */}
            {String(color + 1)}
          </Text>
        )}
      </group>
    </group>
  )
}

export interface RegionsProps {
  instance: ColoringInstance
  layout: ColoringLayout
  coloring: Coloring
  interactive?: boolean
  onPaint?: (id: string) => void
}

export function Regions({ instance, layout, coloring, interactive = true, onPaint }: RegionsProps) {
  const clashing = new Set(coloringConflicts(instance, coloring).flatMap((e) => [e.a, e.b]))
  const noop = () => {}

  return (
    <group>
      <Walls instance={instance} layout={layout} coloring={coloring} />
      {instance.nodes.map((id) => (
        <Region
          key={id}
          id={id}
          position={(layout.positions[id] ?? [0, 0, 0]) as [number, number, number]}
          color={coloring[id]}
          clashing={clashing.has(id)}
          onPaint={interactive ? (onPaint ?? noop) : noop}
        />
      ))}
    </group>
  )
}
