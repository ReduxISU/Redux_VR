import { describe, expect, it } from 'vitest'
import { stageAnchor, stageTransform, XR_STAGE } from '../src/xr.js'

const at = (center: [number, number, number], width: number) => ({ center, width })

describe('stageTransform', () => {
  it('normalises any scene to the stage width', () => {
    for (const width of [2, 20, 200]) {
      const { scale } = stageTransform(at([0, 0, 0], width))
      expect(width * scale).toBeCloseTo(XR_STAGE.wall.width, 8)
    }
  })

  it('puts the scene centre at eye height, in front of the viewer', () => {
    const { scale, position } = stageTransform(at([7, -3, 2], 20))
    // The transform maps the scene centre to the stage anchor.
    const mapped = [7 * scale + position[0], -3 * scale + position[1], 2 * scale + position[2]]
    expect(mapped[0]).toBeCloseTo(0, 8)
    expect(mapped[1]).toBeCloseTo(XR_STAGE.wall.height, 8)
    expect(mapped[2]).toBeCloseTo(-XR_STAGE.wall.distance, 8)
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

describe('stage postures', () => {
  it('stands a diagram back from the viewer at eye level', () => {
    expect(XR_STAGE.wall.height).toBeGreaterThan(1.4)
    expect(XR_STAGE.wall.distance).toBeGreaterThan(1.5)
  })

  it('puts a board within reach and below eye level, so it is looked down into', () => {
    // The first emulated session showed a board staged as a wall: floated to
    // standing eye height and pushed back, a scene lying on the floor plane is
    // seen edge-on and its controls land on top of it.
    expect(XR_STAGE.table.height).toBeLessThan(XR_STAGE.wall.height)
    expect(XR_STAGE.table.distance).toBeLessThan(XR_STAGE.wall.distance)
    // Roughly an adult arm. Anything beyond this cannot be touched.
    expect(XR_STAGE.table.distance).toBeLessThanOrEqual(0.7)
  })

  it('keeps a board desk-sized rather than room-sized', () => {
    expect(XR_STAGE.table.width).toBeLessThan(XR_STAGE.wall.width)
    expect(XR_STAGE.table.width).toBeLessThanOrEqual(1.4)
  })

  it('anchors each posture where its scene centre lands', () => {
    for (const posture of ['wall', 'table'] as const) {
      const stage = XR_STAGE[posture]
      expect(stageAnchor(posture)).toEqual([0, stage.height, -stage.distance])
      const { scale, position } = stageTransform({ center: [0, 0, 0], width: 10 }, stage)
      expect(10 * scale).toBeCloseTo(stage.width, 8)
      // Component-wise: negating a zero coordinate yields -0, which is fine for
      // three.js and not equal to 0 for a structural comparison.
      stageAnchor(posture).forEach((v, i) => expect(position[i] as number).toBeCloseTo(v, 8))
    }
  })
})
