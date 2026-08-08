import { describe, expect, it } from 'vitest'
import { ACTIVITIES, DEFAULT_ACTIVITY, resolveActivityId } from '../src/shell/activities.js'
import { readParams } from '../src/shell/params.js'

describe('resolveActivityId', () => {
  it('falls back when nothing is asked for', () => {
    expect(resolveActivityId(null)).toBe(DEFAULT_ACTIVITY)
    expect(resolveActivityId(undefined)).toBe(DEFAULT_ACTIVITY)
    expect(resolveActivityId('')).toBe(DEFAULT_ACTIVITY)
  })

  it('falls back on an unknown id rather than rendering nothing', () => {
    expect(resolveActivityId('graphcoloring')).toBe(DEFAULT_ACTIVITY)
  })

  it('returns every registered id unchanged', () => {
    for (const id of Object.keys(ACTIVITIES)) expect(resolveActivityId(id)).toBe(id)
  })

  it('does not resolve inherited Object properties', () => {
    // `id in ACTIVITIES` would otherwise accept 'constructor' and 'toString'.
    expect(resolveActivityId('constructor')).toBe(DEFAULT_ACTIVITY)
    expect(resolveActivityId('toString')).toBe(DEFAULT_ACTIVITY)
  })

  it('registers the default activity it falls back to', () => {
    expect(ACTIVITIES[DEFAULT_ACTIVITY]?.id).toBe(DEFAULT_ACTIVITY)
  })
})

describe('readParams', () => {
  it('defaults an empty query string', () => {
    expect(readParams('')).toEqual({
      activity: null,
      static: false,
      instance: null,
      skin: null,
      fixtures: false,
      frame: null,
      world: 'both',
      focus: null,
      reduction: null,
      menuOpen: false,
      mode: null,
    })
  })

  it('carries a problem instance verbatim, brackets and all', () => {
    // What a printed kit or a worksheet QR code would encode.
    expect(readParams('?instance=((4,7,3,6,2,8),10,3)').instance).toBe('((4,7,3,6,2,8),10,3)')
  })

  it('reads the top-level activity split', () => {
    expect(readParams('?activity=binpacking').activity).toBe('binpacking')
  })

  it('keeps ?mode= for the reduction activity, distinct from ?activity=', () => {
    const p = readParams('?activity=reduction&mode=gadgets')
    expect(p.activity).toBe('reduction')
    expect(p.mode).toBe('gadgets')
  })

  it('treats the flag params as exact matches', () => {
    expect(readParams('?static=1').static).toBe(true)
    expect(readParams('?static=true').static).toBe(false)
    expect(readParams('?source=fixtures').fixtures).toBe(true)
    expect(readParams('?source=live').fixtures).toBe(false)
    expect(readParams('?menu=open').menuOpen).toBe(true)
    expect(readParams('?menu=closed').menuOpen).toBe(false)
  })

  it('distinguishes frame 0 from an absent frame', () => {
    expect(readParams('?frame=0').frame).toBe(0)
    expect(readParams('').frame).toBe(null)
  })

  it('passes the rest through verbatim', () => {
    const p = readParams('?world=from&focus=x2_2&reduction=KarpSATToSAT3')
    expect(p.world).toBe('from')
    expect(p.focus).toBe('x2_2')
    expect(p.reduction).toBe('KarpSATToSAT3')
  })
})
