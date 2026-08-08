import { BASE_URL } from './redux.js'

/**
 * Same contract as bin packing, same rule: the rules of graph colouring are not
 * implemented here and must not be. The backend verifier decides.
 *
 * It is a strict referee — checked live: it rejects two adjacent nodes sharing a
 * class, more classes than the instance allows, and any node left out.
 */

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

export async function verifyColoring(instance: string, certificate: string): Promise<boolean> {
  const verdict = await ask<string>('ProblemProvider/verify?verifier=graphcoloringverifier', {
    Certificate: certificate,
    ProblemInstance: instance,
  })
  return String(verdict).trim().toLowerCase() === TRUE
}

/**
 * Greedy — colour the nodes in order, each getting the first colour none of its
 * neighbours has taken. The strategy a student reaches for unprompted, which is
 * exactly why it is the one worth showing.
 */
export async function solveColoring(instance: string): Promise<string> {
  return ask<string>('ProblemProvider/solve?solver=graphcoloringgreedy', instance)
}
