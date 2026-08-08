import { createTunnel } from './tunnel.js'

/**
 * The DOM readout, published from inside the canvas.
 *
 * One per app: only one activity is on screen at a time, and the screenshot
 * tool reads this text to assert what the scene is doing (`--await-text`), so
 * it has to be real DOM rather than in-scene geometry.
 */
export const Hud = createTunnel()
