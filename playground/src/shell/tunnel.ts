import { type ReactNode, useEffect, useSyncExternalStore } from 'react'

/**
 * A one-way hole between the two renderers.
 *
 * An activity lives inside the `<Canvas>`, where React is driving R3F's
 * reconciler and a `<div>` is not a thing that can exist. Its HUD has to end up
 * in the DOM. `react-dom`'s `createPortal` cannot cross that boundary — the
 * portal belongs to a different renderer than the tree asking for it — so the
 * content is handed over out-of-band instead: `In` publishes, `Out` subscribes.
 *
 * `In` writes in an effect rather than during render, so publishing never
 * re-renders the publisher, and the two sides cannot loop.
 */
export interface Tunnel {
  In: (props: { children: ReactNode }) => null
  Out: () => ReactNode
}

export function createTunnel(): Tunnel {
  let current: ReactNode = null
  const listeners = new Set<() => void>()

  const publish = (node: ReactNode) => {
    current = node
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    In({ children }) {
      // No dependency list: the content is fresh JSX every render, and comparing
      // elements is neither cheap nor meaningful.
      // biome-ignore lint/correctness/useExhaustiveDependencies: see above
      useEffect(() => publish(children))
      // Clearing belongs to unmount alone. Doing it in the effect above would
      // blank the outlet on every render of the publisher.
      useEffect(() => () => publish(null), [])
      return null
    },
    Out() {
      return useSyncExternalStore(
        subscribe,
        () => current,
        () => current,
      )
    },
  }
}
