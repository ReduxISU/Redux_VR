import { Billboard, Text } from '@react-three/drei'
import { PALETTE } from '@redux-vr/layout'
import { FONT_URL } from '../../scene/typography.js'
import { Button3D } from '../../scene/ui/Button3D.js'

/**
 * In-scene, like every other control in this project: an immersive session has
 * no DOM overlay, so a button a student needs in a headset has to be geometry.
 */

/** Kept modest: the board is the subject, and the camera has to frame both. */
const BUTTON = { width: 2.3, height: 0.62, gap: 0.24 }

export type Verdict =
  | { state: 'idle' }
  | { state: 'asking' }
  | { state: 'answered'; fits: boolean }
  /** The referee could not be reached — never guessed at locally. */
  | { state: 'unreachable'; message: string }

export interface ControlsProps {
  anchor: [number, number, number]
  verdict: Verdict
  /** Blocks still waiting in the tray. Asking early only earns a misleading "no". */
  remaining: number
  hinting: boolean
  hintNote: string | null
  placedAnything: boolean
  /** Title of the costume this button switches *to*. */
  nextSkinTitle: string
  onCheck: () => void
  onHint: () => void
  onReset: () => void
  onSkin: () => void
  onExit: () => void
}

function headline(verdict: Verdict, remaining: number, hintNote: string | null) {
  if (hintNote) return { text: hintNote, color: PALETTE.ElementHighlight as string }
  switch (verdict.state) {
    case 'asking':
      return { text: 'asking Redux…', color: '#8fa0b6' }
    case 'answered':
      return verdict.fits
        ? { text: 'It fits! Redux checked it.', color: PALETTE.Solution as string }
        : {
            text: 'Not quite — something is over the limit.',
            color: PALETTE.ElementHighlight as string,
          }
    case 'unreachable':
      return { text: `Could not reach Redux — ${verdict.message}`, color: '#8fa0b6' }
    default:
      return remaining > 0
        ? { text: `Place all ${remaining} remaining blocks, then check.`, color: '#8fa0b6' }
        : { text: 'Everything is placed. Ask Redux if it fits.', color: '#c6d2e2' }
  }
}

export function Controls({
  anchor,
  verdict,
  remaining,
  hinting,
  hintNote,
  placedAnything,
  nextSkinTitle,
  onCheck,
  onHint,
  onReset,
  onSkin,
  onExit,
}: ControlsProps) {
  const pitch = BUTTON.width + BUTTON.gap
  const line = headline(verdict, remaining, hintNote)
  /** Five across, centred. */
  const at = (slot: number) => (slot - 2) * pitch

  return (
    <Billboard position={anchor}>
      <Text
        font={FONT_URL}
        position={[0, BUTTON.height / 2 + 0.34, 0]}
        fontSize={0.26}
        color={line.color}
        anchorX="center"
        anchorY="middle"
        maxWidth={pitch * 3}
        outlineWidth={0.016}
        outlineColor="#0b0e12"
      >
        {line.text}
      </Text>

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
        detail="First Fit Decreasing"
        disabled={hinting}
        onSelect={onHint}
      />
      <Button3D
        position={[at(3), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label={nextSkinTitle}
        detail="same puzzle, new story"
        onSelect={onSkin}
      />
      <Button3D
        position={[at(4), 0, 0]}
        width={BUTTON.width}
        height={BUTTON.height}
        label="Start over"
        disabled={!placedAnything}
        onSelect={onReset}
      />
    </Billboard>
  )
}
