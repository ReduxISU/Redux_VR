import { describe, expect, it } from 'vitest'
import { stageTransform, XR_STAGE } from '../src/xr.js'

const at = (center: [number, number, number], width: number) => ({ center, width })

describe('stageTransform', () => {
  it('normalises any scene to the stage width', () => {
    for (const width of [2, 20, 200]) {
      const { scale } = stageTransform(at([0, 0, 0], width))
      expect(width * scale).toBeCloseTo(XR_STAGE.width, 8)
    }
  })

  it('puts the scene centre at eye height, in front of the viewer', () => {
    const { scale, position } = stageTransform(at([7, -3, 2], 20))
    // The transform maps the scene centre to the stage anchor.
    const mapped = [7 * scale + position[0], -3 * scale + position[1], 2 * scale + position[2]]
    expect(mapped[0]).toBeCloseTo(0, 8)
    expect(mapped[1]).toBeCloseTo(XR_STAGE.height, 8)
    expect(mapped[2]).toBeCloseTo(-XR_STAGE.distance, 8)
  })

  it('places the scene in front of the viewer, never behind', () => {
    const { position } = stageTransform(at([0, 0, 0], 20))
    expect(position[2]).toBeLessThan(0)
  })

  it('keeps a headset-scale scene within arm-and-eye range', () => {
    // A 20-unit scene should not become a 20-metre wall.
    const { scale } = stageTransform(at([0, 0, 0], 20))
    expect(20 * scale).toBeLessThan(6)
    expect(20 * scale).toBeGreaterThan(1)
  })

  it('does not divide by zero on a degenerate scene', () => {
    const { scale, position } = stageTransform(at([0, 0, 0], 0))
    expect(Number.isFinite(scale)).toBe(true)
    expect(position.every(Number.isFinite)).toBe(true)
  })
})
