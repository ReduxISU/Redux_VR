/**
 * The costume, as data.
 *
 * A skin changes what the containers and blocks are *called*, and nothing else.
 * Not the instance, not the layout, not one number — the truck puzzle and the
 * holiday puzzle are the same puzzle, and the whole point of being able to swap
 * between them is that a student watches their own arrangement survive the swap.
 *
 * That is also why the geometry is deliberately identical across skins: if the
 * shapes changed too, "it is the same problem underneath" would be a claim the
 * scene quietly contradicts.
 */

export interface Skin {
  id: string
  /** Full name, for prose. */
  title: string
  /** One word, for a button face — a title long enough to wrap runs into the
   *  subtitle underneath it. */
  short: string
  /** Generic noun for a container, used when no per-container name is given. */
  container: string
  containerNames?: string[]
  /** Short suffix on a number, e.g. "" or "h". */
  unit: string
  /** Long form, for prose in the HUD. */
  unitName: string
  itemNames?: string[]
  /** Base outline colour for the containers. */
  accent: string
}

export const TRUCKS: Skin = {
  id: 'trucks',
  title: 'Moving trucks',
  short: 'Trucks',
  container: 'Truck',
  unit: '',
  unitName: 'units',
  accent: '#46566b',
}

/**
 * The worksheet's second telling of the same game: five days in Hawaii, each
 * with so many hours, and activities to fit into them.
 *
 * Names are chosen so their durations read plausibly against the default
 * instance's sizes (4, 7, 3, 6, 2, 8) — an eight-hour luau would undercut the
 * story. They are also kept short: a block face is barely wider than it is tall.
 */
export const HAWAII: Skin = {
  id: 'hawaii',
  title: 'Five days in Hawaii',
  short: 'Hawaii',
  container: 'Day',
  containerNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  unit: 'h',
  unitName: 'hours',
  itemNames: ['snorkel', 'volcano', 'luau', 'boat trip', 'waterfall', 'beach day'],
  accent: '#44AA99',
}

export const SKINS: Skin[] = [TRUCKS, HAWAII]

export function resolveSkin(id: string | null | undefined): Skin {
  return SKINS.find((s) => s.id === id) ?? TRUCKS
}

/** The one after this, wrapping — the button offers where you are going. */
export function nextSkin(current: Skin): Skin {
  const i = SKINS.findIndex((s) => s.id === current.id)
  return SKINS[(i + 1) % SKINS.length] ?? TRUCKS
}

export function containerLabel(skin: Skin, index: number): string {
  return skin.containerNames?.[index] ?? `${skin.container} ${index + 1}`
}

/** How full a container is, in this costume's words. */
export function loadLabel(skin: Skin, load: number, capacity: number): string {
  return `${load}/${capacity}${skin.unit}`
}

export interface BlockLabel {
  /** The number, which is what the packing actually turns on. */
  value: string
  /** The story, when the costume has one. */
  name?: string
}

export function blockLabel(skin: Skin, index: number, size: number): BlockLabel {
  const name = skin.itemNames?.[index]
  return { value: `${size}${skin.unit}`, ...(name ? { name } : {}) }
}
