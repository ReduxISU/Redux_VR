/**
 * Screenshot the playground so changes can be verified visually.
 *
 * Uses SwiftShader (software WebGL) rather than the host GPU: deterministic,
 * headless, and portable to CI. Waits on window.__sceneReady, never a timer.
 *
 *   node tools/shoot.ts [name] [--url=...] [--width=1280] [--height=720] [--live]
 *                       [--click=x,y] [--await-text="..."] [--fake-xr]
 *
 * --click issues a real mouse click at viewport coordinates, which is how the
 * in-scene UI gets exercised: R3F raycasts it exactly as it would a controller ray.
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

  const click = arg('click', '')
  if (click) {
    const [cx, cy] = click.split(',').map(Number)
    await page.mouse.click(cx ?? 0, cy ?? 0)
    const expected = arg('await-text', '')
    if (expected) {
      await page.waitForFunction((t) => document.body.innerText.includes(t), expected, {
        timeout: 30_000,
      })
    }
  }
  // One extra rAF pair so the frame that set the flag is actually presented.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )

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
