/**
 * Every `<Text>` in the scene must pass this font.
 *
 * drei's default (a CDN Roboto subset) has no mathematical operators, so `∨`,
 * `∧`, `¬` and the rest render as nothing — with no error and no warning. See
 * public/fonts/NOTICE.md.
 */
export const FONT_URL = '/fonts/redux-vr.ttf'

/** Dark outline behind glyphs, so labels stay readable against any geometry. */
export const TEXT_OUTLINE = {
  outlineWidth: 0.016,
  outlineColor: '#0b0e12',
} as const
