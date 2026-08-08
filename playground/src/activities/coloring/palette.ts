import { PALETTE } from '@redux-vr/layout'

/**
 * The colours a student paints with.
 *
 * Paul Tol's colourblind-safe set, the one the D3 views already use — but the
 * whole point of this puzzle is "these two must not match", so hue is never
 * left to carry that alone: a painted node also shows its colour's *number*,
 * and a wall between two matching regions turns amber rather than merely
 * staying the same colour on both sides.
 */
const KEYS = ['Cyan', 'Sand', 'Rose', 'Teal', 'Purple', 'Olive', 'Green', 'Wine', 'Indigo']

export const UNPAINTED = '#3a4453'

export function paintColor(index: number): string {
  return (PALETTE[KEYS[index % KEYS.length] as string] as string) ?? UNPAINTED
}

/** Readable ink for a label sitting on `hex`; the set spans Sand to Indigo. */
export function inkOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const luma = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return luma > 140 ? '#12151a' : '#f2f6fb'
}
