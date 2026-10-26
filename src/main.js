import * as patristic from "patristic";
// import "d3";

/**
 * The patristic library, bundled with TidyTree.
 * @type {Object}
 */
TidyTree.patristic = patristic;

/**
 * This class function creates a TidyTree object.
 * @param {String} newick A valid newick string
 * @param {Object} options A Javascript object containing options to set up the tree
 */
export default function TidyTree(data, options, events) {
  let defaults = Object.assign({}, TidyTree.defaults, {
    colorOptions: { nodeColorMode: "none" },
    events: {
      draw: [],
      showtooltip: [],
      hidetooltip: [],
      contextmenu: [],
      search: [],
      select: []
    }
  });
  if (!options) options = {};
  Object.assign(this, defaults, options);

  // Track collapsed node GUIDs for subtree collapse/expand
  this.collapsedNodes = new Set();

  // Track annotations (metadata) per node GUID
  this.annotations = new Map();

  if(events) Object.keys(events).forEach(e => this.events[e].push(events[e]));

  if (this.parent) this.draw(this.parent);

  if (data instanceof patristic.Branch) {
    this.setData(data);
  } else {
    this.setTree(data);
  }

  if (this.parent) this.recenter();
};

/**
 * Default configuration options for TidyTree instances.
 * These can be overridden by per-instance options passed to the constructor.
 * @type {Object}
 */
TidyTree.defaults = {
  layout: "vertical",
  type: "tree",
  mode: "smooth",
  colorOptions: { nodeColorMode: "none" },
  leafNodes: true,
  leafLabels: false,
  equidistantLeaves: false,
  branchNodes: false,
  branchLabels: false,
  branchDistances: false,
  hStretch: 1,
  vStretch: 1,
  rotation: 0,
  ruler: true,
  interactive: true,
  animation: 500,
  margin: [50, 50, 50, 50],
  nodeSize: 3,
  nodeLabelSize: 12,
  branchLabelSize: 10,
  branchWidth: 2,
  fontFamily: "'Inter', sans-serif",
  nodeShape: "circle"
};

/**
 * Update the TidyTree's underlying data structure
 * There are two contexts in which you should call this:
 * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
 * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
 * @param  {Object} data A patristic.Branch object
 * @return {Object}        the TidyTree object
 */
