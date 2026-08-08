/**
 * Screenshot the playground so changes can be verified visually.
 *
 * Uses SwiftShader (software WebGL) rather than the host GPU: deterministic,
 * headless, and portable to CI. Waits on window.__sceneReady, never a timer.
 *
 *   node tools/shoot.ts [name] [--url=...] [--width=1280] [--height=720] [--live]
 *                       [--click=x,y] [--drag=x1,y1,x2,y2] [--await-text="..."] [--fake-xr]
 *
 * --click issues a real mouse click at viewport coordinates, which is how the
 * in-scene UI gets exercised: R3F raycasts it exactly as it would a controller ray.
 * --drag does the same for grab-and-place, in steps, so the pointermove handlers
 * that carry an object actually run rather than being skipped by one jump.
 *
 * --click, --drag and --await-text all repeat and run **in the order given**, so
 * a whole session can be scripted against facts rather than timers:
 *
 *   --click=640,610 --await-text='0 to place' --click=460,610 --await-text='True'
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = resolve(ROOT, 'shots')

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const name = process.argv[2]?.startsWith('--') ? 'shot' : (process.argv[2] ?? 'shot')
const width = Number(arg('width', '1280'))
const height = Number(arg('height', '720'))
// --live keeps animation running; default freezes it for comparable output.
const staticFlag = process.argv.includes('--live') ? '' : '?static=1'
const url = arg('url', `http://localhost:5173/${staticFlag}`)

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
    '--hide-scrollbars',
  ],
})

const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })

// Headless Chromium exposes no navigator.xr. Stubbing it exercises the entry
// path — support detection and button state — but says nothing about stereo
// rendering or controllers, which need the Immersive Web Emulator or hardware.
if (process.argv.includes('--fake-xr')) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: async (mode: string) => mode === 'immersive-vr',
        requestSession: async () => {
          throw new Error('stub session')
        },
        addEventListener() {},
        removeEventListener() {},
      },
    })
  })
}

const errors: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(e.message))

let failed = false
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30_000 })

  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  // Interaction flags run in the order they were typed, so a session reads as a
  // script: click, wait for the scene to say it happened, click again. Anything
  // that waits on a *timer* between steps is a flake waiting to happen.
  for (const step of process.argv) {
    if (step.startsWith('--click=')) {
      const [cx = 0, cy = 0] = step.slice(8).split(',').map(Number)
      await page.mouse.click(cx, cy)
      await settle()
    } else if (step.startsWith('--drag=')) {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = step.slice(7).split(',').map(Number)
      await page.mouse.move(x1, y1)
      await page.mouse.down()
      // Stepped, because the scene tracks the carried object on pointermove; a
      // single jump would land the drop without ever having moved anything.
      const steps = 12
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
      }
      await page.mouse.up()
      // Let React commit the drop and the scene repaint before the next grab, or
      // the following pointerdown reaches for something that has not moved yet.
      await settle()
    } else if (step.startsWith('--await-text=')) {
      const expected = step.slice(13)
      await page.waitForFunction((t) => document.body.innerText.includes(t), expected, {
        timeout: 30_000,
      })
    }
  }
  // Troika rebuilds <Text> geometry off the main thread, so an in-scene label
  // lands well after the DOM says the state changed — measured at more than 8
  // frames under SwiftShader, and the material colour updates first, so too
  // short a wait captures new-coloured *stale* words. This is a heuristic, which
  // is why assertions belong on the DOM HUD (--await-text) and never on pixels.
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r))
  })

  await mkdir(SHOTS, { recursive: true })
  const out = resolve(SHOTS, `${name}.png`)
  await page.screenshot({ path: out })

  const renderer = await page.evaluate(() => window.__rendererInfo ?? 'unknown')
  console.log(`✓ ${out}  ${width}x${height}  GL: ${renderer}`)
} catch (err) {
  failed = true
  console.error(`✗ screenshot failed: ${(err as Error).message}`)
  console.error(`  url: ${url}  (is the dev server running?)`)
} finally {
  if (errors.length) {
    console.error(`\n${errors.length} page error(s):`)
    for (const e of errors.slice(0, 10)) console.error(`  ${e}`)
  }
  await browser.close()
  if (failed) process.exitCode = 1
}
