import { describe, expect, it } from 'vitest'
import {
  blockLabel,
  containerLabel,
  HAWAII,
  loadLabel,
  nextSkin,
  resolveSkin,
  SKINS,
  TRUCKS,
} from '../src/activities/binpacking/skins.js'

describe('resolveSkin', () => {
  it('opens in the truck story by default', () => {
    expect(resolveSkin(null)).toBe(TRUCKS)
    expect(resolveSkin(undefined)).toBe(TRUCKS)
  })

  it('falls back rather than showing nothing for an unknown costume', () => {
    expect(resolveSkin('pirates')).toBe(TRUCKS)
  })

  it('resolves every registered costume by id', () => {
    for (const skin of SKINS) expect(resolveSkin(skin.id)).toBe(skin)
  })
})

describe('nextSkin', () => {
  it('cycles, so one button can carry the whole set', () => {
    expect(nextSkin(TRUCKS)).toBe(HAWAII)
    expect(nextSkin(HAWAII)).toBe(TRUCKS)
  })

  it('returns to where it started after a full lap', () => {
    let skin = TRUCKS
    for (let i = 0; i < SKINS.length; i++) skin = nextSkin(skin)
    expect(skin).toBe(TRUCKS)
  })
})

describe('containerLabel', () => {
  it('numbers containers when the costume has no names', () => {
    expect(containerLabel(TRUCKS, 0)).toBe('Truck 1')
    expect(containerLabel(TRUCKS, 2)).toBe('Truck 3')
  })

  it('uses the costume names when it has them', () => {
    expect(containerLabel(HAWAII, 0)).toBe('Mon')
    expect(containerLabel(HAWAII, 4)).toBe('Fri')
  })

  it('falls back past the end of the name list', () => {
    // A teacher can load an instance with more containers than the story names.
    expect(containerLabel(HAWAII, 9)).toBe('Day 10')
  })
})

describe('loadLabel', () => {
  it('carries the costume unit', () => {
    expect(loadLabel(TRUCKS, 8, 10)).toBe('8/10')
    expect(loadLabel(HAWAII, 8, 10)).toBe('8/10h')
  })
})

describe('blockLabel', () => {
  it('always leads with the number, since that is what packing turns on', () => {
    expect(blockLabel(TRUCKS, 0, 4).value).toBe('4')
    expect(blockLabel(HAWAII, 0, 4).value).toBe('4h')
  })

  it('adds the story only when the costume has one', () => {
    expect(blockLabel(TRUCKS, 0, 4).name).toBeUndefined()
    expect(blockLabel(HAWAII, 0, 4).name).toBe('snorkel')
  })

  it('drops the story past the end of the name list rather than inventing one', () => {
    expect(blockLabel(HAWAII, 99, 4).name).toBeUndefined()
    expect(blockLabel(HAWAII, 99, 4).value).toBe('4h')
  })

  it('keeps every story name short enough to sit on a block face', () => {
    for (const skin of SKINS) {
      for (const name of skin.itemNames ?? []) expect(name.length).toBeLessThanOrEqual(10)
    }
  })
})

describe('the costume is only ever presentation', () => {
  it('carries no sizes, capacity or bin count', () => {
    // If a skin could change any of these it would change the puzzle, and
    // "same problem, new story" would stop being true.
    for (const skin of SKINS) {
      expect(Object.keys(skin).sort()).toEqual(
        expect.arrayContaining(['accent', 'container', 'id', 'short', 'title', 'unit', 'unitName']),
      )
      expect(skin).not.toHaveProperty('capacity')
      expect(skin).not.toHaveProperty('sizes')
      expect(skin).not.toHaveProperty('binLimit')
    }
  })
})
