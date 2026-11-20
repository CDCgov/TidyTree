const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/**
 * Returns the indices (among all numbers in the path) of arc flags, i.e. the
 * large-arc-flag and sweep-flag arguments of each `A`/`a` command. These must
 * be 0 or 1, so they cannot be linearly interpolated.
 */
function arcFlagIndices(path: string): Set<number> {
  const flags = new Set<number>();
  const token = /([A-Za-z])|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let command = "";
  let argIndex = 0;
  let numIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(path))) {
    if (m[1]) {
      command = m[1].toUpperCase();
      argIndex = 0;
    } else {
      if (command === "A") {
        const k = argIndex % 7;
        if (k === 3 || k === 4) flags.add(numIndex);
      }
      argIndex++;
      numIndex++;
    }
  }
  return flags;
}

/**
 * Interpolates between two SVG path strings with the same command structure,
 * keeping arc flags valid (0 or 1). d3's default string interpolation tweens
 * every number, including arc flags, producing invalid path data such as
 * `A45,45 0 0 0.5 …` mid-transition.
 *
 * If the paths have different structures (e.g. an arc appears or disappears,
 * or the layout changed), the interpolator jumps straight to the target.
 */
export default function interpolatePath(a: string, b: string): (t: number) => string {
  const template = b.replace(NUMBER, "#");
  if (a.replace(NUMBER, "#") !== template) return () => b;

  const from = (a.match(NUMBER) || []).map(Number);
  const to = (b.match(NUMBER) || []).map(Number);
  const flags = arcFlagIndices(b);

  return (t: number) => {
    if (t >= 1) return b;
    let i = 0;
    return template.replace(/#/g, () => {
      const v = from[i] + (to[i] - from[i]) * t;
      return String(flags.has(i++) ? Math.round(v) : v);
    });
  };
}
