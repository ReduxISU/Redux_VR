import { Line } from '@react-three/drei'
import { edgeColor, type LinkSegment } from '@redux-xvr/layout'
import { useMemo } from 'react'
import { QuadraticBezierCurve3, Quaternion, Vector3 } from 'three'

const CURVE_POINTS = 28
/** How far the arc bows toward the viewer, as a fraction of segment length. */
const BOW = 0.22
const ARROW_LENGTH = 0.34
const ARROW_RADIUS = 0.12

export type LinkDirection = 'forward' | 'backward'

const v = (p: readonly [number, number, number]) => new Vector3(p[0], p[1], p[2])

/**
 * Arc a segment toward the viewer.
 *
 * A straight line from the formula to the graph passes through whatever sits
 * between them; bowing it out along +Z keeps every correspondence readable and
 * stops parallel links from collapsing into one stroke.
 */
function curveFor(segment: LinkSegment, direction: LinkDirection) {
  const a = direction === 'forward' ? v(segment.from) : v(segment.to)
  const b = direction === 'forward' ? v(segment.to) : v(segment.from)
  const mid = a.clone().lerp(b, 0.5)
  mid.z += a.distanceTo(b) * BOW
  return new QuadraticBezierCurve3(a, mid, b)
}

function colorFor(segment: LinkSegment, accent?: string) {
  if (accent) return accent
  return edgeColor(segment.kind === 'ClauseHighlight' ? 'ClauseHighlight' : 'ElementHighlight')
}

/** Cone at the arriving end, oriented along the curve's final tangent. */
function Arrowhead({ curve, color }: { curve: QuadraticBezierCurve3; color: string }) {
  const { position, quaternion } = useMemo(() => {
    const tip = curve.getPoint(1)
    const tangent = curve.getTangent(1).normalize()
    // Cones point along +Y by default.
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tangent)
    return { position: tip.clone().addScaledVector(tangent, -ARROW_LENGTH / 2), quaternion: q }
  }, [curve])

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[ARROW_RADIUS, ARROW_LENGTH, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} />
    </mesh>
  )
}

export function Correspondences({
  segments,
  direction = 'forward',
  emphasised,
  accent,
}: {
  segments: LinkSegment[]
  direction?: LinkDirection
  /** Ids to keep bright; everything else recedes. Empty means show all equally. */
  emphasised?: Set<string>
  /** Overrides per-kind colour, so the active mode drives the palette. */
  accent?: string
}) {
  const drawn = useMemo(
    () =>
      segments.map((segment) => {
        const curve = curveFor(segment, direction)
        const hot =
          !emphasised ||
          emphasised.size === 0 ||
          emphasised.has(segment.fromId) ||
          emphasised.has(segment.toId)
        return {
          segment,
          curve,
          points: curve.getPoints(CURVE_POINTS),
          color: colorFor(segment, accent),
          opacity: hot ? 0.95 : 0.07,
          hot,
        }
      }),
    [segments, direction, emphasised, accent],
  )

  return (
    <>
      {drawn.map((d) => (
        <group key={d.segment.id}>
          <Line
            points={d.points}
            color={d.color}
            lineWidth={d.hot ? 2.2 : 1}
            transparent
            opacity={d.opacity}
            dashed={false}
          />
          {d.hot && <Arrowhead curve={d.curve} color={d.color} />}
        </group>
      ))}
    </>
  )
}
