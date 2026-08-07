import { Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { FONT_URL } from '../typography.js'

/**
 * The one in-scene UI primitive.
 *
 * An immersive XR session has no DOM overlay, so every control has to be
 * geometry. R3F raises pointer events from a controller ray exactly as it does
 * from a mouse, so this serves the flat browser and the headset without a second
 * implementation.
 */

export interface ButtonProps {
  position: [number, number, number]
  width: number
  height: number
  label: string
  detail?: string
  accent?: string
  active?: boolean
  disabled?: boolean
  onSelect: () => void
}

export function Button3D({
  position,
  width,
  height,
  label,
  detail,
  accent,
  active,
  disabled,
  onSelect,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false)

  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (disabled) return
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
    if (!disabled) onSelect()
  }

  const fill = active ? '#143b28' : hovered && !disabled ? '#232c37' : '#1b2129'
  const border = active ? '#00e676' : hovered && !disabled ? '#46566b' : '#2f3947'
  const text = disabled ? '#5c6675' : active ? '#eafff2' : '#c6d2e2'

  return (
    <group position={position}>
      <mesh onPointerOver={enter} onPointerOut={leave} onClick={click}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={fill} transparent opacity={disabled ? 0.5 : 0.95} />
      </mesh>
      {/* Thin quad behind the face, showing only at the edges, as a border. */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.05, height + 0.05]} />
        <meshBasicMaterial color={border} transparent opacity={disabled ? 0.4 : 1} />
      </mesh>
      {accent && (
        <mesh position={[-width / 2 + 0.22, 0, 0.01]}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      )}
      <Text
        font={FONT_URL}
        position={[accent ? 0.16 : 0, detail ? 0.11 : 0, 0.02]}
        // Shrink rather than wrap: a wrapped label overruns its own subtitle, and
        // problem names like DIRECTEDHAMILTONIAN are long.
        fontSize={label.length > 26 ? 0.185 : 0.235}
        color={text}
        anchorX="center"
        anchorY="middle"
        maxWidth={width - 0.3}
      >
        {label}
      </Text>
      {detail && (
        <Text
          font={FONT_URL}
          position={[accent ? 0.16 : 0, -0.15, 0.02]}
          fontSize={0.16}
          color={disabled ? '#4d5663' : '#8fa0b6'}
          anchorX="center"
          anchorY="middle"
          maxWidth={width - 0.5}
        >
          {detail}
        </Text>
      )}
    </group>
  )
}
