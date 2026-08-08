import { Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { PALETTE } from '@redux-vr/layout'
import {
  COLORING,
  type Coloring,
  type ColoringEdge,
  type ColoringInstance,
  type ColoringMap,
  coloringConflicts,
  mapBorder,
  mapCentroid,
} from '@redux-vr/puzzle'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Shape, ShapeGeometry, Vector2 } from 'three'
import { FONT_URL } from '../../scene/typography.js'
import { inkOn, paintColor, UNPAINTED } from './palette.js'

const CLASH = PALETTE.ElementHighlight as string
const WALL = '#46566b'

/** How far a region's marker climbs when the map is lifted into its graph. */
export const LIFT_HEIGHT = 3.4

export type Places = Record<string, [number, number, number]>

function lineGeometry(points: number[]) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  return geo
}

/** Polygons are authored in map coordinates; the shape plane lies down into XZ. */
function regionShape(polygon: readonly (readonly [number, number])[]) {
  return new ShapeGeometry(new Shape(polygon.map(([x, z]) => new Vector2(x, z))))
}

function Territory({
  polygon,
  color,
  opacity,
  onPaint,
}: {
  polygon: readonly (readonly [number, number])[]
  color: string
  opacity: number
  onPaint: () => void
}) {
  const geometry = useMemo(() => regionShape(polygon), [polygon])
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onPaint()
  }
  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    document.body.style.cursor = 'auto'
  }

  return (
    <mesh
      geometry={geometry}
      position={[0, 0.01, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      visible={opacity > 0.01}
      onClick={click}
      onPointerOver={enter}
      onPointerOut={leave}
    >
      <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} />
    </mesh>
  )
}

/**
 * The whole point of drawing a map at all.
 *
 * Territories fade out and their markers climb, so a student watches the map
 * *become* the graph rather than being told that maps are graphs. Nothing moves
 * sideways: a marker rises straight out of its own region, which is what makes
 * the claim legible.
 */
function MapWalls({
  map,
  clashing,
  opacity,
}: {
  map: ColoringMap
  clashing: ColoringEdge[]
  opacity: number
}) {
  const outlines = useMemo(
    () =>
      lineGeometry(
        map.regions.flatMap((r) =>
          r.polygon.flatMap((p, i) => {
            const q = r.polygon[(i + 1) % r.polygon.length] as readonly [number, number]
            return [p[0], 0.02, p[1], q[0], 0.02, q[1]]
          }),
        ),
      ),
    [map],
  )

  const bad = useMemo(
    () =>
      lineGeometry(
        clashing.flatMap((e) => {
          const border = mapBorder(map, e.a, e.b)
          if (!border) return []
          const [p, q] = border
          return [p[0], 0.05, p[1], q[0], 0.05, q[1]]
        }),
      ),
    [map, clashing],
  )

  if (opacity <= 0.01) return null
  return (
    <>
      <lineSegments geometry={outlines}>
        <lineBasicMaterial color={WALL} transparent opacity={0.7 * opacity} />
      </lineSegments>
      <lineSegments geometry={bad}>
        <lineBasicMaterial color={CLASH} transparent opacity={opacity} />
      </lineSegments>
    </>
  )
}

function Links({
  instance,
  places,
  clashing,
  opacity,
}: {
  instance: ColoringInstance
  places: Places
  clashing: ColoringEdge[]
  opacity: number
}) {
  const build = (edges: ColoringEdge[]) =>
    lineGeometry(
      edges.flatMap((e) => {
        const a = places[e.a] ?? [0, 0, 0]
        const b = places[e.b] ?? [0, 0, 0]
        return [...a, ...b]
      }),
    )
  const all = build(instance.edges)
  const bad = build(clashing)

  if (opacity <= 0.01) return null
  return (
    <>
      <lineSegments geometry={all}>
        <lineBasicMaterial color={WALL} transparent opacity={0.65 * opacity} />
      </lineSegments>
      <lineSegments geometry={bad}>
        <lineBasicMaterial color={CLASH} transparent opacity={opacity} />
      </lineSegments>
    </>
  )
}

function Marker({
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
  /** Where each region's marker sits at ground level. */
  places: Places
  coloring: Coloring
  /** Present only when an authored map genuinely depicts this instance. */
  map?: ColoringMap
  /** 0 is the flat map, 1 is the graph it lifts into. */
  lift?: number
  interactive?: boolean
  onPaint?: (id: string) => void
}

export function Regions({
  instance,
  places,
  coloring,
  map,
  lift = 1,
  interactive = true,
  onPaint,
}: RegionsProps) {
  const clashing = coloringConflicts(instance, coloring)
  const clashingIds = new Set(clashing.flatMap((e) => [e.a, e.b]))
  const noop = () => {}
  const paint = interactive ? (onPaint ?? noop) : noop

  // Without a map there is nothing to lift, so the graph is simply the view.
  const raised = map ? lift : 1
  const lifted: Places = Object.fromEntries(
    Object.entries(places).map(([id, p]) => [id, [p[0], p[1] + raised * LIFT_HEIGHT, p[2]]]),
  )

  return (
    <group>
      {map && (
        <>
          {map.regions.map((region) => (
            <Territory
              key={region.id}
              polygon={region.polygon}
              color={
                coloring[region.id] === undefined
                  ? UNPAINTED
                  : paintColor(coloring[region.id] as number)
              }
              opacity={(1 - raised) * 0.92}
              onPaint={() => paint(region.id)}
            />
          ))}
          <MapWalls map={map} clashing={clashing} opacity={1 - raised} />
        </>
      )}

      <Links instance={instance} places={lifted} clashing={clashing} opacity={raised} />

      {instance.nodes.map((id) => (
        <Marker
          key={id}
          id={id}
          position={lifted[id] ?? [0, 0, 0]}
          color={coloring[id]}
          clashing={clashingIds.has(id)}
          onPaint={paint}
        />
      ))}
    </group>
  )
}

/** Ground-level marker spots for a map: each region's own centroid. */
export function placesFromMap(map: ColoringMap): Places {
  return Object.fromEntries(
    map.regions.map((r) => {
      const [x, z] = mapCentroid(r)
      return [r.id, [x, 0, z] as [number, number, number]]
    }),
  )
}