TidyTree.prototype.setData = function (data) {
  if (!data) throw Error("Invalid Data");
  this.data = data;
  this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  this.hierarchy = d3
    .hierarchy(this.data, d => d.children)
    .eachBefore(d => {
      d.value =
        (d.parent ? d.parent.value : 0) + (d.data.length ? Math.abs(d.data.length) : 0);
      if (d.value < this.range[0]) this.range[0] = d.value;
      if (d.value > this.range[1]) this.range[1] = d.value;
    })
    .each(d => (d.value /= this.range[1]));
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Update the TidyTree's underlying data structure
 * There are two contexts in which you should call this:
 * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
 * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
 * @param  {String} newick A valid newick string
 * @return {Object}        the TidyTree object
 */
TidyTree.prototype.setTree = function (newick) {
  if (!newick) throw Error("Invalid Newick String");
  return this.setData(patristic.parseNewick(newick));
};

/**
 * The available layouts for rendering trees.
 * @type {Array}
 */
TidyTree.validLayouts = ["horizontal", "vertical", "circular", "radial", "unrooted"];

/**
 * The available types for rendering branches.
 * @type {Array}
 */
TidyTree.validTypes = ["tree", "weighted", "dendrogram"];

/**
 * The available modes for rendering branches.
 * @type {Array}
 */
TidyTree.validModes = ["smooth", "square", "straight"];

/**
 * The available color modes for rendering nodes.
 * @type {Array}
 */
TidyTree.validNodeColorModes = ["none", "predicate", "heatmap", "gradient"]; // later, highlight on hover, or maybe color by annotation on a node/ search

/**
 * The available color modes for rendering branches.
 * @type {Array}
 */
TidyTree.validBranchColorModes = ["none", "monophyletic", "heatmap", "gradient"]; // later, toRoot? 

/**
 * The available node shapes for rendering nodes.
 * @type {Array}
 */
TidyTree.validNodeShapes = ["circle", "square", "diamond"];

/**
 * Returns the CSS selector for the node glyph element based on the current nodeShape.
 * @return {String} The selector string ("circle", "rect", or "polygon").
 */
TidyTree.prototype._nodeGlyphSelector = function () {
  const shape = this.nodeShape || "circle";
  return shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";
};

/**
 * Private method to calculate how much vertical space to leave for the ruler
 */
TidyTree.prototype._rulerOffset = function () {
  return this.ruler &&
    this.layout === "horizontal" &&
    (this.type === 'weighted' || this.type === 'tree')
    ? 25 : 0;
}

/**
 * Draws a Phylogenetic on the element referred to by selector
 * @param  {String} selector A CSS selector
 * @return {TidyTree}           the TidyTree object
 */
TidyTree.prototype.draw = function (selector) {
  if (!selector && !this.parent) {
    throw Error("No valid target for drawing given! Where should the tree go?");
  }
  let parent;
  if (selector) {
    parent = d3.select(selector);
    if (parent.empty()) {
      throw Error(`Invalid selector: ${selector}`);
    }
    this.parent = parent;
  } else {
    parent = this.parent;
  }

  this.width =
    parseFloat(parent.style("width")) - this.margin[1] - this.margin[3];
  this.height =
    parseFloat(parent.style("height")) - this.margin[0] - this.margin[2] - this._rulerOffset();

  let tree = d3.tree();

  let svg = parent
    .html(null)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  let g = svg.append("g");

  svg
    .append("g")
    .attr("class", "tidytree-ruler")
    .append("rect")
    .attr("y", -5)
    .attr("fill", "white");

  this.zoom = d3.zoom().on("zoom", (e) => {
    let transform = e.transform;
    this.transform = transform;
    g.attr(
      "transform",
      `translate(${transform.x},${transform.y}) scale(${transform.k}) rotate(${
        this.rotation
      },${this.layout === "circular" ? 0 : this.width / 2},${
        this.layout === "circular" ? 0 : this.height / 2
      })`
    );
    updateRuler.call(this, transform);
  });

  if (this.interactive) {
    svg.call(this.zoom);
  } else {
    svg.on('.zoom', null);
  }
  
  g.append("g").attr("class", "tidytree-links");
  g.append("g").attr("class", "tidytree-nodes");

  if (this.events.draw.length) this.events.draw.forEach(c => c());

  return this;
};

const getX = d => d.x,
  getY = d => d.y,
  getLength = d => d.weight;

let linkTransformers = {
  tree: {
    smooth: {
      horizontal: d3
        .linkHorizontal()
        .x(getY)
        .y(getX),
      vertical: d3
        .linkVertical()
        .x(getX)
        .y(getY),
      circular: d3
        .linkRadial()
        .angle(getX)
        .radius(getY),
      radial: d3
        .linkRadial()
        .angle(getX)
        .radius(getY),
      unrooted: d3
        .linkHorizontal()
        .x(getY)
        .y(getX)
    },
    straight: {
      horizontal: d =>
        `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
      vertical: d =>
        `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
      circular: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.y,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.y;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      radial: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.y,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.y;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      unrooted: d =>
        `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`
    },
    square: {
      horizontal: d =>
        `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
      vertical: d =>
        `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
      circular: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.y,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.y;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          (endAngle === startAngle
            ? ""
            : "A" +
              startRadius +
              "," +
              startRadius +
              " 0 0 " +
              (endAngle > startAngle ? 1 : 0) +
              " " +
              startRadius * x1 +
              "," +
              startRadius * y1) +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      radial: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.y,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.y;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          (endAngle === startAngle
            ? ""
            : "A" +
              startRadius +
              "," +
              startRadius +
              " 0 0 " +
              (endAngle > startAngle ? 1 : 0) +
              " " +
              startRadius * x1 +
              "," +
              startRadius * y1) +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      unrooted: d =>
        `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`
    }
  },
  weighted: {
    smooth: {
      horizontal: d3
        .linkHorizontal()
        .x(getLength)
        .y(getX),
      vertical: d3
        .linkVertical()
        .x(getX)
        .y(getLength),
      circular: d3
        .linkRadial()
        .angle(getX)
        .radius(getLength),
      radial: d3
        .linkRadial()
        .angle(getX)
        .radius(getLength),
      unrooted: d3
        .linkHorizontal()
        .x(getLength)
        .y(getX)
    },
    straight: {
      horizontal: d =>
        `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`,
      vertical: d =>
        `M${d.source.x} ${d.source.weight} L ${d.target.x} ${d.target.weight}`,
      circular: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.weight,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.weight;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      radial: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.weight,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.weight;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      unrooted: d =>
        `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`
    },
    square: {
      horizontal: d =>
        `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${
          d.target.weight
        }`,
      vertical: d =>
        `M${d.source.x} ${d.source.weight} H ${d.target.x} V ${
          d.target.weight
        }`,
      circular: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.weight,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.weight;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          (endAngle === startAngle
            ? ""
            : "A" +
              startRadius +
              "," +
              startRadius +
              " 0 0 " +
              (endAngle > startAngle ? 1 : 0) +
              " " +
              startRadius * x1 +
              "," +
              startRadius * y1) +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      radial: d => {
        const startAngle = d.source.x - Math.PI / 2,
          startRadius = d.source.weight,
          endAngle = d.target.x - Math.PI / 2,
          endRadius = d.target.weight;
        const x0 = Math.cos(startAngle),
          y0 = Math.sin(startAngle),
          x1 = Math.cos(endAngle),
          y1 = Math.sin(endAngle);
        return (
          "M" +
          startRadius * x0 +
          "," +
          startRadius * y0 +
          (endAngle === startAngle
            ? ""
            : "A" +
              startRadius +
              "," +
              startRadius +
              " 0 0 " +
              (endAngle > startAngle ? 1 : 0) +
              " " +
              startRadius * x1 +
              "," +
              startRadius * y1) +
          "L" +
          endRadius * x1 +
          "," +
          endRadius * y1
        );
      },
      unrooted: d =>
        `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${
          d.target.weight
        }`
    }
  }
};

linkTransformers.dendrogram = linkTransformers.tree;

/**
 * Calculate the coordinates of a point transformed onto a circle.
 *
 * @param {number} x - The x-coordinate of the center of the point.
 * @param {number} y - The y-coordinate of the center of the point.
 * @return {Array<number>} The new x and y coordinates of the point on the circle.
 */
function circularPoint(x, y) {
  return [(y = +y) * Math.cos((x -= Math.PI / 2)), y * Math.sin(x)];
}

/**
 * Sets the position and rotation of node labels based on layout.
 * @param {D3Selection} selection - The text selection to position.
 * @param {String} layout - The current layout ("vertical", "horizontal", "circular").
 */
function setNodeLabelPosition(selection, layout) {
  if (layout === "vertical") {
    selection
      .attr("text-anchor", "start")
      .attr("x", 5)
      .attr("transform", "rotate(90)");
  } else if (layout === "horizontal" || layout === "unrooted") {
    selection
      .attr("text-anchor", "start")
      .attr("x", 5)
      .attr("transform", "rotate(0)");
  } else {
    // circular or radial
    selection
      .attr("transform", l => `rotate(${(((l.x / Math.PI) * 180) % 180) - 90})`)
      .attr("text-anchor", l => l.x % (2 * Math.PI) > Math.PI ? "end" : "start")
      .attr("x", l => (l.x % (2 * Math.PI) > Math.PI ? -5 : 5));
  }
}

let nodeTransformers = {
  tree: {
    horizontal: d => `translate(${d.y}, ${d.x})`,
    vertical: d => `translate(${d.x}, ${d.y})`,
    circular: d => `translate(${circularPoint(d.x, d.y)})`,
    radial: d => `translate(${circularPoint(d.x, d.y)})`,
    unrooted: d => `translate(${d.y}, ${d.x})`
  },
  weighted: {
    horizontal: d => `translate(${d.weight}, ${d.x})`,
    vertical: d => `translate(${d.x}, ${d.weight})`,
    circular: d => `translate(${circularPoint(d.x, d.weight)})`,
    radial: d => `translate(${circularPoint(d.x, d.weight)})`,
    unrooted: d => `translate(${d.weight}, ${d.x})`
  }
};

nodeTransformers.dendrogram = nodeTransformers.tree;

/**
 * Finds the color of a given node based on the color options provided.
 *
 * @param {Object} node - The node for which to find the color.
 * @param {Object} colorOptions - The color options object containing the color mode, leavesOnly, predicate, default color, and highlight color.
 * @return {string} The color of the node.
 */
function findNodeColor(node, colorOptions) {
  if (colorOptions.nodeColorMode === "none") {
    return colorOptions.defaultNodeColor ?? "#4682B4";
  }

  if (colorOptions.nodeColorMode === "predicate") {
    let guidList = colorOptions.nodeList?.map(n => n._guid);

    if (guidList && guidList.includes(node.data._guid)) {
      return colorOptions.highlightColor ?? "#feb640";
    } else {
      return colorOptions.defaultNodeColor ?? "#243127";
    }
  }

  if (colorOptions.nodeColorMode === "heatmap" || colorOptions.nodeColorMode === "gradient") {
    // Color by branch length / depth using a heatmap gradient
    const value = node.data.value != null ? node.data.value : 0;
    const startColor = colorOptions.heatmapStart ?? "#2c3e50";
    const endColor = colorOptions.heatmapEnd ?? "#e67e22";
    return interpolateColor(startColor, endColor, value);
  }

  return colorOptions.defaultNodeColor ?? "#4682B4";
}

/**
 * Interpolate between two hex colors by a factor t (0 to 1).
 * @param {string} colorA - Starting hex color.
 * @param {string} colorB - Ending hex color.
 * @param {number} t - Interpolation factor between 0 and 1.
 * @return {string} The interpolated hex color.
 */
function interpolateColor(colorA, colorB, t) {
  t = Math.max(0, Math.min(1, t));
  const hexToRgb = hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * Find the color of a given link based on the provided color options.
 *
 * @param {string} link - The link for which to find the color.
 * @param {object} colorOptions - The options for different link colors.
 * @return {string} The color of the link.
 */
function findBranchColor(link, colorOptions) {
  if (colorOptions.branchColorMode === "none") {
    return colorOptions.defaultBranchColor ?? "#cccccc";
  }

  if (colorOptions.branchColorMode === "predicate") {
    let source = link.source;
    let childLeafNodes = getAllLeaves(source);
    let guidList = colorOptions.nodeList?.map(node => node._guid);
    
    let allChildLeafNodesInNodeList = childLeafNodes.every(child =>
      guidList?.includes(child.data._guid)
    );
   
    if (allChildLeafNodesInNodeList) {
      return colorOptions.highlightColor ?? "#feb640";
    }

    return colorOptions.defaultBranchColor ?? "#cccccc";
  }

  if (colorOptions.branchColorMode === "heatmap" || colorOptions.branchColorMode === "gradient") {
    const value = link.target.data.value != null ? link.target.data.value : 0;
    const startColor = colorOptions.heatmapStart ?? "#2c3e50";
    const endColor = colorOptions.heatmapEnd ?? "#e67e22";
    return interpolateColor(startColor, endColor, value);
  }

  return colorOptions.defaultBranchColor ?? "#cccccc";
}

/**
 * Returns an array of all the child leaf nodes of the given node in a tree.
 *
 * @param {Object} node - A node of the tree.
 * @param {boolean} includeSelf - Whether to include the given node itself as a leaf node. Defaults to false.
 * @return {Array} An array of leaf nodes.
 */
function getAllLeaves(node, includeSelf) {
  includeSelf = includeSelf ?? false;
  let leaves = [];

  if (includeSelf && node.height === 0) {
    leaves.push(node);
  } else {
    node.children.forEach(child => {
      leaves.push(...getAllLeaves(child, true));
    });
  }

  return leaves;
}

const radToDeg = 180 / Math.PI;

let labelTransformers = {
  tree: {
    straight: {
      horizontal: l =>
        `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.y - l.source.y)
        ) * radToDeg})`,
      vertical: l =>
        `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.y +
          l.target.y) /
          2}) rotate(${Math.atan(
          (l.source.y - l.target.y) / (l.source.x - l.target.x)
        ) * radToDeg})`,
      circular: l => {
        let s = circularPoint(l.source.x, l.source.y),
          t = circularPoint(l.target.x, l.target.y);
        return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) /
          2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
      },
      radial: l => {
        let s = circularPoint(l.source.x, l.source.y),
          t = circularPoint(l.target.x, l.target.y);
        return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) /
          2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
      },
      unrooted: l =>
        `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.y - l.source.y)
        ) * radToDeg})`
    },
    square: {
      horizontal: l =>
        `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`,
      vertical: l =>
        `translate(${l.target.x}, ${(l.source.y + l.target.y) / 2}) rotate(90)`,
      circular: l => {
        let u = circularPoint(l.target.x, (l.source.y + l.target.y) / 2);
        return `translate(${u[0]}, ${u[1]}) rotate(${((l.target.x * radToDeg) %
          180) -
          90})`;
      },
      radial: l => {
        let u = circularPoint(l.target.x, (l.source.y + l.target.y) / 2);
        return `translate(${u[0]}, ${u[1]}) rotate(${((l.target.x * radToDeg) %
          180) -
          90})`;
      },
      unrooted: l =>
        `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`
    }
  },
  weighted: {
    straight: {
      horizontal: l =>
        `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.weight - l.source.weight)
        ) * radToDeg})`,
      vertical: l =>
        `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.weight +
          l.target.weight) /
          2}) rotate(${Math.atan(
          (l.source.weight - l.target.weight) / (l.source.x - l.target.x)
        ) * radToDeg})`,
      circular: l => {
        let s = circularPoint(l.source.x, l.source.weight),
          t = circularPoint(l.target.x, l.target.weight);
        return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) /
          2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
      },
      radial: l => {
        let s = circularPoint(l.source.x, l.source.weight),
          t = circularPoint(l.target.x, l.target.weight);
        return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) /
          2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
      },
      unrooted: l =>
        `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.weight - l.source.weight)
        ) * radToDeg})`
    },
    square: {
      horizontal: l => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `,
      vertical: l => `
        translate(${l.target.x}, ${(l.source.weight + l.target.weight) / 2})
        rotate(90)
      `,
      circular: l => {
        let u = circularPoint(
          l.target.x,
          (l.source.weight + l.target.weight) / 2
        );
        return `
          translate(${u[0]}, ${u[1]})
          rotate(${((l.target.x * radToDeg) % 180) - 90})
        `;
      },
      radial: l => {
        let u = circularPoint(
          l.target.x,
          (l.source.weight + l.target.weight) / 2
        );
        return `
          translate(${u[0]}, ${u[1]})
          rotate(${((l.target.x * radToDeg) % 180) - 90})
        `;
      },
      unrooted: l => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `
    }
  }
};
labelTransformers.tree.smooth = labelTransformers.tree.straight;
labelTransformers.weighted.smooth = labelTransformers.weighted.straight;
labelTransformers.dendrogram = labelTransformers.tree;

