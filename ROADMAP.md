# Recommendations for Improving TidyTree

Based on my analysis of the codebase, here are comprehensive recommendations organized by your five goals:

## 1. Performance Improvements

**Critical issues:**
- **Full re-render on every change** — `redraw()` destroys and rebuilds the entire SVG tree. This is O(n) on every interaction. For trees with hundreds of nodes, this causes visible jank.
- **No requestAnimationFrame** — Animations use `transition()` but there's no rAF fallback for smoother rendering.

**Recommendations:**
```javascript
// Replace redraw with incremental updates
TidyTree.prototype.redraw = function () {
  // Only update changed elements, not everything
  // Use d3's enter/update/exit pattern properly (already partially done but can be improved)
};

// Use requestAnimationFrame for smoother animations
function animateFrame(fn) {
  return requestAnimationFrame(fn);
}

// Implement virtualization for very large trees (1000+ nodes)
```

## 2. Bug Fixes

**Issues found:**
- Circular layout label positioning is incorrect
- `labeler()` returns "0.000" for leaves instead of showing actual branch lengths
- Redundant logic in `findNodeColor` and `findBranchColor`

## 3. Attractiveness Improvements

**Current problems:**
- Dated Bootstrap Material Design UI from ~2017
- Bland default colors (steelblue, lightgray, yellowish)
- Hardcoded node size (2.5px)
- No font customization
- Ruler is just an unstyled line
- No visual hierarchy emphasis

**Recommendations:**
```css
/* Modern CSS variables for theming */
:root {
  --node-color: #2c3e50;
  --branch-color: #bdc3c7;
  --highlight-color: #e67e22;
  --node-size: 3px;
  --font-family: 'Inter', sans-serif;
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Add node size customization via options */
TidyTree.defaults = {
  // ... existing defaults
  nodeSize: 3,
  nodeLabelSize: 12,
  branchWidth: 2,
  fontFamily: "'Inter', sans-serif"
};
```

## 4. Flexibility Improvements

**Current limitations:**
- Only 3 layouts (horizontal, vertical, circular)
- Only 2 color modes ("none", "predicate")
- Only circle node markers
- Limited branch styles
- No annotation support
- No collapse/expand subtrees

**Recommendations:**
```javascript
// Add new layouts
TidyTree.validLayouts = ["horizontal", "vertical", "circular", "radial", "unrooted"];

// Add more color modes
TidyTree.validNodeColorModes = ["none", "predicate", "heatmap", "gradient"];

// Add shape options for nodes
const nodeShapes = {
  circle: d => `circle(${d.y},${d.x},${this.nodeSize})`,
  square: d => `rect(${d.y - this.nodeSize/2},${d.x - this.nodeSize/2},${this.nodeSize},${this.nodeSize})`,
  diamond: d => `polygon(${d.y},${d.x - this.nodeSize},${d.y + this.nodeSize},${d.x},${d.y},${d.x + this.nodeSize},${d.y - this.nodeSize},${d.x})`
};

// Add annotation support
TidyTree.prototype.addAnnotation = function(nodeGuid, data) {
  // Store metadata per node and render it
};

// Add collapse/expand
TidyTree.prototype.collapseNode = function(nodeGuid) {
  // Toggle subtree visibility
};
```

## 6. Additional Missing Features

| Feature | Priority |
|---------|----------|
| Search functionality (search input is non-functional) | High |
| Node selection highlighting | High |
| Collapse/expand subtrees | High |
| Tooltip customization | Medium |
| Export to PNG/SVG/PDF | Medium |
| Sharing/permalink trees | Medium |
| Timeline/temporal annotations | Low |
| Heat map overlays | Low |
| Side-by-side tree comparison | Low |

## 7. Architecture Improvements

**Consider migrating to:**
- **ES6 Class syntax** instead of constructor functions
- **TypeScript** for type safety
- **Vitest/Jest** for unit tests (currently no tests exist)
- **GitHub Actions** for CI/CD

## 8. Recommended Build Changes

```json
// package.json updates
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "lint": "eslint src/",
    "build": "rollup -c && terser dist/tidytree.js --compress > dist/tidytree.min.js",
    "release": "standard-version"
  },
  "devDependencies": {
    "vitest": "^latest",
    "eslint": "^latest",
    "standard-version": "^latest"
  }
}
```

---

## Quick Wins (Implement These First)

1. **Fix `getNodeGUIDs()`** — Replace private `_groups[0]` with public d3 API
2. **Fix `draw()`** — Validate selector before setting `this.parent`
3. **Add CSP headers** — One-line HTML change for immediate security
4. **Add URL validation** — Prevent SSRF attacks in loadFromUrl
5. **Add validation to file loading** — Prevent XSS via malicious Newick
6. **Update default styling** — Modern color palette and fonts
7. **Add node size options** — Let users customize circle sizes