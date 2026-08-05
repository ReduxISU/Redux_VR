import { Billboard, Instance, Instances, Text } from '@react-three/drei'
import { edgeColor, nodeColor, type World } from '@redux-xvr/layout'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'

const VERTEX_RADIUS = 0.17
const SOLUTION_SCALE = 1.45
const LABEL_SIZE = 0.2
const HULL_PADDING = 0.5

function positionMap(world: World) {
  return new Map(world.nodes.map((n) => [n.id, n.position]))
}

function buildEdgeGeometry(world: World, edges: World['edges']) {
  const at = positionMap(world)
  const positions = new Float32Array(edges.length * 6)
  const colors = new Float32Array(edges.length * 6)
  const scratch = new Color()

  edges.forEach((edge, i) => {
    const a = at.get(edge.source) ?? [0, 0, 0]
    const b = at.get(edge.target) ?? [0, 0, 0]
    positions.set([a[0], a[1], a[2], b[0], b[1], b[2]], i * 6)
    scratch.set(edgeColor(edge.color))
    colors.set([scratch.r, scratch.g, scratch.b, scratch.r, scratch.g, scratch.b], i * 6)
  })

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return geo
}

/**
 * Two passes rather than one: the clique's own edges are the answer, so they are
 * drawn opaque while the other 18 recede. One draw call each.
 */
function Edges({ world }: { world: World }) {
  const { plain, solution } = useMemo(() => {
    const isSolution = (e: World['edges'][number]) => e.color === 'Solution'
    return {
      plain: buildEdgeGeometry(
        world,
        world.edges.filter((e) => !isSolution(e)),
      ),
      solution: buildEdgeGeometry(world, world.edges.filter(isSolution)),
    }
  }, [world])

  return (
    <>
      <lineSegments geometry={plain}>
        <lineBasicMaterial vertexColors transparent opacity={0.32} />
      </lineSegments>
      <lineSegments geometry={solution}>
        <lineBasicMaterial vertexColors transparent opacity={1} />
      </lineSegments>
    </>
  )
}

/** Instanced so vertex count stays one draw call as instances grow. */
function Vertices({ world }: { world: World }) {
  return (
    <Instances limit={Math.max(world.nodes.length, 1)} castShadow={false}>
      <sphereGeometry args={[VERTEX_RADIUS, 24, 16]} />
      <meshStandardMaterial roughness={0.4} metalness={0.05} />
      {world.nodes.map((node) => {
        const solved = node.color === 'Solution'
        return (
          <Instance
            key={node.id}
            position={node.position as unknown as [number, number, number]}
            color={nodeColor(node.color)}
            scale={solved ? SOLUTION_SCALE : 1}
          />
        )
      })}
    </Instances>
  )
}

/** Billboarded so labels stay readable from any angle, including in a headset. */
function Labels({ world }: { world: World }) {
  return (
    <>
      {world.nodes.map((node) => (
        <Billboard
          key={node.id}
          position={[node.position[0], node.position[1] + 0.36, node.position[2]]}
        >
          <Text
            fontSize={LABEL_SIZE}
            color={node.color === 'Solution' ? '#eafff2' : '#c6d2e2'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.016}
            outlineColor="#0b0e12"
          >
            {node.label}
          </Text>
        </Billboard>
      ))}
    </>
  )
}

/** Muted, distinguishable per-group tints. Kept off the vertices themselves so
 *  they never compete with the backend's semantic Solution/Background colors. */
const GROUP_TINTS = ['#88CCEE', '#DDCC77', '#CC6677', '#44AA99', '#AA4499', '#999933']

/**
 * A translucent hull per clause group.
 *
 * Without it the layout reads as an undifferentiated scatter, and the grouping is
 * the pedagogical content — the clique takes exactly one vertex per clause. A
 * sphere rather than a disc because a disc facing the group's own plane goes
 * edge-on (and vanishes) at some orbit angles; a sphere reads the same from
 * everywhere. `depthWrite={false}` keeps hulls from occluding the vertices inside.
 */
function GroupHulls({ world }: { world: World }) {
  return (
    <>
      {world.groups.map((group, i) => {
        const tint = GROUP_TINTS[i % GROUP_TINTS.length]
        const r = group.radius + HULL_PADDING
        const center = group.centroid as unknown as [number, number, number]
        return (
          <group key={group.id}>
            <mesh position={center}>
              <sphereGeometry args={[r, 32, 24]} />
              <meshBasicMaterial color={tint} transparent opacity={0.05} depthWrite={false} />
            </mesh>
            <mesh position={center}>
              <sphereGeometry args={[r, 12, 8]} />
              <meshBasicMaterial
                color={tint}
                wireframe
                transparent
                opacity={0.1}
                depthWrite={false}
              />
            </mesh>
            <Billboard position={[center[0], center[1] - r - 0.3, center[2]]}>
              <Text
                fontSize={0.22}
                color={tint}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.016}
                outlineColor="#0b0e12"
              >
                {`clause ${group.label}`}
              </Text>
            </Billboard>
          </group>
        )
      })}
    </>
  )
}

export function GraphWorld({ world }: { world: World }) {
  return (
    <group position={world.origin as unknown as [number, number, number]}>
      <GroupHulls world={world} />
      <Edges world={world} />
      <Vertices world={world} />
      <Labels world={world} />
    </group>
  )
}
