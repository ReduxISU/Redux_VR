import type { AnyFrame, ApiReduction, Gadget, ReductionBundle } from '@redux-xvr/layout'
import cliqueFrames from '../../../fixtures/clique-frames.json'
import gadgets from '../../../fixtures/gadgets.json'
import meta from '../../../fixtures/meta.json'
import reduce from '../../../fixtures/reduce.json'
import sat3Frames from '../../../fixtures/sat3-frames.json'
import {
  type CatalogItem,
  classify,
  fetchProblemProfile,
  fetchReductionEntries,
  type ProblemProfile,
  type ReductionEntry,
} from './catalog.js'

const DEFAULT_BASE = 'https://redux.isu.edu/api/redux'

export const BASE_URL = (import.meta.env.VITE_REDUX_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '')

export const DEMO_REDUCTION = 'SipserReduceToCliqueStandard'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json() as Promise<T>
}

/** Redux takes the problem instance as a bare JSON string literal, not an object. */
async function post<T>(path: string, instance: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instance),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json() as Promise<T>
}

const api = { get, post }

/** The committed capture — used offline and whenever prod is unreachable. */
export function fixtureBundle(): ReductionBundle {
  return {
    reduction: reduce as unknown as ApiReduction,
    gadgets: gadgets as Gadget[],
    from: { problemName: '3SAT', frames: sat3Frames as unknown as AnyFrame[] },
    to: { problemName: 'Clique', frames: cliqueFrames as unknown as AnyFrame[] },
    solution: meta.solution,
  }
}

/** Reductions the backend advertises, each tagged with whether we can draw it. */
export async function fetchCatalog(): Promise<CatalogItem[]> {
  const entries = await fetchReductionEntries(api)
  const problems = [...new Set(entries.flatMap((e) => [e.source, e.target]))]

  const profiles = new Map<string, ProblemProfile>()
  await Promise.all(
    problems.map(async (p) => {
      profiles.set(p, await fetchProblemProfile(api, p))
    }),
  )

  const items = await Promise.all(
    entries.map(async (entry) => {
      const from = profiles.get(entry.source) as ProblemProfile
      const to = profiles.get(entry.target) as ProblemProfile
      let count = 0
      if (from?.defaultInstance) {
        const list = await post<Gadget[]>(
          `ProblemProvider/gadgets?reduction=${entry.className}`,
          from.defaultInstance,
        ).catch(() => [] as Gadget[])
        count = list.length
      }
      return { ...entry, from, to, capability: classify(from, to, count) }
    }),
  )

  const rank = { linked: 0, unlinked: 1, unsupported: 2 }
  return items.sort(
    (a, b) =>
      rank[a.capability.state] - rank[b.capability.state] ||
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target),
  )
}

/**
 * Fetch both sides of any reduction.
 *
 * Solve first: `/visualize` returns HTTP 500 on an unsatisfiable instance because
 * the visualization splits `"No Solution"` on `":"`. When there is no solution — or
 * the reduction stubs `mapSolutions` — fall back to reducing and visualizing the
 * target instance directly, which still renders, just without a highlighted
 * certificate.
 */
export async function fetchBundleFor(item: CatalogItem): Promise<ReductionBundle> {
  const { from, to, className } = item
  const instance = from.defaultInstance

  const solution = from.solverClass
    ? await post<string>(`ProblemProvider/solve?solver=${from.solverClass}`, instance).catch(
        () => 'No Solution',
      )
    : 'No Solution'
  const solved = solution !== 'No Solution' && solution.trim() !== ''

  const [reduction, gadgetList, fromFrames] = await Promise.all([
    post<ApiReduction>(`ProblemProvider/reduce?reduction=${className}`, instance),
    post<Gadget[]>(`ProblemProvider/gadgets?reduction=${className}`, instance).catch(
      () => [] as Gadget[],
    ),
    solved && from.visualizationClass
      ? post<AnyFrame[]>(
          `ProblemProvider/visualize?visualization=${from.visualizationClass}`,
          instance,
        ).catch(() => [] as AnyFrame[])
      : Promise.resolve([] as AnyFrame[]),
  ])

  let toFrames: AnyFrame[] = []
  if (solved) {
    toFrames = await post<AnyFrame[]>(
      `ProblemProvider/visualizeReduction?reduction=${className}&solution=${encodeURIComponent(solution)}`,
      instance,
    ).catch(() => [] as AnyFrame[])
  }
  if (toFrames.length === 0 && to.visualizationClass) {
    // No mapped certificate: draw the reduced instance on its own terms.
    toFrames = await post<AnyFrame[]>(
      `ProblemProvider/visualize?visualization=${to.visualizationClass}`,
      reduction.reductionTo.instance,
    ).catch(() => [] as AnyFrame[])
  }
  if (toFrames.length === 0) throw new Error(`${to.problem} produced no visualization frames`)

  return {
    reduction,
    gadgets: gadgetList,
    from: { problemName: reduction.reductionFrom.problemName, frames: fromFrames },
    to: { problemName: reduction.reductionTo.problemName, frames: toFrames },
    solution: solved ? solution : '',
  }
}

export type { CatalogItem, ReductionEntry }
