import { Billboard, Text } from '@react-three/drei'
import type { CatalogItem } from '../api/catalog.js'
import { FONT_URL } from './typography.js'
import { Button3D } from './ui/Button3D.js'

/**
 * Scene-space UI for the reduction activity: highlight modes, and the catalog of
 * reductions the backend can actually draw. Built from `Button3D`, which is the
 * shared in-scene control primitive.
 */

export const PANEL = {
  modeW: 3.1,
  modeH: 0.72,
  gap: 0.24,
  itemW: 5.3,
  itemH: 0.64,
  cols: 2,
  rows: 6,
  pad: 0.4,
} as const

const BADGE = {
  linked: '#00e676',
  unlinked: '#f69240',
  unsupported: '#6b7787',
} as const

const listWidth = () => PANEL.cols * PANEL.itemW + (PANEL.cols - 1) * PANEL.gap
const listHeight = () => PANEL.rows * PANEL.itemH + (PANEL.rows - 1) * PANEL.gap

export function panelWidth(open: boolean): number {
  const bar = 3 * PANEL.modeW + 2 * PANEL.gap
  return (open ? Math.max(bar, listWidth()) : bar) + PANEL.pad * 2
}

const TITLE_H = 0.46

export function panelHeight(open: boolean): number {
  const base = TITLE_H + PANEL.modeH + 0.5 + PANEL.modeH
  return (open ? base + listHeight() + PANEL.gap : base) + PANEL.pad * 2
}

export interface ControlPanelProps {
  anchor: [number, number, number]
  modes: { key: string; label: string; count: number }[]
  activeMode: string
  onMode: (key: string) => void
  hint: string
  title: string
  catalog: CatalogItem[]
  currentReduction: string
  onReduction: (className: string) => void
  open: boolean
  onToggle: () => void
  busy: boolean
  onExit: () => void
}

export function ControlPanel({
  anchor,
  modes,
  activeMode,
  onMode,
  hint,
  title,
  catalog,
  currentReduction,
  onReduction,
  open,
  onToggle,
  busy,
  onExit,
}: ControlPanelProps) {
  const w = panelWidth(open)
  const h = panelHeight(open)
  const top = h / 2 - PANEL.pad

  // Unsupported reductions are listed nowhere: they cannot be drawn, and offering
  // a dead control teaches nothing. Their count is reported instead.
  const selectable = catalog.filter((c) => c.capability.state !== 'unsupported')
  const hidden = catalog.length - selectable.length
  const page = selectable.slice(0, PANEL.cols * PANEL.rows)

  const titleY = top - TITLE_H / 2
  const modeY = titleY - TITLE_H / 2 - PANEL.modeH / 2
  const hintY = modeY - PANEL.modeH / 2 - 0.22
  const toggleY = hintY - 0.22 - PANEL.modeH / 2
  const listTop = toggleY - PANEL.modeH / 2 - PANEL.gap

  return (
    <Billboard position={anchor}>
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#12151a" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.07]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshBasicMaterial color="#2a3340" transparent opacity={0.95} />
      </mesh>

      {/* Repeated from the DOM HUD on purpose: that overlay does not exist inside
          an immersive session, so anything a student needs must be geometry. */}
      <Text
        font={FONT_URL}
        position={[0, titleY, 0]}
        fontSize={0.26}
        color="#e7ecf3"
        anchorX="center"
        anchorY="middle"
        maxWidth={w - 0.8}
      >
        {title}
      </Text>

      {modes.map((m, i) => (
        <Button3D
          key={m.key}
          position={[(i - 1) * (PANEL.modeW + PANEL.gap), modeY, 0]}
          width={PANEL.modeW}
          height={PANEL.modeH}
          label={m.label}
          active={m.key === activeMode}
          disabled={m.count === 0}
          onSelect={() => onMode(m.key)}
        />
      ))}

      <Text
        font={FONT_URL}
        position={[0, hintY, 0]}
        fontSize={0.185}
        color="#8fa0b6"
        anchorX="center"
        anchorY="middle"
        maxWidth={w - 0.8}
      >
        {busy ? 'loading reduction…' : hint}
      </Text>

      {/* Beside the toggle rather than in the mode row: the modes say what the
          reduction shows, and leaving the room is not one of them. */}
      <Button3D
        position={[-(PANEL.modeW * 0.8 + PANEL.gap + PANEL.modeW / 2), toggleY, 0]}
        width={PANEL.modeW}
        height={PANEL.modeH}
        label="Hall"
        onSelect={onExit}
      />
      <Button3D
        position={[0, toggleY, 0]}
        width={PANEL.modeW * 1.6}
        height={PANEL.modeH}
        label={`${open ? '▾' : '▸'}  Reductions`}
        detail={`${selectable.length} available · ${hidden} not renderable`}
        active={open}
        onSelect={onToggle}
      />

      {open &&
        page.map((item, i) => {
          const col = i % PANEL.cols
          const row = Math.floor(i / PANEL.cols)
          const x = (col - (PANEL.cols - 1) / 2) * (PANEL.itemW + PANEL.gap)
          const y = listTop - PANEL.itemH / 2 - row * (PANEL.itemH + PANEL.gap)
          const linked = item.capability.state === 'linked'
          return (
            <Button3D
              key={item.className}
              position={[x, y, 0]}
              width={PANEL.itemW}
              height={PANEL.itemH}
              label={`${item.source} → ${item.target}`}
              detail={
                linked && item.capability.state === 'linked'
                  ? `${item.capability.gadgets} gadgets`
                  : 'no gadgets published'
              }
              accent={BADGE[item.capability.state]}
              active={item.className === currentReduction}
              onSelect={() => onReduction(item.className)}
            />
          )
        })}
    </Billboard>
  )
}
