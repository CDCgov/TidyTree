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
 * If the paths have different structures (e.g. switching between straight,
 * square and smooth branches), both are resampled into polylines with the
 * same number of points and those are tweened instead. Where the DOM can't
 * measure paths (no `getPointAtLength`), the interpolator jumps to the target.
 */
export default function interpolatePath(a: string, b: string): (t: number) => string {
  const template = b.replace(NUMBER, "#");
  if (a.replace(NUMBER, "#") !== template) return resampledInterpolator(a, b);

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

const SAMPLES = 32;
let scratch: SVGPathElement | null = null;

/**
 * Samples `SAMPLES + 1` evenly spaced points along a path, or returns null if
 * the environment can't measure SVG paths.
 */
function samplePath(d: string): [number, number][] | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (!scratch || !scratch.isConnected) {
    // Some browsers can't measure paths that aren't in the document, so keep
    // the scratch path in an invisible, zero-size SVG.
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.visibility = "hidden";
    scratch = document.createElementNS(ns, "path") as SVGPathElement;
    svg.appendChild(scratch);
    document.body.appendChild(svg);
  }
  if (typeof scratch.getTotalLength !== "function" || typeof scratch.getPointAtLength !== "function") return null;
  scratch.setAttribute("d", d);
  let length: number;
  try {
    length = scratch.getTotalLength();
  } catch {
    return null;
  }
  if (!isFinite(length)) return null;
  const points: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = scratch.getPointAtLength((length * i) / SAMPLES);
    points.push([p.x, p.y]);
  }
  return points;
}

function resampledInterpolator(a: string, b: string): (t: number) => string {
  const from = samplePath(a);
  const to = from && samplePath(b);
  if (!from || !to) return () => b;
  return (t: number) => {
    if (t >= 1) return b;
    if (t <= 0) return a;
    return "M" + from
      .map(([x, y], i) => `${x + (to[i][0] - x) * t},${y + (to[i][1] - y) * t}`)
      .join("L");
  };
}
