export const PUZZLE_VERSION = '0.1.0'

export type { Coloring, ColoringEdge, ColoringInstance } from './coloring.js'
export {
  clearNode,
  coloringConflicts,
  decodeColoringCertificate,
  emptyColoring,
  encodeColoringCertificate,
  isColoringComplete,
  paintNode,
  parseColoring,
  uncolored,
} from './coloring.js'
export type { ColoringLayout } from './coloring-layout.js'
export { COLORING, layoutColoring } from './coloring-layout.js'
export {
  binId,
  decodeCertificate,
  encodeCertificate,
  itemId,
  itemIndex,
  itemsOf,
  parseInstance,
  sizeOf,
} from './instance.js'
export { binAt, layoutPuzzle, PUZZLE, restingPositions } from './layout.js'
export {
  binLoad,
  binOf,
  emptyPlacement,
  isComplete,
  overflowingBins,
  place,
  returnToTray,
  trayItems,
} from './placement.js'
export * from './types.js'
