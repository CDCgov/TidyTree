import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The demo renders node names and other data from user-supplied Newick files
// (including ones loaded via ?file=), so it must never write them as HTML (#65).
describe("demo app HTML sinks (#65)", () => {
  const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
  const lines = html.split("\n").map((text, i) => ({ text, line: i + 1 }));

  it("never calls .html() with content (only .html(null) to clear)", () => {
    const bad = lines.filter(l => /\.html\((?!\s*null\s*\))/.test(l.text));
    expect(bad).toEqual([]);
  });

  it("never assigns innerHTML/outerHTML or uses insertAdjacentHTML/document.write", () => {
    const bad = lines.filter(l => /\b(?:inner|outer)HTML\s*[+]?=|insertAdjacentHTML|document\.write/.test(l.text));
    expect(bad).toEqual([]);
  });
});
