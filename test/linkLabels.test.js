import { describe, it, expect } from "vitest";
import * as d3 from "d3";
import {
  circularPoint, smoothLinkLabel, smoothRadialLinkLabel, chordLinkLabel, elbowLinkLabel, isLeftHalf
} from "../src/linkLabels.ts";

const parse = (transform) => {
  const [, x, y, r] = transform.match(/translate\(([^,]+), ([^)]+)\) rotate\(([^)]+)\)/);
  return { x: +x, y: +y, rotate: +r };
};
// Direction of a rotation in degrees, compared modulo 180° (text is kept upright).
const sameLine = (a, b) => {
  const d = (((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
};

// A spread of links, including ones that cross 6 o'clock and run counterclockwise.
const links = [
  [0.5, 50, 1.5, 100],
  [1.0, 20, 0.2, 90],
  [2.8, 40, 3.6, 120],
  [4.5, 10, 5.9, 60],
  [3.0, 30, 3.0, 80]
];

describe("circularPoint", () => {
  it("matches d3.pointRadial", () => {
    for (const [a, r] of [[0, 10], [1, 50], [Math.PI, 7], [5.5, 100]]) {
      const [x, y] = circularPoint(a, r);
      const [ex, ey] = d3.pointRadial(a, r);
      expect(x).toBeCloseTo(ex, 9);
      expect(y).toBeCloseTo(ey, 9);
    }
  });
});

describe("smooth circular/radial branch labels (#68)", () => {
  const radialLink = d3.linkRadial().angle(d => d.x).radius(d => d.y);

  it("sit on the drawn curve's midpoint, aligned with its tangent", () => {
    for (const [sa, sr, ta, tr] of links) {
      const path = radialLink({ source: { x: sa, y: sr }, target: { x: ta, y: tr } });
      // d3.linkRadial draws "M p0 C p1, p2, p3"
      const n = path.match(/-?[\d.]+(?:e[-+]?\d+)?/g).map(Number);
      expect(n).toHaveLength(8);
      const mid = [0, 1].map(i => (n[i] + 3 * n[2 + i] + 3 * n[4 + i] + n[6 + i]) / 8);
      const tangent = [0, 1].map(i => n[6 + i] + n[4 + i] - n[2 + i] - n[i]);

      const label = parse(smoothRadialLinkLabel(sa, sr, ta, tr));
      expect(Math.hypot(label.x - mid[0], label.y - mid[1])).toBeLessThan(0.01);
      if (Math.hypot(...tangent) > 1e-6) {
        expect(sameLine(label.rotate, Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI)).toBeLessThan(0.1);
      }
    }
  });
});

describe("smooth horizontal/vertical/unrooted branch labels (#84)", () => {
  // [x0, y0, x1, y1] in screen coordinates, including upward, flat and zero-length branches
  const ends = [[0, 100, 80, 160], [10, 50, 90, -30], [0, 0, 120, 0], [0, 0, 0, 40], [20, 20, 20, 20]];

  for (const [name, link, horizontal] of [
    ["linkHorizontal", d3.linkHorizontal(), true],
    ["linkVertical", d3.linkVertical(), false]
  ]) {
    it(`sit on the ${name} curve's midpoint, aligned with its tangent`, () => {
      for (const [x0, y0, x1, y1] of ends) {
        const n = link({ source: [x0, y0], target: [x1, y1] }).match(/-?[\d.]+(?:e[-+]?\d+)?/g).map(Number);
        expect(n).toHaveLength(8);
        const mid = [0, 1].map(i => (n[i] + 3 * n[2 + i] + 3 * n[4 + i] + n[6 + i]) / 8);
        const tangent = [0, 1].map(i => n[6 + i] + n[4 + i] - n[2 + i] - n[i]);

        const label = parse(smoothLinkLabel(x0, y0, x1, y1, horizontal));
        expect(Math.hypot(label.x - mid[0], label.y - mid[1])).toBeLessThan(0.01);
        if (Math.hypot(...tangent) > 1e-6) {
          expect(sameLine(label.rotate, Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI)).toBeLessThan(0.1);
        }
      }
    });
  }
});

describe("straight circular branch labels", () => {
  it("sit at the chord midpoint, along the chord", () => {
    for (const [sa, sr, ta, tr] of links) {
      const s = circularPoint(sa, sr), t = circularPoint(ta, tr);
      const label = parse(chordLinkLabel(sa, sr, ta, tr));
      expect(label.x).toBeCloseTo((s[0] + t[0]) / 2, 9);
      expect(label.y).toBeCloseTo((s[1] + t[1]) / 2, 9);
      expect(sameLine(label.rotate, Math.atan2(t[1] - s[1], t[0] - s[0]) * 180 / Math.PI)).toBeLessThan(1e-6);
    }
  });
});

describe("elbow (square, and straight radial) branch labels (#68)", () => {
  it("sit at the middle of the radial segment, along it", () => {
    for (const [, sr, ta, tr] of links) {
      // The radial segment runs from the arc's end (target angle, source radius) to the target.
      const a = circularPoint(ta, sr), b = circularPoint(ta, tr);
      const label = parse(elbowLinkLabel(sr, ta, tr));
      expect(label.x).toBeCloseTo((a[0] + b[0]) / 2, 9);
      expect(label.y).toBeCloseTo((a[1] + b[1]) / 2, 9);
      expect(sameLine(label.rotate, Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI)).toBeLessThan(1e-6);
    }
  });
});

describe("node label flipping (#68)", () => {
  it("flips labels on the left half, including exactly 6 o'clock", () => {
    expect(isLeftHalf(0)).toBe(false);
    expect(isLeftHalf(Math.PI / 2)).toBe(false);
    expect(isLeftHalf(Math.PI - 1e-9)).toBe(false);
    expect(isLeftHalf(Math.PI)).toBe(true);
    expect(isLeftHalf(1.5 * Math.PI)).toBe(true);
    expect(isLeftHalf(2 * Math.PI)).toBe(false);
  });

  it("points the middle leaf of a symmetric 3-leaf tree outward", () => {
    const root = d3.hierarchy({ children: [{}, {}, {}] });
    d3.cluster().size([2 * Math.PI, 100]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(root);
    const middle = root.leaves()[1];
    expect(middle.x).toBe(Math.PI);
    // Rotation used by setNodeLabelPosition is -90° here, so text runs outward
    // (downward) only when anchored at its end.
    expect(isLeftHalf(middle.x)).toBe(true);
  });
});
