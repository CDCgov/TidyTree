/** Converts a polar position (angle, radius) to SVG [x, y]. */
export declare function circularPoint(angle: number, radius: number): [number, number];
/**
 * Branch label for a smooth link in a horizontal or vertical layout
 * (d3.linkHorizontal / d3.linkVertical), given its ends in screen coordinates.
 * These curves are symmetric, so their midpoint is the chord's midpoint, but
 * their tangent there has twice the chord's slope across the depth axis.
 * @param horizontal - true for d3.linkHorizontal (depth runs along x).
 */
export declare function smoothLinkLabel(x0: number, y0: number, x1: number, y1: number, horizontal: boolean): string;
/**
 * Branch label for a smooth radial link (d3.linkRadial, a cubic Bézier with
 * control points at the mid radius): placed at the curve's midpoint and
 * aligned with its tangent there.
 */
export declare function smoothRadialLinkLabel(sourceAngle: number, sourceRadius: number, targetAngle: number, targetRadius: number): string;
/** Branch label for a straight link drawn as a chord from source to target. */
export declare function chordLinkLabel(sourceAngle: number, sourceRadius: number, targetAngle: number, targetRadius: number): string;
/**
 * Branch label for an elbow link (an arc at the source radius, then a radial
 * line out to the target): placed at the middle of the radial line.
 */
export declare function elbowLinkLabel(sourceRadius: number, targetAngle: number, targetRadius: number): string;
/**
 * Whether a node label at this angle is on the left half of the circle, where
 * it is flipped (anchored at its end) so it reads outward and stays upright.
 * The 6 o'clock position (angle π) counts as the left half: its rotation is
 * -90°, so only an end anchor points the text away from the center.
 */
export declare function isLeftHalf(angle: number): boolean;
