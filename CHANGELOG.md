# Changelog

All notable changes to TidyTree are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (while
pre-1.0, minor versions may contain breaking changes).

Upgrading from 0.7.x? See [Upgrading from 0.7.x to 0.8.0](README.md#upgrading-from-07x-to-080).

## [Unreleased]

## [0.8.1] - 2026-11-20

### Added
- CI workflow that runs lint, typecheck, tests, and build on every pull request and push to `master`, on Node 26, and checks that the committed `dist/` is up to date ([#71](https://github.com/CDCgov/TidyTree/issues/71)).
- `test:watch`, `typecheck`, and `release` npm scripts ([#72](https://github.com/CDCgov/TidyTree/issues/72)).
- This changelog ([#58](https://github.com/CDCgov/TidyTree/issues/58)).

### Changed
- `npm run build` now writes both `dist/tidytree.js` and `dist/tidytree.min.js`; the separate `minify` script is removed.
- Linting uses ESLint 10 with `typescript-eslint` (it previously matched no files).
- Development requires Node.js 26.13 or later (`engines.node`). This doesn't affect consumers of the built library.
- The npm publish workflow runs tests and build before publishing, on Node 26.

### Fixed
- Branch paths no longer pass through invalid SVG arc flags (e.g. `A45,45 0 0 0.5 …`) while animating in circular and radial layouts ([#80](https://github.com/CDCgov/TidyTree/issues/80)).
- Changing the branch mode (`setMode()`) now animates between the old and new branch shapes instead of jumping.
- Branch labels (branch distances) now move with their branches during animated redraws. Previously they stayed at their old positions ([#83](https://github.com/CDCgov/TidyTree/issues/83)).
- Node labels now rotate with their nodes during animated layout changes instead of turning to their final angle at the start.
- Branch labels in circular and radial layouts sit on their branches: on the curve's midpoint along its tangent for smooth branches, and on the radial segment for straight ones. Node labels at exactly 6 o'clock no longer point inward across their own branch ([#68](https://github.com/CDCgov/TidyTree/issues/68)).
- Smooth branch labels in horizontal, vertical, and unrooted layouts are rotated along the curve rather than the straight line between its ends ([#84](https://github.com/CDCgov/TidyTree/issues/84)).
- Calling `destroy()` before a queued redraw has run no longer leads to errors; redraws on a destroyed tree are skipped ([#81](https://github.com/CDCgov/TidyTree/issues/81)).
- `npm test` no longer reports unhandled errors from `redraw()` running against mocked DOM elements.
- Demo app: highlighting is kept after Reset or loading a new tree, and the "collapse node" list is populated. Both read the rendered tree before it had been drawn.
- Demo app: tooltips show node names as text, not HTML, so names in a loaded Newick file can't inject script ([#65](https://github.com/CDCgov/TidyTree/issues/65)). The `setTooltipFormatter()` docs now say that tooltip content may contain untrusted input.
- Demo app: the settings checkboxes in the sidebar are visible and clickable again, clicking a setting's text toggles it, and "Enable Tooltips" turns tooltips on and off.

## [0.8.0] - 2026-11-19

TidyTree has been rewritten in TypeScript, and the demo app has been rebuilt.
No public methods were removed, but rendering is now deferred and some
defaults changed; see [Upgrading from 0.7.x to 0.8.0](README.md#upgrading-from-07x-to-080).

### Added
- Layouts: `radial` and `unrooted`.
- Node color modes `heatmap` and `gradient`; branch color modes `predicate`, `heatmap`, and `gradient`. Heatmap colors are set with `colorOptions.heatmapStart` / `heatmapEnd`.
- Node shapes via the `nodeShape` option: `circle`, `square`, `diamond` (`TidyTree.validNodeShapes`).
- Options: `nodeSize`, `nodeLabelSize`, `branchLabelSize`, `virtualize`, `virtualizationThreshold`.
- `interactive` option and `setInteractive()` to turn pan and zoom on or off.
- Collapse and expand subtrees: `collapseNode()`, `isNodeCollapsed()`, `getDescendantGUIDs()`.
- Per-node metadata: `addAnnotation()`, `getAnnotation()`, `removeAnnotation()`.
- Temporal annotations (time-interval bars on branches): `addTemporalAnnotation()`, `getTemporalAnnotation()`, `removeTemporalAnnotation()`, `setShowTemporalAnnotations()`.
- Viewport virtualization for large trees: with `virtualize: true`, only nodes in view are rendered once the tree exceeds `virtualizationThreshold` nodes.
- Tooltips: `setTooltips()` and `setTooltipFormatter()`. The `showtooltip` event's arguments now include the formatted content.
- Size setters: `setLeafNodeSize()`, `setBranchNodeSize()`, `setLeafLabelSize()`, `setBranchLabelSize()`, `setBranchDistanceSize()`, plus `setBackground()`.
- `TidyTree.defaults`, exposing the default options.
- `TidyTree.patristic`, the bundled copy of [patristic](https://github.com/CDCgov/patristic).
- TypeScript declarations are generated at `dist/main.d.ts` (not yet referenced from `package.json`; see [#55](https://github.com/CDCgov/TidyTree/issues/55)).
- Event handlers receive the DOM event as the second element of their argument array (`[datum, event]`).
- Demo app: export to PNG, SVG, PDF, and Newick; temporal annotation controls; loading a tree from a URL (`?file=`); a Content-Security-Policy and URL validation.

### Changed
- **Requires d3 v7** (0.7.0 needed d3 v5). d3 must still be loaded as a global before TidyTree.
- Rewritten in TypeScript as an ES6 class; still distributed as a browser script that defines a global `TidyTree`.
- **Rendering is deferred to the next animation frame.** `redraw()`, and therefore the constructor and every setter that redraws, now update the DOM inside `requestAnimationFrame`. Code that reads the rendered SVG immediately afterwards (including `getNodeGUIDs()` and `setColorOptions()` with `nodeColorMode: "predicate"`) sees the previous state.
- Default node radius is 3px (was 2.5px) and default branch label size is 10px (was 12px).
- The constructor treats a string as Newick and anything else as tree data (previously it checked `instanceof patristic.Branch`).
- Depends on `patristic` ^0.7.1 from npm (was a GitHub dependency).
- Branch length labels show "—" for zero or missing lengths instead of `0.000`.
- `draw()` throws if the selector matches no element.
- Demo app rebuilt without jQuery, Popper, or Bootstrap Material Design.

### Fixed
- Pan and zoom, and node event handlers, under d3 v7 (they used the removed `d3.event`).
- Stale, slanted ruler ticks after switching between horizontal and vertical layouts.
- `setColorOptions()` warned that `leavesOnly` was missing when it was explicitly `false`.
- `getNodeGUIDs()` relied on d3's private `_groups` property.
- Collecting leaves crashed on nodes without `children`.
- A global `patristic` is still defined for pages that relied on the one earlier builds leaked.
- Demo app: the color pickers sent an invalid `nodeColorMode` (`"list"`) and threw.

### Known issues
- The `branchWidth` and `fontFamily` options are accepted but not yet applied when rendering.
- The demo app applies highlighting right after creating a tree, before it is drawn, so highlighting is dropped after Reset or loading a new tree.
- The demo's tooltip renders node names as HTML ([#65](https://github.com/CDCgov/TidyTree/issues/65)).
- The package can't be imported from a bundler as an ES module ([#55](https://github.com/CDCgov/TidyTree/issues/55), [#56](https://github.com/CDCgov/TidyTree/issues/56)).

## [0.7.1] - 2026-10-13

Not published to npm; these changes ship in 0.8.0.

### Changed
- Updated to d3 v7, patristic 0.7.1, and rollup 4.
- The npm publish workflow runs on Node 20.

### Fixed
- Ruler ticks after a layout change, and the invalid `nodeColorMode` in the demo app (also listed under 0.8.0).

## [0.7.0] - 2023-12-18

Changes in 0.7.0 and earlier are not recorded here; see the
[GitHub releases](https://github.com/CDCgov/TidyTree/releases).

[Unreleased]: https://github.com/CDCgov/TidyTree/compare/v0.8.1...HEAD
[0.8.1]: https://github.com/CDCgov/TidyTree/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/CDCgov/TidyTree/compare/v0.7.0...f3dbfe4
[0.7.1]: https://github.com/CDCgov/TidyTree/compare/v0.7.0...bbf4e57
[0.7.0]: https://github.com/CDCgov/TidyTree/releases/tag/v0.7.0
