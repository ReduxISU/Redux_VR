/**
 * Capture the SAT3 -> CLIQUE reduction from the live Redux API into fixtures/.
 *
 * Committed fixtures keep vitest deterministic and let the playground run when
 * prod is down. Re-run after any backend change to the reduction contract.
 *
 *   node tools/capture-fixtures.ts [--base=https://redux.isu.edu/api/redux]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'fixtures')

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback

const BASE = arg('base', 'https://redux.isu.edu/api/redux').replace(/\/$/, '')
const INSTANCE = '(x1 | !x2 | x3) & (!x1 | x3 | x1) & (x2 | !x3 | !x1)'
const REDUCTION = 'SipserReduceToCliqueStandard'

/** Redux takes the instance as a bare JSON string literal, not an object. */
async function post(path: string, body: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${res.statusText}`)
  return res.json()
}

async function write(name: string, data: unknown): Promise<void> {
  const file = resolve(OUT, `${name}.json`)
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`  ✓ fixtures/${name}.json`)
}

await mkdir(OUT, { recursive: true })
console.log(`capturing from ${BASE}`)
console.log(`  instance: ${INSTANCE}`)

// Solve first: /visualize 500s on an UNSAT formula because the visualization
// splits "No Solution" on ":". Guard rather than discover it at render time.
const solution = (await post(
  `ProblemProvider/solve?solver=Sat3BacktrackingSolver`,
  INSTANCE,
)) as string
if (solution === 'No Solution') throw new Error('demo instance is unsatisfiable; pick another')
console.log(`  solution: ${solution}`)

const enc = encodeURIComponent(solution)

await write('meta', { instance: INSTANCE, reduction: REDUCTION, solution, base: BASE })
await write('reduce', await post(`ProblemProvider/reduce?reduction=${REDUCTION}`, INSTANCE))
await write('gadgets', await post(`ProblemProvider/gadgets?reduction=${REDUCTION}`, INSTANCE))
await write(
  'sat3-frames',
  await post('ProblemProvider/visualize?visualization=Sat3DefaultVisualization', INSTANCE),
)
await write(
  'clique-frames',
  await post(`ProblemProvider/visualizeReduction?reduction=${REDUCTION}&solution=${enc}`, INSTANCE),
)

console.log('done')
