/**
 * Interpolates between two SVG path strings with the same command structure,
 * keeping arc flags valid (0 or 1). d3's default string interpolation tweens
 * every number, including arc flags, producing invalid path data such as
 * `A45,45 0 0 0.5 …` mid-transition.
 *
 * If the paths have different structures (e.g. switching between straight,
 * square and smooth branches), both are resampled into polylines with the
 * same number of points and those are tweened instead. Where the DOM can't
 * measure paths (no `getPointAtLength`), the interpolator jumps to the target.
 */
export default function interpolatePath(a: string, b: string): (t: number) => string;
