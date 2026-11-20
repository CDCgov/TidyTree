// Label geometry for the circular and radial layouts. Angles follow d3's
// convention (0 at 12 o'clock, increasing clockwise), so these agree with
// d3.linkRadial / d3.pointRadial.

const radToDeg = 180 / Math.PI;

/** Converts a polar position (angle, radius) to SVG [x, y]. */
export function circularPoint(angle: number, radius: number): [number, number] {
  radius = +radius;
  angle -= Math.PI / 2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Rotation (degrees) that keeps text along direction (dx, dy) upright. */
function uprightRotation(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return 90;
  return Math.atan(dy / dx) * radToDeg;
}

/**
 * Branch label for a smooth radial link (d3.linkRadial, a cubic Bézier with
 * control points at the mid radius): placed at the curve's midpoint and
 * aligned with its tangent there.
 */
export function smoothRadialLinkLabel(
  sourceAngle: number, sourceRadius: number,
  targetAngle: number, targetRadius: number
): string {
  const midRadius = (sourceRadius + targetRadius) / 2;
  const p0 = circularPoint(sourceAngle, sourceRadius);
  const p1 = circularPoint(sourceAngle, midRadius);
  const p2 = circularPoint(targetAngle, midRadius);
  const p3 = circularPoint(targetAngle, targetRadius);
  const x = (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8;
  const y = (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8;
  const rotation = uprightRotation(p3[0] + p2[0] - p1[0] - p0[0], p3[1] + p2[1] - p1[1] - p0[1]);
  return `translate(${x}, ${y}) rotate(${rotation})`;
}

/** Branch label for a straight link drawn as a chord from source to target. */
export function chordLinkLabel(
  sourceAngle: number, sourceRadius: number,
  targetAngle: number, targetRadius: number
): string {
  const s = circularPoint(sourceAngle, sourceRadius);
  const t = circularPoint(targetAngle, targetRadius);
  return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) / 2}) rotate(${uprightRotation(t[0] - s[0], t[1] - s[1])})`;
}

/**
 * Branch label for an elbow link (an arc at the source radius, then a radial
 * line out to the target): placed at the middle of the radial line.
 */
export function elbowLinkLabel(sourceRadius: number, targetAngle: number, targetRadius: number): string {
  const u = circularPoint(targetAngle, (sourceRadius + targetRadius) / 2);
  return `translate(${u[0]}, ${u[1]}) rotate(${((targetAngle * radToDeg) % 180) - 90})`;
}

/**
 * Whether a node label at this angle is on the left half of the circle, where
 * it is flipped (anchored at its end) so it reads outward and stays upright.
 * The 6 o'clock position (angle π) counts as the left half: its rotation is
 * -90°, so only an end anchor points the text away from the center.
 */
export function isLeftHalf(angle: number): boolean {
  return angle % (2 * Math.PI) >= Math.PI;
}
