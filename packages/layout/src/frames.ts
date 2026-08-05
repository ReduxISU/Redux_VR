import type { AnyFrame, ApiFormulaFrame, ApiGraphFrame, WorldKind } from './types.js'

/**
 * Identify a frame's representation family.
 *
 * The backend attaches no discriminator to frames — no `type`, no `$type`, no
 * index — so the only way to tell a graph frame from a formula frame is the keys
 * it carries. Detecting here rather than trusting a caller-supplied
 * `visualizationType` means the renderer stays correct even when a problem's
 * declared metadata disagrees with what it actually returned.
 */
export function detectFrameKind(frame: AnyFrame | undefined): WorldKind | undefined {
  if (!frame) return undefined
  if ('nodes' in frame && 'links' in frame) return 'graph'
  if ('clauses' in frame) return 'formula'
  return undefined
}

export function isGraphFrame(frame: AnyFrame): frame is ApiGraphFrame {
  return detectFrameKind(frame) === 'graph'
}

export function isFormulaFrame(frame: AnyFrame): frame is ApiFormulaFrame {
  return detectFrameKind(frame) === 'formula'
}

/** Families this library can draw today. */
export const RENDERABLE_KINDS: WorldKind[] = ['graph', 'formula']

export function isRenderable(kind: WorldKind | undefined): boolean {
  return kind !== undefined && RENDERABLE_KINDS.includes(kind)
}
