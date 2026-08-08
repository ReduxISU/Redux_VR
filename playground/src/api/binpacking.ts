import { BASE_URL } from './redux.js'

/**
 * The two calls that make this a game rather than a toy.
 *
 * The rules of bin packing are *not* implemented here, and must not be. The
 * backend verifier decides whether an arrangement is correct, so a student in a
 * headset, a student on a Chromebook and the existing web GUI are all marked by
 * the same referee. A client-side shortcut would be a second, divergent set of
 * rules pretending to be the first.
 */

/** The verifier answers with a JSON-encoded "True"/"False", not a JSON boolean. */
const TRUE = 'true'

async function ask<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** Does this arrangement solve the instance? The referee's word is final. */
export async function verifyPacking(instance: string, certificate: string): Promise<boolean> {
  const verdict = await ask<string>('ProblemProvider/verify?verifier=binpackingverifier', {
    Certificate: certificate,
    ProblemInstance: instance,
  })
  return String(verdict).trim().toLowerCase() === TRUE
}

/**
 * First Fit Decreasing — "biggest first, into the first crate it fits" — which
 * is the strategy the outreach worksheet walks students towards discovering.
 *
 * It answers with the empty string when *it* could not pack the instance, which
 * is not the same as the instance being impossible; brute force is the
 * authority on that. Worth keeping straight before this is ever phrased to a
 * student as "there is no answer".
 */
export async function solvePacking(instance: string): Promise<string> {
  return ask<string>('ProblemProvider/solve?solver=binpackingffd', instance)
}
