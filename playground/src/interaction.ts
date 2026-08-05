import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useMemo, useState } from 'react'

/**
 * Intents, not input devices.
 *
 * Handlers are expressed as "hover/select *this element*" rather than "the mouse
 * did X". R3F pointer events are raised identically by an XR controller ray, so
 * the interaction model does not fork when the headset path lands — which is the
 * whole reason to define this before XR rather than after.
 */
export interface Intents {
  hovered: string | null
  selected: string | null
  hover: (id: string | null) => void
  select: (id: string | null) => void
  clear: () => void
}

/** `initialSelected` lets a URL deep-link a specific element — useful for lecture
 *  links and for screenshotting the highlight path, which has no pointer. */
export function useIntents(initialSelected: string | null = null): Intents {
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(initialSelected)

  const select = useCallback((id: string | null) => {
    // Selecting the pinned element again unpins it.
    setSelected((prev) => (prev === id ? null : id))
  }, [])

  const clear = useCallback(() => {
    setHovered(null)
    setSelected(null)
  }, [])

  return useMemo(
    () => ({ hovered, selected, hover: setHovered, select, clear }),
    [hovered, selected, select, clear],
  )
}

/** Event props to spread onto any selectable mesh in either world. */
export function elementHandlers(id: string, intents: Intents) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      intents.hover(id)
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      intents.hover(null)
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      intents.select(id)
    },
  }
}

/** Whichever element is currently driving the highlight. */
export function activeElement(intents: Intents): string | null {
  return intents.hovered ?? intents.selected
}
