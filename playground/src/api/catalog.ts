import type { WorldKind } from '@redux-xvr/layout'

export interface ReductionEntry {
  className: string
  source: string
  target: string
}

export interface ProblemProfile {
  problem: string
  defaultInstance: string
  solverClass?: string
  visualizationClass?: string
  visualizationType?: string
  kind?: WorldKind
}

/** Why a reduction can or cannot be shown, so the picker never lies to a student. */
export type Capability =
  | { state: 'linked'; gadgets: number }
  | { state: 'unlinked'; reason: 'no gadgets published by the backend' }
  | { state: 'unsupported'; reason: string }

export interface CatalogItem extends ReductionEntry {
  from: ProblemProfile
  to: ProblemProfile
  capability: Capability
}

/** Visualization types this renderer understands, in preference order. */
const KIND_BY_TYPE: Record<string, WorldKind> = {
  'Graph D3': 'graph',
  'Boolean Satisfiability': 'formula',
}

export function kindForType(type: string | undefined): WorldKind | undefined {
  return type ? KIND_BY_TYPE[type] : undefined
}

type Fetcher = {
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body: string) => Promise<T>
}

/** The reduction graph, flattened. Source of truth for what exists at all. */
export async function fetchReductionEntries(api: Fetcher): Promise<ReductionEntry[]> {
  const map =
    await api.get<Record<string, Record<string, { className: string }[]>>>('Navigation/Reductions')
  const entries: ReductionEntry[] = []
  for (const [source, targets] of Object.entries(map)) {
    for (const [target, impls] of Object.entries(targets)) {
      for (const impl of impls) entries.push({ className: impl.className, source, target })
    }
  }
  return entries
}

interface ProblemInfo {
  problemName?: string
  defaultInstance?: string
  defaultVisualization?: { visualizationType?: string }
}

/**
 * Everything needed to drive a problem: its default instance, a solver, and a
 * visualization we can actually draw.
 *
 * The visualization is chosen by *capability* — the first candidate whose
 * `visualizationType` we can render — rather than by list order. CLIQUE, for
 * example, publishes both a D3 graph and a LaTeX/TikZ view; picking by order is
 * exactly the bug the existing GUI has.
 */
export async function fetchProblemProfile(api: Fetcher, problem: string): Promise<ProblemProfile> {
  const [info, solvers, visualizations] = await Promise.all([
    api
      .get<ProblemInfo>(`ProblemProvider/info?interface=${problem}`)
      .catch(() => ({}) as ProblemInfo),
    api
      .get<string[]>(`Navigation/Problem_SolversRefactor?chosenProblem=${problem}&problemType=NPC`)
      .catch(() => [] as string[]),
    api
      .get<string[]>(
        `Navigation/Problem_VisualizationsRefactor?chosenProblem=${problem}&problemType=NPC`,
      )
      .catch(() => [] as string[]),
  ])

  const profile: ProblemProfile = {
    problem,
    defaultInstance: info.defaultInstance ?? '',
    solverClass: solvers[0],
  }

  const declared = info.defaultVisualization?.visualizationType
  for (const candidate of visualizations) {
    const meta = await api
      .get<{ visualizationType?: string }>(`ProblemProvider/info?interface=${candidate}`)
      .catch(() => ({}) as { visualizationType?: string })
    const type = meta.visualizationType ?? declared
    if (kindForType(type)) {
      profile.visualizationClass = candidate
      profile.visualizationType = type
      profile.kind = kindForType(type)
      break
    }
  }

  // Some problems publish no usable visualization but still declare a type.
  if (!profile.kind && kindForType(declared)) {
    profile.visualizationClass = visualizations[0]
    profile.visualizationType = declared
    profile.kind = kindForType(declared)
  }

  return profile
}

export function classify(from: ProblemProfile, to: ProblemProfile, gadgets: number): Capability {
  const missing = [
    !from.kind ? `${from.problem} (${from.visualizationType ?? 'no visualization'})` : null,
    !to.kind ? `${to.problem} (${to.visualizationType ?? 'no visualization'})` : null,
  ].filter(Boolean)

  if (missing.length > 0)
    return { state: 'unsupported', reason: `cannot draw ${missing.join(' + ')}` }
  if (!from.defaultInstance) {
    return { state: 'unsupported', reason: `${from.problem} publishes no default instance` }
  }
  if (gadgets === 0) return { state: 'unlinked', reason: 'no gadgets published by the backend' }
  return { state: 'linked', gadgets }
}
