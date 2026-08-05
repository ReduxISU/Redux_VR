import type {
  ApiFormulaFrame,
  ApiGraphFrame,
  ApiReduction,
  Gadget,
  ReductionBundle,
} from '@redux-xvr/layout'
import cliqueFrames from '../../../fixtures/clique-frames.json'
import gadgets from '../../../fixtures/gadgets.json'
import meta from '../../../fixtures/meta.json'
import reduce from '../../../fixtures/reduce.json'
import sat3Frames from '../../../fixtures/sat3-frames.json'

const DEFAULT_BASE = 'https://redux.isu.edu/api/redux'

export const BASE_URL = (import.meta.env.VITE_REDUX_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '')

export const DEMO_INSTANCE = '(x1 | !x2 | x3) & (!x1 | x3 | x1) & (x2 | !x3 | !x1)'
export const DEMO_REDUCTION = 'SipserReduceToCliqueStandard'

/** Redux takes the problem instance as a bare JSON string literal, not an object. */
async function post<T>(path: string, instance: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instance),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** The committed capture — used offline and whenever prod is unreachable. */
export function fixtureBundle(): ReductionBundle {
  return {
    reduction: reduce as unknown as ApiReduction,
    gadgets: gadgets as Gadget[],
    fromFrames: sat3Frames as unknown as ApiFormulaFrame[],
    toFrames: cliqueFrames as unknown as ApiGraphFrame[],
    solution: meta.solution,
  }
}

export async function fetchBundle(
  instance = DEMO_INSTANCE,
  reduction = DEMO_REDUCTION,
): Promise<ReductionBundle> {
  // Solve first: /visualize 500s on an unsatisfiable formula because the
  // visualization splits "No Solution" on ":".
  const solution = await post<string>(
    'ProblemProvider/solve?solver=Sat3BacktrackingSolver',
    instance,
  )
  if (solution === 'No Solution') throw new Error('formula is unsatisfiable — nothing to visualize')

  const enc = encodeURIComponent(solution)
  const [reductionInfo, gadgetList, fromFrames, toFrames] = await Promise.all([
    post<ApiReduction>(`ProblemProvider/reduce?reduction=${reduction}`, instance),
    post<Gadget[]>(`ProblemProvider/gadgets?reduction=${reduction}`, instance),
    post<ApiFormulaFrame[]>(
      'ProblemProvider/visualize?visualization=Sat3DefaultVisualization',
      instance,
    ),
    post<ApiGraphFrame[]>(
      `ProblemProvider/visualizeReduction?reduction=${reduction}&solution=${enc}`,
      instance,
    ),
  ])

  return { reduction: reductionInfo, gadgets: gadgetList, fromFrames, toFrames, solution }
}
