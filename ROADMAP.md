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
- `getNodeGUIDs()` uses d3's private `_groups[0]` API — fragile and will break on d3 updates
- `draw()` sets `this.parent` before validating the selector
- Circular layout label positioning is incorrect
- `setRotation()` recalculates transform without preserving current zoom state
- `labeler()` returns "0.000" for leaves instead of showing actual branch lengths
- Redundant logic in `findNodeColor` and `findBranchColor`

**Fixes:**
```javascript
// Instead of _groups[0], use d3's public API
TidyTree.prototype.getNodeGUIDs = function (leavesOnly, predicate) {
  const selector = leavesOnly 
    ? 'g.tidytree-node-leaf circle' 
    : 'g.tidytree-node-leaf circle, g.tidytree-node-internal circle';
  
  return this.parent
    .select("svg")
    .selectAll(selector)
    .nodes()
    .map(node => ({
      _guid: node.__data__.data._guid,
      id: node.__data__.data.id
    }))
    .filter(predicate ? n => predicate(n) : () => true);
};

// Fix draw() to validate before setting parent
TidyTree.prototype.draw = function (selector) {
  if (!selector && !this.parent) {
    throw Error("No valid target for drawing given!");
  }
  let parent = this.parent;
  if (selector) {
    parent = d3.select(selector);
    this.parent = parent;
  }
  // ... rest of draw
};
```

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

## 5. Security Improvements

**Current issues:**
- PWA lacks security headers
- No Content Security Policy
- "Load from URL" has no URL validation (SSRF risk)
- File loading has no Newick content validation

**Recommendations:**
```html
<!-- Add CSP and security headers -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://d3js.org;">
```

```javascript
// Validate URLs before loading
TidyTree.prototype.loadFromUrl = async function(url) {
  // Validate it's an http/https URL
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only http/https URLs allowed');
    }
    // Fetch and validate Newick content
    const response = await fetch(url);
    const newick = await response.text();
    // Validate it's valid Newick
    patristic.parseNewick(newick); // Will throw if invalid
    this.setTree(newick);
  } catch (e) {
    console.error('Failed to load tree:', e);
  }
};

// Validate uploaded files
TidyTree.prototype.loadFromFile = function(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    try {
      patristic.parseNewick(content);
      this.setTree(content);
    } catch (e) {
      alert('Invalid Newick format');
    }
  };
  reader.readAsText(file);
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