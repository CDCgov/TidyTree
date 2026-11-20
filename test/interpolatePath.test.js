import { describe, it, expect } from "vitest";
import interpolatePath from "../src/interpolatePath.ts";

const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const arcFlags = (path) =>
  [...path.matchAll(/A([^MLHVCSQTAZmlhvcsqtaz]*)/g)].flatMap(m => {
    const n = m[1].match(NUM).map(Number);
    return [n[3], n[4]];
  });

// Same shape as the square/straight circular link transformers (#80)
const a = "M42.07,-27.01A50,50 0 0 0 23.97,-43.87L47.94,-87.75";
const b = "M33.65,-21.61A40,40 0 0 1 39.89,-2.82L79.79,-5.65";

describe("interpolatePath (#80)", () => {
  it("keeps arc flags at 0 or 1 throughout the transition", () => {
    const interp = interpolatePath(a, b);
    for (let t = 0; t <= 1; t += 0.05) {
      for (const f of arcFlags(interp(t))) expect([0, 1]).toContain(f);
    }
  });

  it("interpolates the other numbers linearly", () => {
    expect(interpolatePath(a, b)(0.5)).toMatch(/^M37\.86\d*,-24\.31\d*A45,45 0 0 [01] /);
  });

  it("returns exact endpoints", () => {
    expect(interpolatePath(a, b)(1)).toBe(b);
    expect(interpolatePath(a, b)(0)).toBe(a);
  });

  it("handles exponent notation without misreading flags", () => {
    const x = "M1e-7,0A10,10 0 0 0 5,5";
    const y = "M2e-7,0A10,10 0 1 1 5,5";
    for (const t of [0.25, 0.75]) {
      for (const f of arcFlags(interpolatePath(x, y)(t))) expect([0, 1]).toContain(f);
    }
  });

  it("jumps to the target when path structure differs", () => {
    const noArc = "M10,0L20,0";
    expect(interpolatePath(noArc, b)(0)).toBe(b);
    expect(interpolatePath(b, noArc)(0.3)).toBe(noArc);
  });
});

describe("interpolatePath across path structures", () => {
  // Minimal stand-in for an SVG path that "measures" the straight line from
  // the first to the last coordinate in its d attribute.
  const fakeDocument = () => {
    const el = (tag) => ({
      tag,
      style: {},
      isConnected: false,
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(child) { child.isConnected = this.isConnected; },
      getTotalLength() {
        const n = this.attrs.d.match(NUM).map(Number);
        const [x0, y0, x1, y1] = [n[0], n[1], n[n.length - 2], n[n.length - 1]];
        return Math.hypot(x1 - x0, y1 - y0);
      },
      getPointAtLength(len) {
        const n = this.attrs.d.match(NUM).map(Number);
        const [x0, y0, x1, y1] = [n[0], n[1], n[n.length - 2], n[n.length - 1]];
        const f = len / Math.hypot(x1 - x0, y1 - y0);
        return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f };
      }
    });
    return {
      body: { appendChild(child) { child.isConnected = true; } },
      createElementNS: (_ns, tag) => el(tag)
    };
  };

  it("tweens through resampled polylines when the DOM can measure paths", () => {
    const saved = globalThis.document;
    globalThis.document = fakeDocument();
    try {
      const square = "M0,0V10H10";
      const smooth = "M0,0C5,0,5,10,10,10";
      const interp = interpolatePath(square, smooth);
      expect(interp(0)).toBe(square);
      expect(interp(1)).toBe(smooth);
      const mid = interp(0.5);
      expect(mid).toMatch(/^M0,0L/);
      expect(mid.match(/L/g).length).toBe(32);
      expect(mid).toMatch(/L10,10$/);
    } finally {
      globalThis.document = saved;
    }
  });
});
