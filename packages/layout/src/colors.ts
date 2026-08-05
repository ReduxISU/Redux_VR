import type { ColorKey } from './types.js'

/** Mirrors Redux_GUI components/Visualization/constants/VisColorsArray.js so the
 *  3D view and the D3 views agree. The backend sends keys, never hex. */
const PALETTE: Record<string, string> = {
  ElementHighlight: '#f69240',
  ClauseHighlight: '#989898',
  Background: '#abc',
  Solution: '#00e676',
  SolutionAlt: '#E600E3',
  Edges: '#aaa',
  Rose: '#CC6677',
  Indigo: '#332288',
  Sand: '#DDCC77',
  Green: '#117733',
  Cyan: '#88CCEE',
  Wine: '#882255',
  Teal: '#44AA99',
  Olive: '#999933',
  Purple: '#AA4499',
  Red: '#FF0000',
}

const UNSET_NODE = '#7f8ea3'
const UNSET_EDGE = '#aaa'

export function nodeColor(key: ColorKey): string {
  return PALETTE[key.trim()] ?? UNSET_NODE
}

export function edgeColor(key: ColorKey): string {
  return PALETTE[key.trim()] ?? UNSET_EDGE
}

export { PALETTE }
