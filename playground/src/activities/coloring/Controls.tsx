import { Billboard, Text } from '@react-three/drei'
import { PALETTE } from '@redux-vr/layout'
import { FONT_URL } from '../../scene/typography.js'
import { Button3D } from '../../scene/ui/Button3D.js'
import { paintColor } from './palette.js'

const BUTTON = { width: 2.3, height: 0.62, gap: 0.24 }
const SWATCH = { width: 1.2, height: 0.58, gap: 0.2 }

export type Verdict =
  | { state: 'idle' }
  | { state: 'asking' }
  | { state: 'answered'; fits: boolean }
  /** The referee could not be reached — never guessed at locally. */
  | { state: 'unreachable'; message: string }

export interface ControlsProps {
  anchor: [number, number, number]
  verdict: Verdict
  colors: number
  active: number
  remaining: number
  clashes: number
  hinting: boolean
  hintNote: string | null
  paintedAnything: boolean
  /** Absent when no authored map depicts this instance — nothing to lift. */
  lifted?: boolean
  onLift?: () => void
  onColor: (index: number) => void
  onCheck: () => void
  onHint: () => void
  onReset: () => void
  onExit: () => void
}

function headline(verdict: Verdict, remaining: number, clashes: number, hintNote: string | null) {
  if (hintNote) return { text: hintNote, color: PALETTE.ElementHighlight as string }
  switch (verdict.state) {
    case 'asking':
      return { text: 'asking Redux…', color: '#8fa0b6' }
    case 'answered':
      return verdict.fits
        ? { text: 'It works! Redux checked it.', color: PALETTE.Solution as string }
        : {
            text: 'Not quite — two touching regions match.',
            color: PALETTE.ElementHighlight as string,
          }
    case 'unreachable':
      return { text: `Could not reach Redux — ${verdict.message}`, color: '#8fa0b6' }
    default:
      if (remaining > 0) {
        return {
          text: `Pick a colour, then a region. ${remaining} still uncoloured.`,
          color: '#8fa0b6',
        }
      }
      return clashes > 0
        ? {
            text: `${clashes} pair${clashes === 1 ? '' : 's'} of neighbours still match.`,
            color: PALETTE.ElementHighlight as string,
          }
        : { text: 'Every region is coloured. Ask Redux if it works.', color: '#c6d2e2' }
  }
}

export function Controls({
  anchor,
  verdict,
  colors,
  active,
  remaining,
  clashes,
  hinting,
  hintNote,
  paintedAnything,
  lifted,
  onLift,
  onColor,
  onCheck,
  onHint,
  onReset,
  onExit,
}: ControlsProps) {
  const pitch = BUTTON.width + BUTTON.gap
  const slots = onLift ? 5 : 4
  const at = (slot: number) => (slot - (slots - 1) / 2) * pitch
  const swatchPitch = SWATCH.width + SWATCH.gap
  const line = headline(verdict, remaining, clashes, hintNote)

  return (
    <Billboard position={anchor}>
      <Text
        font={FONT_URL}
        position={[0, BUTTON.height / 2 + 1.28, 0]}
        fontSize={0.26}
        color={line.color}
        anchorX="center"
        anchorY="middle"
        maxWidth={pitch * 4}
        outlineWidth={0.016}
        outlineColor="#0b0e12"
      >
        {line.text}
      </Text>

      {/* The paint tray. Each swatch is labelled with its number, so the choice
          is legible without relying on hue. */}
      {Array.from({ length: colors }, (_, i) => (
        <Button3D
          key={paintColor(i)}
          position={[(i - (colors - 1) / 2) * swatchPitch, BUTTON.height / 2 + 0.55, 0]}
          width={SWATCH.width}
          height={SWATCH.height}
          label={String(i + 1)}
          accent={paintColor(i)}
          active={i === active}
          onSelect={() => onColor(i)}
        />
      ))}

      <Button3D
        position={[at(0), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label="Hall"
        detail="pick another problem"
        onSelect={onExit}
      />
      <Button3D
        position={[at(1), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label="Check it"
        disabled={remaining > 0 || verdict.state === 'asking'}
        active={verdict.state === 'answered' && verdict.fits}
        onSelect={onCheck}
      />
      <Button3D
        position={[at(2), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label={hinting ? 'thinking…' : 'Show me'}
        detail="Greedy"
        disabled={hinting}
        onSelect={onHint}
      />
      {onLift && (
        <Button3D
          position={[at(3), 0, 0]}
          width={BUTTON.width}
          height={BUTTON.height}
          label={lifted ? 'Lay it flat' : 'Lift it'}
          detail={lifted ? 'back to the map' : 'the map is a graph'}
          active={lifted}
          onSelect={onLift}
        />
      )}
      <Button3D
        position={[at(slots - 1), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label="Start over"
        disabled={!paintedAnything}
        onSelect={onReset}
      />
    </Billboard>
  )
}
