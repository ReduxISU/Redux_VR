import { Text } from '@react-three/drei'
import { nodeColor, type World } from '@redux-xvr/layout'
import { DoubleSide } from 'three'
import { FONT_URL } from './typography.js'

const TOKEN_WIDTH = 0.78
const TOKEN_HEIGHT = 0.5
const TOKEN_DEPTH = 0.12
const SHELF_HEIGHT = 0.78
const SHELF_DEPTH = 0.06
const LABEL_SIZE = 0.26
/** Just clear of the token's front face. */
const TEXT_Z = TOKEN_DEPTH / 2 + 0.01

/** The formula panel is a flat sheet: symbolic content reads better arranged the
 *  way it is written than spread through depth. */
function Shelves({ world }: { world: World }) {
  return (
    <>
      {world.groups.map((group) => (
        <mesh
          key={group.id}
          position={[group.centroid[0], group.centroid[1], group.centroid[2] - 0.09]}
        >
          <boxGeometry args={[group.radius * 2, SHELF_HEIGHT, SHELF_DEPTH]} />
          <meshBasicMaterial color="#2a3340" transparent opacity={0.55} side={DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

function Literals({ world }: { world: World }) {
  return (
    <>
      {world.nodes.map((node) => {
        const satisfied = node.color === 'Solution'
        return (
          <group key={node.id} position={node.position as unknown as [number, number, number]}>
            <mesh>
              <boxGeometry args={[TOKEN_WIDTH, TOKEN_HEIGHT, TOKEN_DEPTH]} />
              <meshStandardMaterial
                color={nodeColor(node.color)}
                roughness={0.55}
                metalness={0.05}
                emissive={satisfied ? nodeColor(node.color) : '#000000'}
                emissiveIntensity={satisfied ? 0.3 : 0}
              />
            </mesh>
            {/* Flat on the token, not billboarded: a rotating text quad clips into
                the box it sits on, and a formula is a page rather than a marker. */}
            <Text
              font={FONT_URL}
              position={[0, 0, TEXT_Z]}
              fontSize={LABEL_SIZE}
              color="#11161d"
              anchorX="center"
              anchorY="middle"
            >
              {node.label}
            </Text>
          </group>
        )
      })}
    </>
  )
}

/**
 * Connectives, derived from token positions rather than stored in the layout —
 * they are decoration, not structure. Without them the panel is a grid of tiles;
 * with them it is recognisably the formula the student typed.
 */
function Connectives({ world }: { world: World }) {
  const byId = new Map(world.nodes.map((n) => [n.id, n]))

  const disjunctions = world.groups.flatMap((group) => {
    const points = group.members
      .map((id) => byId.get(id)?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
    return points.slice(0, -1).map((p, i) => {
      const next = points[i + 1] as NonNullable<typeof p>
      return {
        key: `${group.id}-or-${i}`,
        position: [(p[0] + next[0]) / 2, p[1], TEXT_Z] as [number, number, number],
      }
    })
  })

  const conjunctions = world.groups.slice(0, -1).map((group, i) => {
    const next = world.groups[i + 1]
    const y = next ? (group.centroid[1] + next.centroid[1]) / 2 : group.centroid[1]
    return { key: `${group.id}-and`, position: [0, y, TEXT_Z] as [number, number, number] }
  })

  return (
    <>
      {disjunctions.map((d) => (
        <Text
          key={d.key}
          font={FONT_URL}
          position={d.position}
          fontSize={0.26}
          color="#8fa0b6"
          anchorX="center"
          anchorY="middle"
        >
          ∨
        </Text>
      ))}
      {conjunctions.map((c) => (
        <Text
          key={c.key}
          font={FONT_URL}
          position={c.position}
          fontSize={0.3}
          color="#c6d2e2"
          anchorX="center"
          anchorY="middle"
        >
          ∧
        </Text>
      ))}
    </>
  )
}

export function FormulaWorld({ world }: { world: World }) {
  return (
    <group position={world.origin as unknown as [number, number, number]} scale={world.scale}>
      <Shelves world={world} />
      <Connectives world={world} />
      <Literals world={world} />
    </group>
  )
}