function labeler(d) {
  // Show actual branch length; leaves without an explicit length show "—"
  const length = d.target.data.length;
  return length != null && length > 0 ? length.toFixed(3) : "\u2014";
}

/**
 * Wraps a d3 selection transition with requestAnimationFrame for smoother rendering.
 * If animation is 0, applies attributes immediately without animation.
 * @param {D3Selection} selection - The d3 selection to transition.
 * @param {Object} attrs - Object of attribute/style key-value pairs to apply.
 * @param {Function} applyFn - Optional function to apply custom transition logic.
 * @return {D3Transition|D3Selection} The transition or selection.
 */
TidyTree.prototype._transition = function (selection, attrs, applyFn) {
  if (!this.animation || this.animation <= 0) {
    if (applyFn) applyFn(selection);
    else if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (key.startsWith("style:")) {
          selection.style(key.slice(6), value);
        } else {
          selection.attr(key, value);
        }
      });
    }
    return selection;
  }
  let transition = selection.transition().duration(this.animation);
  if (applyFn) applyFn(transition);
  else if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (key.startsWith("style:")) {
        transition.style(key.slice(6), value);
      } else {
        transition.attr(key, value);
      }
    });
  }
  return transition;
};

/**
 * Redraws the links and relocates the nodes accordingly
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.redraw = function () {
  let tree = this;
  // Wrap the redraw in requestAnimationFrame for smoother rendering
  requestAnimationFrame(() => {
    let parent = tree.parent;

    tree.width  = (parseFloat(parent.style("width" )) - tree.margin[1] - tree.margin[3]) * tree.hStretch;
    tree.height = (parseFloat(parent.style("height")) - tree.margin[0] - tree.margin[2] - tree._rulerOffset()) * tree.vStretch;

    tree.scalar =
      tree.layout === "horizontal" ? tree.width :
      tree.layout === "vertical" ? tree.height :
      Math.min(tree.width, tree.height) / 2;

    tree.hierarchy.each(d => (d.weight = tree.scalar * d.value));

    // Build a filtered hierarchy that excludes collapsed subtrees
    let filteredHierarchy = tree._getFilteredHierarchy();

    let g = parent.select("svg g");

    let source = (tree.type === "tree" ? d3.tree() : d3.cluster()).size(
      tree.layout === "circular"   ? [2 * Math.PI, Math.min(tree.height, tree.width) / 2] :
      tree.layout === "radial"     ? [2 * Math.PI, Math.min(tree.height, tree.width) / 2] :
      tree.layout === "unrooted"   ? [tree.width, tree.height] :
      tree.layout === "horizontal" ? [tree.height, tree.width] :
      [tree.width, tree.height]
    );

    if (tree.equidistantLeaves) {
      if (tree.layout === "circular" || tree.layout === "radial") {
        source.separation((a,b) => 1 / a.depth);
      } else {
        source.separation((a,b) => 1);
      }
    } else {
      if (tree.layout === "circular" || tree.layout === "radial")
        source.separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
    }
    
    //Note: You must render links prior to nodes in order to get correct placement!
    let links = g
      .select("g.tidytree-links")
      .selectAll("g.tidytree-link")
      .data(source(filteredHierarchy).links(), l => l.source.data._guid + ':' + l.target.data._guid);

    links.join(
      enter => {
        let newLinks = enter.append("g").attr("class", "tidytree-link");

        let linkTransformer = linkTransformers[tree.type][tree.mode][tree.layout];
        newLinks
          .append("path")
          .attr("fill", "none")
          .attr("stroke", d => findBranchColor(d, tree.colorOptions))
          .attr("d", linkTransformer)
          .transition()
          .duration(tree.animation)
          .attr("opacity", 1);

        let labelTransformer = labelTransformers[tree.type][tree.mode][tree.layout];
        newLinks
          .append("text")
          .attr("y", 2)
          .attr("text-anchor", "middle")
          .style("font-size", tree.branchLabelSize + "px")
          .text(labeler)
          .attr("transform", labelTransformer)
          .transition()
          .duration(tree.animation)
          .style("opacity", tree.branchDistances ? 1 : 0);
      },
      update => {
        // Progressive transition: update attributes smoothly without fading out
        let linkTransformer = linkTransformers[tree.type][tree.mode][tree.layout];
        let paths = update.select("path");
        if (!tree.animation > 0) {
          paths
            .attr("d", linkTransformer)
            .attr("stroke", d => findBranchColor(d, tree.colorOptions))
            .attr("opacity", 1);
        } else {
          // Transition d (path), stroke, and opacity simultaneously over full animation duration
          paths
            .transition()
            .duration(tree.animation)
            .attr("d", linkTransformer)
            .attr("stroke", d => findBranchColor(d, tree.colorOptions))
            .attr("opacity", 1);
        }

        let labelTransformer =
          labelTransformers[tree.type][tree.mode][tree.layout];
        let labels = update.select("text");
        if (tree.animation) {
          // Transition transform and text progressively
          labels
            .transition()
            .duration(tree.animation)
            .attr("transform", labelTransformer)
            .text(labeler);
          if (tree.branchDistances) {
            labels
              .transition()
              .duration(tree.animation)
              .style("opacity", 1);
          } else {
            labels
              .transition()
              .duration(tree.animation)
              .style("opacity", 0);
          }
        } else {
          labels.text(labeler).attr("transform", labelTransformer);
          labels.style("opacity", tree.branchDistances ? 1 : 0);
        }
      },
      exit =>
        exit
          .transition()
          .duration(tree.animation)
          .remove()
    );

    let nodes = g
      .select("g.tidytree-nodes")
      .selectAll("g.tidytree-node")
      .data(filteredHierarchy.descendants(), d => d.data._guid);
    nodes.join(
      enter => {
        let nt = nodeTransformers[tree.type][tree.layout];
        let newNodes = enter
          .append("g")
          .attr("class", "tidytree-node")
          .classed("tidytree-node-internal", d => d.children)
          .classed("tidytree-node-leaf", d => !d.children)
          .attr("transform", nt);

        const t = tree;
        newNodes
          .each(function(d) {
            const node = d3.select(this);
            const shape = t.nodeShape || "circle";
            const size = t.nodeSize || 3;
            if (shape === "circle") {
              node.append("circle")
                .attr("r", size)
                .attr("title", d.data.id);
            } else if (shape === "square") {
              node.append("rect")
                .attr("x", -size / 2)
                .attr("y", -size / 2)
                .attr("width", size)
                .attr("height", size)
                .attr("title", d.data.id);
            } else if (shape === "diamond") {
              node.append("polygon")
                .attr("points", `0,-${size/2} ${size/2},0 0,${size/2} ${-size/2},0`)
                .attr("title", d.data.id);
            }
          })
          .style("opacity", d =>
            (d.children && t.branchNodes) ||
            (!d.children && t.leafNodes) ? 1 : 0
          )
          .style("fill", d => findNodeColor(d, t.colorOptions))
          .on("mouseenter focusin", d => {
          const content = t.tooltipFormatter ? t.tooltipFormatter(d.data) : d.data.id;
          t.trigger("showtooltip", d, content);
        })
        .on("mouseout focusout", d => t.trigger("hidetooltip", d))
          .on("contextmenu", d => t.trigger("contextmenu", d))
          .on("click", d => t.trigger("select", d));

        let nodeLabels = newNodes
          .append("text")
          .text(d => d.data.id)
          .style("font-size", t.nodeLabelSize + "px")
          .attr("y", 2)
          .style("opacity", d =>
            ( d.children && t.branchLabels) ||
            (!d.children && t.leafLabels) ? 1 : 0
          );

        setNodeLabelPosition(nodeLabels, t.layout);

        // Render annotations for this node
        const annotation = t.annotations.get(d.data._guid);
        if (annotation) {
          newNodes.append("text")
            .attr("class", "tidytree-node-annotation")
            .text(d => {
              const ann = t.annotations.get(d.data._guid);
              return ann ? JSON.stringify(ann) : "";
            })
            .style("font-size", Math.max(8, t.nodeLabelSize - 2) + "px")
            .attr("y", 14)
            .style("fill", "#666")
            .style("opacity", d =>
              ( d.children && t.branchLabels) ||
              (!d.children && t.leafLabels) ? 1 : 0
            );
          setNodeLabelPosition(newNodes.select("text.tidytree-node-annotation"), t.layout);
        }

        newNodes
          .transition()
          .duration(t.animation)
          .attr("opacity", 1);
      },
      update => {
        // Progressive transition: update transform, fill, and label position smoothly
        let nodeTransformer = nodeTransformers[t.type][t.layout];
        const shape = t.nodeShape || "circle";
        const glyphSelector = shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";

        if (!t.animation > 0) {
          // No animation: directly set attributes
          update.attr("transform", nodeTransformer);
          update.select(glyphSelector)
            .style("fill", d => findNodeColor(d, t.colorOptions))
            .style("opacity", d =>
              (d.children && t.branchNodes) ||
              (!d.children && t.leafNodes) ? 1 : 0
            );
          setNodeLabelPosition(update.select("text"), t.layout);
          // Update annotation text
          update.select("text.tidytree-node-annotation")
            .text(d => {
              const ann = t.annotations.get(d.data._guid);
              return ann ? JSON.stringify(ann) : "";
            })
            .style("opacity", d =>
              ( d.children && t.branchLabels) ||
              (!d.children && t.leafLabels) ? 1 : 0
            );
          setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
        } else {
          // Animate transform and fill, ensure opacity is restored to 1
          update
            .transition()
            .duration(t.animation)
            .attr("transform", nodeTransformer)
            .attr("opacity", 1);

          let nodeGlyphs = update.select(glyphSelector);
          nodeGlyphs
            .transition()
            .duration(t.animation)
            .style("fill", d => findNodeColor(d, t.colorOptions))
            .style("opacity", d =>
              (d.children && t.branchNodes) ||
              (!d.children && t.leafNodes) ? 1 : 0
            );

          let nodeLabels = update.select("text");
          setNodeLabelPosition(nodeLabels, t.layout);
          // Update annotation text
          update.select("text.tidytree-node-annotation")
            .text(d => {
              const ann = t.annotations.get(d.data._guid);
              return ann ? JSON.stringify(ann) : "";
            })
            .style("opacity", d =>
              ( d.children && t.branchLabels) ||
              (!d.children && t.leafLabels) ? 1 : 0
            );
          setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
        }
      },
      exit =>
        exit
          .transition()
          .duration(t.animation)
          .remove()
    );

    // Pass current zoom transform so the ruler respects zoom level
    updateRuler.call(t, t.transform || { k: 1 });
  });

  return this;
};

function updateRuler(transform) {
  if (!transform) transform = { k: 1 };
  let height = parseFloat(this.parent.style("height")) - this.margin[2] - 15;
  let ruler = this.parent.select("g.tidytree-ruler");
  let bg = ruler.select("rect");
  if (this.ruler) {
    if (this.layout == "horizontal") {
      ruler.attr("transform", `translate(${this.margin[3]}, ${height})`);
      bg
        .attr("width", `calc(100% - ${this.margin[1] + this.margin[3] - 15}px)`)
        .attr("height", "25px")
        .attr("x", -5);
    } else {
      ruler.attr("transform", `translate(${this.margin[3] - 10}, ${this.margin[0]})`);
      bg
        .attr("height", `calc(100% - ${this.margin[0] + this.margin[2] - 15}px)`)
        .attr("width", "25px")
        .attr("x", -25);
    }
    let axis = this.layout == "horizontal" ? d3.axisBottom() : d3.axisLeft();
    if (this.type === "tree" && this.layout !== "circular") {
      ruler
        .attr("opacity", 1)
        .call(
          axis.scale(
            d3.scaleLinear(
              [0, this.hierarchy.height / transform.k],
              [0, this.scalar]
            )
          )
        );
    } else if (this.type === "weighted" && this.layout !== "circular") {
      ruler
        .attr("opacity", 1)
        .call(
          axis.scale(
            d3.scaleLinear(
              [this.range[0], this.range[1] / transform.k],
              [0, this.scalar]
            )
          )
        );
    } else {
      ruler
        .transition()
        .duration(this.animation)
        .attr("opacity", 0);
    }
  } else {
    ruler
      .transition()
      .duration(this.animation)
      .attr("opacity", 0);
  }
}

TidyTree.prototype.setInteractive = function (bool) {
  this.interactive = bool;

  let svg = this.parent.select("svg");
  if (this.interactive) {
    svg.call(this.zoom);
  } else {
    svg.on('.zoom', null);
  }
  
  return this;
}

/**
 * Recenters the tree in the center of the view
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.recenter = function () {
  let svg = this.parent.select("svg"),
    x = this.margin[3],
    y = this.margin[0];
  if (this.layout === "circular") {
    x += parseFloat(svg.style("width")) / 2;
    y += parseFloat(svg.style("height")) / 2;
  }
  svg
    .transition()
    .duration(this.animation)
    .call(this.zoom.transform, d3.zoomIdentity.translate(x, y));
  return this;
};

/**
 * Set the TidyTree's layout
 * @param {String} newLayout The new layout
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setLayout = function (newLayout) {
  if (!TidyTree.validLayouts.includes(newLayout)) {
    throw Error(`
      Cannot set TidyTree to layout: ${newLayout}\n
      Valid layouts are: ${TidyTree.validLayouts.join(', ')}
    `);
  }
  this.layout = newLayout;
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's colorOptions
 * @param {Object} newColorOptions The new colorOptions
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setColorOptions = function (newColorOptions) {
  if (!TidyTree.validNodeColorModes.includes(newColorOptions.nodeColorMode)) {
    throw Error(`
      Cannot set TidyTree colorOptions: ${newColorOptions.nodeColorMode}\n
      Valid nodeColorModes are: ${TidyTree.validNodeColorModes.join(', ')}
    `);
  }
  if (!TidyTree.validBranchColorModes.includes(newColorOptions.branchColorMode)) {
    throw Error(`
      Cannot set TidyTree colorOptions: ${newColorOptions.branchColorMode}\n
      Valid branchColorModes are: ${TidyTree.validBranchColorModes.join(', ')}
    `);
  }

  if (newColorOptions.nodeColorMode === 'predicate') {
    if (!newColorOptions.predicate) {
      console.warn('Warning: colorOptions.predicate not supplied');
    }
    if (!newColorOptions.leavesOnly) {
      newColorOptions.leavesOnly = false;
      console.warn('Warning: colorOptions.leavesOnly not supplied and defaulted to false');
    }
    newColorOptions.nodeList = this.getNodeGUIDs(newColorOptions.leavesOnly, newColorOptions.predicate);
  } else if (newColorOptions.nodeColorMode === 'heatmap' || newColorOptions.nodeColorMode === 'gradient') {
    // Heatmap/gradient modes don't require a predicate or nodeList
    if (!newColorOptions.heatmapStart) newColorOptions.heatmapStart = "#2c3e50";
    if (!newColorOptions.heatmapEnd) newColorOptions.heatmapEnd = "#e67e22";
  } else {
    // nodeColorMode === 'none'
    if (newColorOptions.branchColorMode !== 'none') {
      throw Error('branchColorMode must be "none" for nodeColorMode "none"');
    }
  }

  this.colorOptions = newColorOptions;
  if (this.parent) return this.redraw();
  return this;
}

/**
 * Set the TidyTree's mode
 * @param {String} newMode The new mode
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.setMode = function (newMode) {
  if (!TidyTree.validModes.includes(newMode)) {
    throw Error(`
      Cannot set TidyTree to mode: ${newMode},\n
      Valid modes are: ${TidyTree.validModes.join(', ')}
    `);
  }
  this.mode = newMode;
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's type
 * @param {Boolean} newType The new type
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setType = function (newType) {
  if (!TidyTree.validTypes.includes(newType)) {
    throw Error(`
      Cannot set TidyTree to type: ${newType},\n
      Valid types are: ${TidyTree.validTypes.join(', ')}
    `);
  }
  this.type = newType;
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's rotation
 * @param {Number} degrees The new number of degrees by which to rotate the tree
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setRotation = function (degrees) {
  this.rotation = degrees;
  if (this.parent)
    this.parent
      .select("svg g")
      .attr("transform", `
        translate(${this.transform.x},${this.transform.y})
        scale(${this.transform.k})
        rotate(${this.rotation},
          ${this.layout === "circular" ? 0 : this.width / 2},
          ${this.layout === "circular" ? 0 : this.height / 2}
        )
      `);
  return this;
};

/**
 * Set the TidyTree's Horizontal Stretch
 * @param {Number} proportion The new proportion by which to stretch the tree
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setHStretch = function (proportion) {
  this.hStretch = parseFloat(proportion);
  if (this.parent) {
    let animCache = this.animation;
    this.setAnimation(0);
    this.redraw();
    this.setAnimation(animCache);
  }
  return this;
};

/**
 * Set the TidyTree's Vertical Stretch
 * @param {Number} proportion The new proportion by which to stretch the tree
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setVStretch = function (proportion) {
  this.vStretch = parseFloat(proportion);
  if (this.parent) {
    let animCache = this.animation;
    this.setAnimation(0);
    this.redraw();
    this.setAnimation(animCache);
  }
  return this;
};

/**
 * Set the TidyTree's animation time. Note that this does not trigger a
 * redraw.
 * @param {number} time The desired duration of an animation, in ms. Set to 0
 * to turn animations off completely.
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.setAnimation = function (time) {
  this.animation = time;
  return this;
};

/**
 * Shows or hides the Branch Nodes
 * @param  {Boolean} show Should Branch nodes be shown?
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setBranchNodes = function (show) {
  this.branchNodes = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    this.parent
      .select("svg")
      .selectAll(`g.tidytree-node-internal ${this._nodeGlyphSelector()}`)
      .transition()
      .duration(this.animation)
      .style("opacity", show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Nodes
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchNode = function (styler) {
  if (!this.parent)
    throw Error(
      "Tree has not been rendered yet! Can't style Nodes that don't exist!"
    );
  this.parent
    .select("svg")
    .selectAll(`g.tidytree-node-internal ${this._nodeGlyphSelector()}`)
    .each(function (d) { styler(this, d); });
  return this;
};

/**
 * Set the TidyTree's branchLabels
 * @param  {Boolean} show Should the TidyTree show branchLabels?
 * @return {TidyTree}     the TidyTree Object
 */
TidyTree.prototype.setBranchLabels = function (show) {
  this.branchLabels = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    this.parent
      .select("svg")
      .selectAll("g.tidytree-node-internal text")
      .transition()
      .duration(this.animation)
      .style("opacity", show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Branch Label
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchLabel = function (styler) {
  if (!this.parent){
    throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
  }
  this.parent
    .select("svg")
    .selectAll("g.tidytree-node-internal text")
    .each(function (d, i, l) { styler(this, d); });
  return this;
};

/**
 * Shows or hides the TidyTree's branch labels
 * @param {Boolean} show Should the TidyTree show branch distances?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setBranchDistances = function (show) {
  this.branchDistances = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    let links = this.parent
      .select("svg g.tidytree-links")
      .selectAll("g.tidytree-link")
      .selectAll("text");
    links.attr("transform", labelTransformers[this.type][this.mode][this.layout]);
    links
      .transition()
      .duration(this.animation)
      .style("opacity", show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Branch Distances
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchDistance = function (styler) {
  if (!this.parent)
    throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
  this.parent
    .select("svg g.tidytree-links")
    .selectAll("g.tidytree-link")
    .selectAll("text")
    .each(function (d, i, l) { styler(this, d); });
  return this;
};

/**
 * Shows or Hides the Leaf Nodes
 * @param  {Boolean} show Should leaf nodes be visible?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setLeafNodes = function (show) {
  this.leafNodes = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    this.parent
      .select("svg")
      .selectAll(`g.tidytree-node-leaf ${this._nodeGlyphSelector()}`)
      .transition()
      .duration(this.animation)
      .style("opacity", show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Nodes
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachLeafNode = function (styler) {
  if (!this.parent){
    throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
  }
  this.parent
    .select("svg")
    .selectAll(`g.tidytree-node-leaf ${this._nodeGlyphSelector()}`)
    .each(function (d) {
      styler(this, d);
    });
  return this;
};

/**
 * Set the TidyTree's leaves to be equidistant
 */
TidyTree.prototype.setEquidistantLeaves = function (isEquidistant) {
  this.equidistantLeaves = isEquidistant ? true : false;

  if (this.parent) return this.redraw();
  return this;
}

/**
 * Shows or Hides the TidyTree's Leaf Labels
 * @param  {Boolean} show Should the TidyTree show leafLabels?
 * @return {TidyTree}     the TidyTree Object
 */
TidyTree.prototype.setLeafLabels = function (show) {
  this.leafLabels = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    this.parent
      .select("svg")
      .selectAll("g.tidytree-node-leaf text")
      .transition()
      .duration(this.animation)
      .style("opacity", show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Labels
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachLeafLabel = function (styler) {
  if (!this.parent){
    throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
  }
  this.parent
    .select("svg")
    .selectAll("g.tidytree-node-leaf text")
    .each(function (d) { styler(this, d); });
  return this;
};

/**
 * Shows or hides the TidyTree's branch labels
 * @param {Boolean} show Should the TidyTree show branchLabels?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setRuler = function (show) {
  this.ruler = show ? true : false;
  if (this.parent) {
    //i.e. has already been drawn
    if (show) {
      this.parent
        .select("g.tidytree-ruler")
        .transition()
        .duration(this.animation)
        .attr("opacity", 1);
    } else {
      this.parent
        .select("g.tidytree-ruler")
        .transition()
        .duration(this.animation)
        .attr("opacity", 0);
    }
  }
  return this;
};

/**
 * Set a custom formatter function for tooltip content.
 * The formatter receives the node data object and should return a string
 * to display in the tooltip. If not set, the node id is used by default.
 * @param {Function} formatter A function that takes node data and returns a string.
 * @return {TidyTree} The TidyTree object.
 */
TidyTree.prototype.setTooltipFormatter = function (formatter) {
  this.tooltipFormatter = formatter;
  return this;
};

/**
 * Collapse or expand a subtree rooted at the given node GUID.
 * If the node is already collapsed, it will be expanded; otherwise it will be collapsed.
 * @param {String} nodeGuid The GUID of the node whose subtree to collapse/expand.
 * @return {TidyTree} The TidyTree object.
 */
TidyTree.prototype.collapseNode = function (nodeGuid) {
  if (this.collapsedNodes.has(nodeGuid)) {
    this.collapsedNodes.delete(nodeGuid);
  } else {
    this.collapsedNodes.add(nodeGuid);
  }
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Check whether a node is currently collapsed.
 * @param {String} nodeGuid The GUID of the node to check.
 * @return {Boolean} True if the node is collapsed, false otherwise.
 */
TidyTree.prototype.isNodeCollapsed = function (nodeGuid) {
  return this.collapsedNodes.has(nodeGuid);
};

/**
 * Returns an array of all descendant GUIDs (including the node itself) for a given node GUID.
 * @param {String} nodeGuid The GUID of the root node.
 * @return {Array} Array of descendant GUIDs.
 */
TidyTree.prototype.getDescendantGUIDs = function (nodeGuid) {
  let result = [];
  let found = false;
  this.hierarchy.eachBefore(d => {
    if (d.data._guid === nodeGuid) {
      found = true;
    }
    if (found) {
      result.push(d.data._guid);
    }
  });
  return result;
};

/**
 * Returns a filtered copy of the hierarchy that excludes collapsed subtrees.
 * Nodes that are collapsed (and all their descendants) are removed from the
 * returned hierarchy so they are not rendered.
 * @return {Object} A filtered d3 hierarchy object.
 */
TidyTree.prototype._getFilteredHierarchy = function () {
  if (this.collapsedNodes.size === 0) {
    return this.hierarchy;
  }

  // Collect all GUIDs to exclude (collapsed nodes + their descendants)
  let excluded = new Set();
  this.collapsedNodes.forEach(guid => {
    this.getDescendantGUIDs(guid).forEach(g => excluded.add(g));
  });

  // Build a filtered hierarchy by walking the original and skipping excluded nodes
  let root = this.hierarchy;
  let filteredRoot = null;
  let nodeMap = new Map();

  // First pass: create filtered nodes for non-excluded nodes
  root.eachBefore(d => {
    if (excluded.has(d.data._guid)) return;
    let copy = {
      data: d.data,
      children: [],
      parent: null,
      depth: d.depth,
      height: d.height,
      value: d.value,
      weight: d.weight,
      x: d.x,
      y: d.y
    };
    nodeMap.set(d.data._guid, copy);
  });

  // Second pass: link parent-child relationships
  root.eachBefore(d => {
    if (excluded.has(d.data._guid)) return;
    let copy = nodeMap.get(d.data._guid);
    if (d.parent && !excluded.has(d.parent.data._guid)) {
      let parentCopy = nodeMap.get(d.parent.data._guid);
      copy.parent = parentCopy;
      parentCopy.children.push(copy);
    } else {
      // This is a new root (its parent was collapsed)
      copy.parent = null;
      if (!filteredRoot) filteredRoot = copy;
    }
  });

  // If no nodes remain, return a minimal hierarchy
  if (!filteredRoot) {
    filteredRoot = { data: root.data, children: [], parent: null, depth: 0, height: 0, value: 0, weight: 0, x: 0, y: 0 };
  }

  // Convert to d3 hierarchy
  return d3.hierarchy(filteredRoot, d => d.children);
};

/**
 * Add or update an annotation (metadata) for a specific node.
 * @param {String} nodeGuid The GUID of the node to annotate.
 * @param {Object} data The annotation data to store.
 * @return {TidyTree} The TidyTree object.
 */
TidyTree.prototype.addAnnotation = function (nodeGuid, data) {
  this.annotations.set(nodeGuid, data);
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Retrieve the annotation data for a specific node.
 * @param {String} nodeGuid The GUID of the node.
 * @return {Object|undefined} The annotation data, or undefined if none exists.
 */
TidyTree.prototype.getAnnotation = function (nodeGuid) {
  return this.annotations.get(nodeGuid);
};

/**
 * Remove the annotation for a specific node.
 * @param {String} nodeGuid The GUID of the node.
 * @return {TidyTree} The TidyTree object.
 */
TidyTree.prototype.removeAnnotation = function (nodeGuid) {
  this.annotations.delete(nodeGuid);
  if (this.parent) return this.redraw();
  return this;
};

/**
 * Retrieves the GUIDs of the nodes in the TidyTree instance.
 *
 * @param {boolean} leavesOnly - Whether to retrieve GUIDs only for leaf nodes.
 * @param {function} predicate - A function that returns true if the node should be included
 * @return {Array} An array of GUIDs of the nodes.
 */
TidyTree.prototype.getNodeGUIDs = function (leavesOnly, predicate) {
  const glyph = this._nodeGlyphSelector();
  const selector = leavesOnly
    ? `g.tidytree-node-leaf ${glyph}`
    : `g.tidytree-node-leaf ${glyph}, g.tidytree-node-internal ${glyph}`;

  const nodes = this.parent
    .select("svg")
    .selectAll(selector)
    .nodes();

  let nodeGUIDs = [];
  for (const node of nodes) {
    if (!predicate || predicate(node)) {
      nodeGUIDs.push({ _guid: node.__data__.data._guid, id: node.__data__.data.id });
    }
  }

  return nodeGUIDs;
}

/**
 * Searches the tree, returns Search Results
 * @param  {Function} test A function which takes a Branch and returns a Truthy
 * or Falsy value.
 * @return {Array} The array of results
 */
TidyTree.prototype.search = function (test) {
  if (!test) return;
  let results = this.parent
    .select("svg g.tidytree-nodes")
    .selectAll("g.tidytree-node")
    .filter(test);
  if (this.events.search.length) this.events.search.forEach(c => c(results));
  return results;
};

/**
 * Attaches a new event listener
 * Please note that this is not yet functioning.
 * @param  {String}   events   A space-delimited list of event names
 * @param  {Function} callback The function to run when one of the `events` occurs.
 * @return {TidyTree} The TidyTree on which this method was called.
 */
TidyTree.prototype.on = function (events, callback) {
  events.split(" ").forEach(event => this.events[event].push(callback));
  return this;
};

/**
 * Removes all event listeners from the given events
 * @param  {String}   events   A space-delimited list of event names
 * @return {TidyTree} The TidyTree on which this method was called.
 */
TidyTree.prototype.off = function (events) {
  events.split(" ").forEach(event => (this.events[event] = []));
  return this;
};

/**
 * Forces the tree to respond as though an `event` has occurred
 * @param  {String} events space-delimited list of names of events to trigger.
 * @param  {Spread} args Any arguments which should be passed to the event
 * handler(s).
 * @return The output of the callback run on `event`
 */
TidyTree.prototype.trigger = function (events, ...args) {
  return events.split(" ").map(event => {
    if (this.events[event].length)
      return this.events[event].map(handler => handler(args));
    return [];
  });
};

/**
 * Destroys the TidyTree
 * @return {undefined}
 */
TidyTree.prototype.destroy = function () {
  if (this.parent) {
    //i.e. has already been drawn
    this.parent.html(null);
  }
  delete this; //Go to work, GC!
};
