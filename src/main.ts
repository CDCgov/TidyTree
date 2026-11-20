import * as d3 from "d3";
import * as patristic from "patristic";
import interpolatePath from "./interpolatePath";
import { circularPoint, chordLinkLabel, elbowLinkLabel, smoothLinkLabel, smoothRadialLinkLabel, isLeftHalf } from "./linkLabels";

// Type definitions
type Layout = "horizontal" | "vertical" | "circular" | "radial" | "unrooted";
type TreeType = "tree" | "weighted" | "dendrogram";
type Mode = "smooth" | "square" | "straight";
type NodeColorMode = "none" | "predicate" | "heatmap" | "gradient";
type BranchColorMode = "none" | "predicate" | "monophyletic" | "heatmap" | "gradient";
type NodeShape = "circle" | "square" | "diamond";

interface ColorOptions {
  nodeColorMode: NodeColorMode;
  branchColorMode?: BranchColorMode;
  defaultNodeColor?: string;
  defaultBranchColor?: string;
  highlightColor?: string;
  predicate?: (node: Element) => boolean;
  leavesOnly?: boolean;
  nodeList?: Array<{ _guid: string; id: string }>;
  heatmapStart?: string;
  heatmapEnd?: string;
}

interface TidyTreeEvents {
  draw: Array<(...args: any[]) => void>;
  showtooltip: Array<(...args: any[]) => void>;
  hidetooltip: Array<(...args: any[]) => void>;
  contextmenu: Array<(...args: any[]) => void>;
  search: Array<(...args: any[]) => void>;
  select: Array<(...args: any[]) => void>;
}

interface TemporalAnnotation {
  guid: string;
  start: number;
  end: number;
  label?: string;
  color?: string;
}

interface TidyTreeOptions {
  parent?: d3.Selection<any, any, any, any>;
  layout?: Layout;
  type?: TreeType;
  mode?: Mode;
  colorOptions?: ColorOptions;
  leafNodes?: boolean;
  leafLabels?: boolean;
  equidistantLeaves?: boolean;
  branchNodes?: boolean;
  branchLabels?: boolean;
  branchDistances?: boolean;
  hStretch?: number;
  vStretch?: number;
  rotation?: number;
  ruler?: boolean;
  interactive?: boolean;
  animation?: number;
  margin?: [number, number, number, number];
  nodeSize?: number;
  nodeLabelSize?: number;
  branchLabelSize?: number;
  branchWidth?: number;
  fontFamily?: string;
  nodeShape?: NodeShape;
  tooltipFormatter?: (data: any) => string;
  events?: Partial<TidyTreeEvents>;
  virtualize?: boolean;
  virtualizationThreshold?: number;
  temporalAnnotations?: TemporalAnnotation[];
  showTemporalAnnotations?: boolean;
}

interface NodeDatum {
  _guid: string;
  id: string;
  length?: number;
  value?: number;
  weight?: number;
  children?: NodeDatum[];
  [key: string]: any;
}

interface LinkDatum {
  source: d3.HierarchyNode<NodeDatum>;
  target: d3.HierarchyNode<NodeDatum>;
}

// Earlier builds bundled patristic's UMD build, which defined a global
// `patristic`. Keep providing it for pages that relied on that.
if (typeof globalThis !== "undefined" && !(globalThis as any).patristic) {
  (globalThis as any).patristic = patristic;
}

export default class TidyTree {
  static patristic = patristic;

  static defaults: TidyTreeOptions = {
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
    nodeShape: "circle",
    virtualize: false,
    virtualizationThreshold: 1000
  };

  static validLayouts: Layout[] = ["horizontal", "vertical", "circular", "radial", "unrooted"];

  static validTypes: TreeType[] = ["tree", "weighted", "dendrogram"];

  static validModes: Mode[] = ["smooth", "square", "straight"];

  static validNodeColorModes: NodeColorMode[] = ["none", "predicate", "heatmap", "gradient"];

  static validBranchColorModes: BranchColorMode[] = ["none", "predicate", "monophyletic", "heatmap", "gradient"];

  static validNodeShapes: NodeShape[] = ["circle", "square", "diamond"];

  // Instance properties
  parent?: d3.Selection<any, any, any, any>;
  layout: Layout = "vertical";
  type: TreeType = "tree";
  mode: Mode = "smooth";
  colorOptions: ColorOptions = { nodeColorMode: "none" };
  leafNodes: boolean = true;
  leafLabels: boolean = false;
  equidistantLeaves: boolean = false;
  branchNodes: boolean = false;
  branchLabels: boolean = false;
  branchDistances: boolean = false;
  hStretch: number = 1;
  vStretch: number = 1;
  rotation: number = 0;
  ruler: boolean = true;
  interactive: boolean = true;
  animation: number = 500;
  margin: [number, number, number, number] = [50, 50, 50, 50];
  nodeSize: number = 3;
  nodeLabelSize: number = 12;
  branchLabelSize: number = 10;
  branchWidth: number = 2;
  fontFamily: string = "'Inter', sans-serif";
  nodeShape: NodeShape = "circle";
  virtualize: boolean = false;
  virtualizationThreshold: number = 1000;

  data?: patristic.Branch;
  hierarchy?: d3.HierarchyNode<NodeDatum>;
  range: [number, number] = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  width: number = 0;
  height: number = 0;
  scalar: number = 0;
  transform: d3.ZoomTransform = d3.zoomIdentity;
  zoom?: d3.ZoomBehavior<any, any>;
  tooltipFormatter?: (data: any) => string;

  /** True once destroy() has been called; queued redraws are skipped. */
  _destroyed: boolean = false;
  /** Pending requestAnimationFrame ids for queued redraws. */
  _pendingFrames: Set<number> = new Set();

  collapsedNodes: Set<string> = new Set();
  annotations: Map<string, any> = new Map();
  temporalAnnotations: Map<string, TemporalAnnotation> = new Map();
  showTemporalAnnotations: boolean = true;

  events: TidyTreeEvents = {
    draw: [],
    showtooltip: [],
    hidetooltip: [],
    contextmenu: [],
    search: [],
    select: []
  };

  /**
   * This class function creates a TidyTree object.
   * @param data A valid newick string or patristic.Branch object
   * @param options A Javascript object containing options to set up the tree
   * @param events Event handlers
   */
  constructor(data: string | patristic.Branch, options?: TidyTreeOptions, events?: TidyTreeEvents) {
    const defaults = Object.assign({}, TidyTree.defaults, {
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

    // Handle parent: convert string selector to d3 Selection before assignment
    const parentValue = options.parent;
    if (typeof parentValue === 'string') {
      options.parent = d3.select(parentValue);
    }

    Object.assign(this, defaults, options);

    if (events) {
      Object.keys(events).forEach(e => {
        const key = e as keyof TidyTreeEvents;
        const value = events[key];
        if (Array.isArray(value)) {
          this.events[key].push(...value);
        } else if (typeof value === 'function') {
          this.events[key].push(value);
        }
      });
    }

    // Track collapsed node GUIDs for subtree collapse/expand
    this.collapsedNodes = new Set();

    // Track annotations (metadata) per node GUID
    this.annotations = new Map();

    // Track temporal annotations per node GUID
    this.temporalAnnotations = new Map();
    if (options.temporalAnnotations) {
      options.temporalAnnotations.forEach(ta => {
        this.temporalAnnotations.set(ta.guid, ta);
      });
    }
    this.showTemporalAnnotations = options.showTemporalAnnotations ?? true;

    if (this.parent) this.draw(this.parent);

    if (typeof data === "string") {
      this.setTree(data);
    } else {
      this.setData(data);
    }

    if (this.parent) this.recenter();
  }

  /**
   * Update the TidyTree's underlying data structure
   * There are two contexts in which you should call this:
   * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
   * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
   * @param data A patristic.Branch object
   * @return the TidyTree object
   */
  setData(data: patristic.Branch): TidyTree {
    if (!data) throw Error("Invalid Data");
    this.data = data;
    this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    this.hierarchy = d3
      .hierarchy(this.data as any, (d: any) => d.children)
      .eachBefore((d: any) => {
        d.value =
          (d.parent ? d.parent.value : 0) + (d.data.length ? Math.abs(d.data.length) : 0);
        if (d.value < this.range[0]) this.range[0] = d.value;
        if (d.value > this.range[1]) this.range[1] = d.value;
      })
      .each((d: any) => (d.value /= this.range[1]));
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Update the TidyTree's underlying data structure
   * There are two contexts in which you should call this:
   * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
   * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
   * @param newick A valid newick string
   * @return the TidyTree object
   */
  setTree(newick: string): TidyTree {
    if (!newick) throw Error("Invalid Newick String");
    return this.setData(patristic.parseNewick(newick));
  }

  /**
   * Returns the CSS selector for the node glyph element based on the current nodeShape.
   * @return The selector string ("circle", "rect", or "polygon").
   */
  _nodeGlyphSelector(): string {
    const shape = this.nodeShape || "circle";
    return shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";
  }

  /**
   * Private method to calculate how much vertical space to leave for the ruler
   */
  _rulerOffset(): number {
    return this.ruler &&
      this.layout === "horizontal" &&
      (this.type === 'weighted' || this.type === 'tree')
      ? 25 : 0;
  }

  /**
   * Draws a Phylogenetic on the element referred to by selector
   * @param selector A CSS selector
   * @return the TidyTree object
   */
  draw(selector: string | d3.Selection<any, any, any, any>): TidyTree {
    if (!selector && !this.parent) {
      throw Error("No valid target for drawing given! Where should the tree go?");
    }
    let parent: d3.Selection<any, any, any, any>;
    if (typeof selector === 'string') {
      parent = d3.select(selector);
      if (parent.empty()) {
        throw Error(`Invalid selector: ${selector}`);
      }
      this.parent = parent;
    } else {
      parent = selector;
      this.parent = selector;
    }

    this.width =
      parseFloat(parent.style("width")) - this.margin[1] - this.margin[3];
    this.height =
      parseFloat(parent.style("height")) - this.margin[0] - this.margin[2] - this._rulerOffset();

    const treeLayout = d3.tree();

    const svg = parent
      .html(null)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");

    const g = svg.append("g");

    svg
      .append("g")
      .attr("class", "tidytree-ruler")
      .append("rect")
      .attr("y", -5)
      .attr("fill", "white");

    this.zoom = d3.zoom().on("zoom", (e: d3.D3ZoomEvent<any, any>) => {
      const transform = e.transform;
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

      // When virtualization is active, re-render on zoom to show/hide nodes based on viewport
      if (this.virtualize) {
        this.redraw();
      }
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
  }

  /**
   * Set the TidyTree's layout
   * @param newLayout The new layout
   * @return The TidyTree Object
   */
  setLayout(newLayout: Layout): TidyTree {
    if (!TidyTree.validLayouts.includes(newLayout)) {
      throw Error(`
        Cannot set TidyTree to layout: ${newLayout}\n
        Valid layouts are: ${TidyTree.validLayouts.join(', ')}
      `);
    }
    this.layout = newLayout;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the TidyTree's colorOptions
   * @param newColorOptions The new colorOptions
   * @return The TidyTree Object
   */
  setColorOptions(newColorOptions: ColorOptions): TidyTree {
    if (!TidyTree.validNodeColorModes.includes(newColorOptions.nodeColorMode)) {
      throw Error(`
        Cannot set TidyTree colorOptions: ${newColorOptions.nodeColorMode}\n
        Valid nodeColorModes are: ${TidyTree.validNodeColorModes.join(', ')}
      `);
    }
    if (newColorOptions.branchColorMode && !TidyTree.validBranchColorModes.includes(newColorOptions.branchColorMode)) {
      throw Error(`
        Cannot set TidyTree colorOptions: ${newColorOptions.branchColorMode}\n
        Valid branchColorModes are: ${TidyTree.validBranchColorModes.join(', ')}
      `);
    }

    if (newColorOptions.nodeColorMode === 'predicate') {
      if (!newColorOptions.predicate) {
        console.warn('Warning: colorOptions.predicate not supplied');
      }
      if (newColorOptions.leavesOnly === undefined) {
        newColorOptions.leavesOnly = false;
        console.warn('Warning: colorOptions.leavesOnly not supplied and defaulted to false');
      }
      newColorOptions.nodeList = this.getNodeGUIDs(newColorOptions.leavesOnly ?? false, newColorOptions.predicate);
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
   * @param newMode The new mode
   * @return the TidyTree object
   */
  setMode(newMode: Mode): TidyTree {
    if (!TidyTree.validModes.includes(newMode)) {
      throw Error(`
        Cannot set TidyTree to mode: ${newMode},\n
        Valid modes are: ${TidyTree.validModes.join(', ')}
      `);
    }
    this.mode = newMode;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the TidyTree's type
   * @param newType The new type
   * @return the TidyTree object
   */
  setType(newType: TreeType): TidyTree {
    if (!TidyTree.validTypes.includes(newType)) {
      throw Error(`
        Cannot set TidyTree to type: ${newType},\n
        Valid types are: ${TidyTree.validTypes.join(', ')}
      `);
    }
    this.type = newType;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the TidyTree's rotation
   * @param degrees The new number of degrees by which to rotate the tree
   * @return the TidyTree object
   */
  setRotation(degrees: number): TidyTree {
    this.rotation = degrees;
    if (this.parent && !(typeof this.parent === 'string'))
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
  }

  /**
   * Set the TidyTree's Horizontal Stretch
   * @param proportion The new proportion by which to stretch the tree
   * @return the TidyTree object
   */
  setHStretch(proportion: number): TidyTree {
    this.hStretch = parseFloat(proportion.toString());
    if (this.parent) {
      const animCache = this.animation;
      this.setAnimation(0);
      this.redraw();
      this.setAnimation(animCache);
    }
    return this;
  }

  /**
   * Set the TidyTree's Vertical Stretch
   * @param proportion The new proportion by which to stretch the tree
   * @return the TidyTree object
   */
  setVStretch(proportion: number): TidyTree {
    this.vStretch = parseFloat(proportion.toString());
    if (this.parent) {
      const animCache = this.animation;
      this.setAnimation(0);
      this.redraw();
      this.setAnimation(animCache);
    }
    return this;
  }

  /**
   * Set the TidyTree's animation time. Note that this does not trigger a
   * redraw.
   * @param time The desired duration of an animation, in ms. Set to 0
   * to turn animations off completely.
   * @return The TidyTree object
   */
  setAnimation(time: number): TidyTree {
    this.animation = time;
    return this;
  }

  /**
   * Shows or hides the Branch Nodes
   * @param show Should Branch nodes be shown?
   * @return the TidyTree object
   */
  setBranchNodes(show: boolean): TidyTree {
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
  }

  /**
   * Restyles Leaf Nodes
   * @param styler A function that restyles each node. `styler`
   * receives a reference to the DOM node to be styled, and an associated data
   * object.
   * @return the TidyTree Object
   */
  eachBranchNode(styler: (node: Element, datum: any) => void): TidyTree {
    if (!this.parent)
      throw Error(
        "Tree has not been rendered yet! Can't style Nodes that don't exist!"
      );
    this.parent
      .select("svg")
      .selectAll(`g.tidytree-node-internal ${this._nodeGlyphSelector()}`)
      .each(function (this: any, d: any) { styler(this, d); });
    return this;
  }

  /**
   * Set the TidyTree's branchLabels
   * @param show Should the TidyTree show branchLabels?
   * @return the TidyTree Object
   */
  setBranchLabels(show: boolean): TidyTree {
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
  }

  /**
   * Restyles Branch Label
   * @param styler A function that restyles each node. `styler`
   * receives a reference to the DOM node to be styled, and an associated data
   * object.
   * @return the TidyTree Object
   */
  eachBranchLabel(styler: (node: Element, datum: any) => void): TidyTree {
    if (!this.parent){
      throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
    }
    this.parent
      .select("svg")
      .selectAll("g.tidytree-node-internal text")
      .each(function (this: any, d: any) { styler(this, d); });
    return this;
  }

  /**
   * Shows or hides the TidyTree's branch labels
   * @param show Should the TidyTree show branch distances?
   * @return The TidyTree Object
   */
  setBranchDistances(show: boolean): TidyTree {
    this.branchDistances = show ? true : false;
    if (this.parent) {
      //i.e. has already been drawn
      const links = this.parent
        .select("svg g.tidytree-links")
        .selectAll("g.tidytree-link")
        .selectAll("text");
      links.attr("transform", (d: any) => labelTransformers[this.type][this.mode][this.layout](d));
      links
        .transition()
        .duration(this.animation)
        .style("opacity", show ? 1 : 0);
    }
    return this;
  }

  /**
   * Restyles Branch Distances
   * @param styler A function that restyles each node. `styler`
   * receives a reference to the DOM node to be styled, and an associated data
   * object.
   * @return the TidyTree Object
   */
  eachBranchDistance(styler: (node: Element, datum: any) => void): TidyTree {
    if (!this.parent)
      throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
    this.parent
      .select("svg g.tidytree-links")
      .selectAll("g.tidytree-link")
      .selectAll("text")
      .each(function (this: any, d: any) { styler(this, d); });
    return this;
  }

  /**
   * Shows or Hides the Leaf Nodes
   * @param show Should leaf nodes be visible?
   * @return The TidyTree Object
   */
  setLeafNodes(show: boolean): TidyTree {
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
  }

  /**
   * Restyles Leaf Nodes
   * @param styler A function that restyles each node. `styler`
   * receives a reference to the DOM node to be styled, and an associated data
   * object.
   * @return the TidyTree Object
   */
  eachLeafNode(styler: (node: Element, datum: any) => void): TidyTree {
    if (!this.parent){
      throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
    }
    this.parent
      .select("svg")
      .selectAll(`g.tidytree-node-leaf ${this._nodeGlyphSelector()}`)
      .each(function (this: any, d: any) {
        styler(this, d);
      });
    return this;
  }

  /**
   * Set the TidyTree's leaves to be equidistant
   */
  setEquidistantLeaves(isEquidistant: boolean): TidyTree {
    this.equidistantLeaves = isEquidistant ? true : false;

    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Shows or Hides the TidyTree's Leaf Labels
   * @param show Should the TidyTree show leafLabels?
   * @return the TidyTree Object
   */
  setLeafLabels(show: boolean): TidyTree {
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
  }

  /**
   * Restyles Leaf Labels
   * @param styler A function that restyles each node. `styler`
   * receives a reference to the DOM node to be styled, and an associated data
   * object.
   * @return the TidyTree Object
   */
  eachLeafLabel(styler: (node: Element, datum: any) => void): TidyTree {
    if (!this.parent){
      throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
    }
    this.parent
      .select("svg")
      .selectAll("g.tidytree-node-leaf text")
      .each(function (this: any, d: any) { styler(this, d); });
    return this;
  }

  /**
   * Shows or hides the TidyTree's branch labels
   * @param show Should the TidyTree show branchLabels?
   * @return The TidyTree Object
   */
  setRuler(show: boolean): TidyTree {
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
  }

  /**
   * Set a custom formatter function for tooltip content.
   * The formatter receives the node data object and should return a string
   * to display in the tooltip. If not set, the node id is used by default.
   * The result is passed to `showtooltip` handlers as the third element of
   * their argument. It may contain text from the Newick input, so handlers
   * should render it as plain text (e.g. `selection.text()` or
   * `textContent`), not as HTML.
   * @param formatter A function that takes node data and returns a string.
   * @return The TidyTree object.
   */
  setTooltipFormatter(formatter: (data: any) => string): TidyTree {
    this.tooltipFormatter = formatter;
    return this;
  }

  /**
   * Collapse or expand a subtree rooted at the given node GUID.
   * If the node is already collapsed, it will be expanded; otherwise it will be collapsed.
   * @param nodeGuid The GUID of the node whose subtree to collapse/expand.
   * @return The TidyTree object.
   */
  collapseNode(nodeGuid: string): TidyTree {
    if (this.collapsedNodes.has(nodeGuid)) {
      this.collapsedNodes.delete(nodeGuid);
    } else {
      this.collapsedNodes.add(nodeGuid);
    }
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Check whether a node is currently collapsed.
   * @param nodeGuid The GUID of the node to check.
   * @return True if the node is collapsed, false otherwise.
   */
  isNodeCollapsed(nodeGuid: string): boolean {
    return this.collapsedNodes.has(nodeGuid);
  }

  /**
   * Returns an array of all descendant GUIDs (including the node itself) for a given node GUID.
   * @param nodeGuid The GUID of the root node.
   * @return Array of descendant GUIDs.
   */
  getDescendantGUIDs(nodeGuid: string): string[] {
    const result: string[] = [];
    let found = false;
    this.hierarchy?.eachBefore((d: any) => {
      if (d.data._guid === nodeGuid) {
        found = true;
      }
      if (found) {
        result.push(d.data._guid);
      }
    });
    return result;
  }

  /**
   * Returns a filtered copy of the hierarchy that excludes collapsed subtrees.
   * Nodes that are collapsed (and all their descendants) are removed from the
   * returned hierarchy so they are not rendered.
   * @return A filtered d3 hierarchy object.
   */
  _getFilteredHierarchy(): d3.HierarchyNode<NodeDatum> {
    if (this.collapsedNodes.size === 0) {
      return this.hierarchy!;
    }

    // Collect all GUIDs to exclude (collapsed nodes + their descendants)
    const excluded = new Set<string>();
    this.collapsedNodes.forEach(guid => {
      this.getDescendantGUIDs(guid).forEach(g => excluded.add(g));
    });

    // Build a filtered hierarchy by walking the original and skipping excluded nodes
    const root = this.hierarchy!;
    let filteredRoot: any = null;
    const nodeMap = new Map<string, any>();

    // First pass: create filtered nodes for non-excluded nodes
    root.eachBefore((d: any) => {
      if (excluded.has(d.data._guid)) return;
      const copy = {
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
    root.eachBefore((d: any) => {
      if (excluded.has(d.data._guid)) return;
      const copy = nodeMap.get(d.data._guid);
      if (d.parent && !excluded.has(d.parent.data._guid)) {
        const parentCopy = nodeMap.get(d.parent.data._guid);
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
    return d3.hierarchy(filteredRoot, (d: any) => d.children);
  }

  /**
   * Returns a filtered hierarchy containing only nodes within the visible viewport.
   * Used for virtualization of large trees (1000+ nodes).
   * @param hierarchy The full filtered hierarchy
   * @return A d3 hierarchy with only visible nodes
   */
  _getVisibleHierarchy(hierarchy: d3.HierarchyNode<NodeDatum>): d3.HierarchyNode<NodeDatum> {
    const width = this.width;
    const height = this.height;
    const margin = this.margin;

    // Compute the visible bounds based on current zoom transform
    const k = this.transform.k;
    const x = -this.transform.x / k;
    const y = -this.transform.y / k;
    const viewWidth = width / k;
    const viewHeight = height / k;

    // Collect visible node GUIDs
    const visibleGuids = new Set<string>();
    const visibleNodes: any[] = [];

    hierarchy.eachBefore((d: any) => {
      const nodeX = d.x;
      const nodeY = d.y;
      // Check if node is within the visible viewport (with some padding)
      const padding = 50;
      if (
        nodeX >= x - padding &&
        nodeX <= x + viewWidth + padding &&
        nodeY >= y - padding &&
        nodeY <= y + viewHeight + padding
      ) {
        visibleGuids.add(d.data._guid);
        visibleNodes.push(d);
      }
    });

    // Always include root and ancestors of visible nodes so the tree structure is preserved
    const ancestorsGuids = new Set<string>();
    visibleNodes.forEach(d => {
      let ancestor = d.parent;
      while (ancestor) {
        ancestorsGuids.add(ancestor.data._guid);
        ancestor = ancestor.parent;
      }
    });

    // Build a new hierarchy with only visible nodes + their ancestors
    const root = hierarchy;
    let visibleRoot: any = null;
    const nodeMap = new Map<string, any>();

    // First pass: create copies for visible nodes and their ancestors
    root.eachBefore((d: any) => {
      if (!visibleGuids.has(d.data._guid) && !ancestorsGuids.has(d.data._guid)) return;
      const copy = {
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
    root.eachBefore((d: any) => {
      if (!visibleGuids.has(d.data._guid) && !ancestorsGuids.has(d.data._guid)) return;
      const copy = nodeMap.get(d.data._guid);
      if (d.parent && (visibleGuids.has(d.parent.data._guid) || ancestorsGuids.has(d.parent.data._guid))) {
        const parentCopy = nodeMap.get(d.parent.data._guid);
        copy.parent = parentCopy;
        parentCopy.children.push(copy);
      } else {
        copy.parent = null;
        if (!visibleRoot) visibleRoot = copy;
      }
    });

    // If no nodes remain, return a minimal hierarchy
    if (!visibleRoot) {
      visibleRoot = { data: root.data, children: [], parent: null, depth: 0, height: 0, value: 0, weight: 0, x: 0, y: 0 };
    }

    // Convert to d3 hierarchy
    return d3.hierarchy(visibleRoot, (d: any) => d.children);
  }

  /**
   * Add or update an annotation (metadata) for a specific node.
   * @param nodeGuid The GUID of the node to annotate.
   * @param data The annotation data to store.
   * @return The TidyTree object.
   */
  addAnnotation(nodeGuid: string, data: any): TidyTree {
    this.annotations.set(nodeGuid, data);
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Retrieve the annotation data for a specific node.
   * @param nodeGuid The GUID of the node.
   * @return The annotation data, or undefined if none exists.
   */
  getAnnotation(nodeGuid: string): any | undefined {
    return this.annotations.get(nodeGuid);
  }

  /**
   * Remove the annotation for a specific node.
   * @param nodeGuid The GUID of the node.
   * @return The TidyTree object.
   */
  removeAnnotation(nodeGuid: string): TidyTree {
    this.annotations.delete(nodeGuid);
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Add or update a temporal annotation for a specific node.
   * Temporal annotations render as colored bars overlaid on branches to
   * represent time intervals (e.g., divergence dates, sampling dates).
   * @param guid The GUID of the node to annotate.
   * @param start Start time value.
   * @param end End time value.
   * @param label Optional label to display.
   * @param color Optional color for the temporal bar.
   * @return The TidyTree object.
   */
  addTemporalAnnotation(guid: string, start: number, end: number, label?: string, color?: string): TidyTree {
    this.temporalAnnotations.set(guid, { guid, start, end, label, color });
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Retrieve the temporal annotation for a specific node.
   * @param guid The GUID of the node.
   * @return The temporal annotation data, or undefined if none exists.
   */
  getTemporalAnnotation(guid: string): TemporalAnnotation | undefined {
    return this.temporalAnnotations.get(guid);
  }

  /**
   * Remove the temporal annotation for a specific node.
   * @param guid The GUID of the node.
   * @return The TidyTree object.
   */
  removeTemporalAnnotation(guid: string): TidyTree {
    this.temporalAnnotations.delete(guid);
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set whether temporal annotations are visible.
   * @param show Whether to show temporal annotations.
   * @return The TidyTree object.
   */
  setShowTemporalAnnotations(show: boolean): TidyTree {
    this.showTemporalAnnotations = show;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Retrieves the GUIDs of the nodes in the TidyTree instance.
   *
   * @param leavesOnly - Whether to retrieve GUIDs only for leaf nodes.
   * @param predicate - A function that returns true if the node should be included
   * @return An array of GUIDs of the nodes.
   */
  getNodeGUIDs(leavesOnly: boolean, predicate?: (node: Element) => boolean): Array<{ _guid: string; id: string }> {
    const glyph = this._nodeGlyphSelector();
    const selector = leavesOnly
      ? `g.tidytree-node-leaf ${glyph}`
      : `g.tidytree-node-leaf ${glyph}, g.tidytree-node-internal ${glyph}`;

    const nodes = this.parent!
      .select("svg")
      .selectAll(selector)
      .nodes();

    const nodeGUIDs: Array<{ _guid: string; id: string }> = [];
    for (const node of nodes) {
      if (!predicate || predicate(node as Element)) {
        const datum = (node as any).__data__;
        nodeGUIDs.push({ _guid: datum.data._guid, id: datum.data.id });
      }
    }

    return nodeGUIDs;
  }

  /**
   * Searches the tree, returns Search Results
   * @param test A function which takes a Branch and returns a Truthy
   * or Falsy value.
   * @return The array of results
   */
  search(test: (d: any) => boolean): d3.Selection<any, any, any, any> | undefined {
    if (!test) return undefined;
    const results = this.parent!
      .select("svg g.tidytree-nodes")
      .selectAll("g.tidytree-node")
      .filter(test);
    if (this.events.search.length) this.events.search.forEach(c => c(results));
    return results;
  }

  /**
   * Attaches a new event listener
   * Please note that this is not yet functioning.
   * @param events A space-delimited list of event names
   * @param callback The function to run when one of the `events` occurs.
   * @return The TidyTree on which this method was called.
   */
  on(events: string, callback: (...args: any[]) => void): TidyTree {
    events.split(" ").forEach(event => this.events[event as keyof TidyTreeEvents].push(callback as any));
    return this;
  }

  /**
   * Removes all event listeners from the given events
   * @param events A space-delimited list of event names
   * @return The TidyTree on which this method was called.
   */
  off(events: string): TidyTree {
    events.split(" ").forEach(event => (this.events[event as keyof TidyTreeEvents] = []));
    return this;
  }

  /**
   * Forces the tree to respond as though an `event` has occurred
   * @param events space-delimited list of names of events to trigger.
   * @param args Any arguments which should be passed to the event
   * handler(s).
   * @return The output of the callback run on `event`
   */
  trigger(events: string, ...args: any[]): any[] {
    return events.split(" ").map(event => {
      if (this.events[event as keyof TidyTreeEvents].length)
        return this.events[event as keyof TidyTreeEvents].map(handler => handler(args));
      return [];
    });
  }

  /**
   * Destroys the TidyTree
   * @return undefined
   */
  destroy(): void {
    this._destroyed = true;
    // Cancel any redraw still waiting for its animation frame, so it can't touch
    // removed elements (or a new tree drawn into the same parent).
    if (typeof cancelAnimationFrame === "function") {
      this._pendingFrames.forEach(id => cancelAnimationFrame(id));
    }
    this._pendingFrames.clear();
    if (this.parent) {
      //i.e. has already been drawn
      this.parent.html(null);
    }
  }

  /**
   * Wraps a d3 selection transition with requestAnimationFrame for smoother rendering.
   * If animation is 0, applies attributes immediately without animation.
   * @param selection - The d3 selection to transition.
   * @param attrs - Object of attribute/style key-value pairs to apply.
   * @param applyFn - Optional function to apply custom transition logic.
   * @return The transition or selection.
   */
  _transition(
    selection: d3.Selection<any, any, any, any>,
    attrs?: Record<string, string | number>,
    applyFn?: (transition: d3.Transition<any, any, any, any>) => void
  ): d3.Selection<any, any, any, any> | d3.Transition<any, any, any, any> {
    if (!this.animation || this.animation <= 0) {
      if (applyFn) applyFn(selection as any);
      else if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
          if (key.startsWith("style:")) {
            selection.style(key.slice(6), String(value));
          } else {
            selection.attr(key, value);
          }
        });
      }
      return selection;
    }
    const transition = selection.transition().duration(this.animation);
    if (applyFn) applyFn(transition);
    else if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (key.startsWith("style:")) {
          transition.style(key.slice(6), String(value));
        } else {
          transition.attr(key, value);
        }
      });
    }
    return transition;
  }

  /**
   * Redraws the links and relocates the nodes accordingly
   * @return The TidyTree Object
   */
  redraw(): TidyTree {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- d3 .each(function) callbacks below rebind `this` to the DOM element
    const tree = this;
    if (tree._destroyed) return tree;
    // Wrap the redraw in requestAnimationFrame for smoother rendering
    const frame: number = requestAnimationFrame(() => {
      tree._pendingFrames.delete(frame);
      // destroy() may have run after this frame was queued
      if (tree._destroyed || !tree.parent) return;
      const parent = tree.parent;

      tree.width  = (parseFloat(parent.style("width")) - tree.margin[1] - tree.margin[3]) * tree.hStretch;
      tree.height = (parseFloat(parent.style("height")) - tree.margin[0] - tree.margin[2] - tree._rulerOffset()) * tree.vStretch;

      tree.scalar =
        tree.layout === "horizontal" ? tree.width :
        tree.layout === "vertical" ? tree.height :
        Math.min(tree.width, tree.height) / 2;

      tree.hierarchy?.each((d: any) => (d.weight = tree.scalar * d.value));

      // Build a filtered hierarchy that excludes collapsed subtrees
      const filteredHierarchy = tree._getFilteredHierarchy();

      // --- Virtualization: only render visible nodes for large trees ---
      let visibleHierarchy = filteredHierarchy;
      if (tree.virtualize && filteredHierarchy.descendants().length > tree.virtualizationThreshold) {
        visibleHierarchy = tree._getVisibleHierarchy(filteredHierarchy);
      }

      const g = parent.select("svg g");

      const source = (tree.type === "tree" ? d3.tree() : d3.cluster()).size(
        tree.layout === "circular"   ? [2 * Math.PI, Math.min(tree.height, tree.width) / 2] :
        tree.layout === "radial"     ? [2 * Math.PI, Math.min(tree.height, tree.width) / 2] :
        tree.layout === "unrooted"   ? [tree.width, tree.height] :
        tree.layout === "horizontal" ? [tree.height, tree.width] :
        [tree.width, tree.height]
      );

      if (tree.equidistantLeaves) {
        if (tree.layout === "circular" || tree.layout === "radial") {
          source.separation((a: any, b: any) => 1 / a.depth);
        } else {
          source.separation((a: any, b: any) => 1);
        }
      } else {
        if (tree.layout === "circular" || tree.layout === "radial")
          source.separation((a: any, b: any) => (a.parent === b.parent ? 1 : 2) / a.depth);
      }
      
      //Note: You must render links prior to nodes in order to get correct placement!
      const links = (g as any)
        .select("g.tidytree-links")
        .selectAll("g.tidytree-link")
        .data((source as any)(visibleHierarchy).links(), (l: any) => (l as any).source.data._guid + ':' + (l as any).target.data._guid);

      links.join(
        (enter: d3.Selection<any, any, any, any>) => {
          const newLinks = enter.append("g").attr("class", "tidytree-link");

          const linkTransformer = linkTransformers[tree.type][tree.mode][tree.layout];
          newLinks
            .append("path")
            .attr("fill", "none")
            .attr("stroke", (d: any) => findBranchColor(d, tree.colorOptions))
            .attr("d", linkTransformer)
            .transition()
            .duration(tree.animation)
            .attr("opacity", 1);

          const labelTransformer = labelTransformers[tree.type][tree.mode][tree.layout];
          newLinks
            .append("text")
            .attr("y", 2)
            .attr("text-anchor", "middle")
            .style("font-size", tree.branchLabelSize + "px")
            .text(labeler)
            .attr("transform", (d: any) => labelTransformer(d))
            .transition()
            .duration(tree.animation)
            .style("opacity", tree.branchDistances ? 1 : 0);
        },
        (update: d3.Selection<any, any, any, any>) => {
          // Progressive transition: update attributes smoothly without fading out
          const linkTransformer = linkTransformers[tree.type][tree.mode][tree.layout];
          const paths = update.select("path");
          if (!(tree.animation > 0)) {
            paths
              .attr("d", linkTransformer)
              .attr("stroke", (d: any) => findBranchColor(d, tree.colorOptions))
              .attr("opacity", 1);
          } else {
            // Transition d (path), stroke, and opacity simultaneously over full animation duration
            paths
              .transition()
              .duration(tree.animation)
              // Not attr("d", …): d3's string interpolation would tween arc
              // flags through invalid fractional values (see #80).
              .attrTween("d", function (this: any, d: any) {
                return interpolatePath(this.getAttribute("d") || "", linkTransformer(d));
              })
              .attr("stroke", (d: any) => findBranchColor(d, tree.colorOptions))
              .attr("opacity", 1);
          }

          const labelTransformer =
            labelTransformers[tree.type][tree.mode][tree.layout];
          const labels = update.select("text");
          if (tree.animation) {
            // One transition for transform, opacity and text: a second unnamed
            // transition on the same element would interrupt this one (see #83).
            labels
              .transition()
              .duration(tree.animation)
              .attr("transform", (d: any) => labelTransformer(d))
              .style("opacity", tree.branchDistances ? 1 : 0)
              .text(labeler);
          } else {
            labels.text(labeler).attr("transform", (d: any) => labelTransformer(d));
            labels.style("opacity", tree.branchDistances ? 1 : 0);
          }
        },
        (exit: d3.Selection<any, any, any, any>) =>
          exit
            .transition()
            .duration(tree.animation)
            .remove()
      );

      const nodes = (g as any)
        .select("g.tidytree-nodes")
        .selectAll("g.tidytree-node")
        .data(visibleHierarchy.descendants(), (d: any) => d.data._guid);
      const t = tree;
      (nodes as any).join(
        (enter: d3.Selection<any, any, any, any>) => {
          const nt = nodeTransformers[tree.type][tree.layout];
          const newNodes = enter
            .append("g")
            .attr("class", "tidytree-node")
            .classed("tidytree-node-internal", (d: any) => d.children)
            .classed("tidytree-node-leaf", (d: any) => !d.children)
            .attr("transform", (d: any) => nt(d));

          const t = tree;
          newNodes
            .each(function(this: any, d: any) {
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

              // Render temporal annotation bar
              if (t.showTemporalAnnotations) {
                const ta = t.temporalAnnotations.get(d.data._guid);
                if (ta) {
                  const barColor = ta.color || "#e67e22";
                  const bar = node.append("rect")
                    .attr("class", "tidytree-temporal-bar")
                    .attr("fill", barColor)
                    .attr("opacity", 0.8)
                    .attr("title", ta.label || `${ta.start} - ${ta.end}`);
                  if (t.layout === "horizontal" || t.layout === "unrooted") {
                    const barWidth = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", ta.start * t.scalar - barWidth / 2)
                      .attr("y", -size / 2 - 8)
                      .attr("width", barWidth)
                      .attr("height", 6);
                  } else if (t.layout === "vertical") {
                    const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", -size / 2 - 8)
                      .attr("y", ta.start * t.scalar - barHeight / 2)
                      .attr("width", 6)
                      .attr("height", barHeight);
                  } else {
                    bar
                      .attr("x", -3)
                      .attr("y", -3)
                      .attr("width", 6)
                      .attr("height", 6)
                      .attr("rx", 3)
                      .attr("ry", 3);
                  }
                }
              }
            })
            .style("opacity", (d: any) =>
              (d.children && t.branchNodes) ||
              (!d.children && t.leafNodes) ? 1 : 0
            )
            .style("fill", (d: any) => findNodeColor(d, t.colorOptions))
            .on("mouseenter focusin", (event: any, d: any) => {
              const content = t.tooltipFormatter ? t.tooltipFormatter(d.data) : d.data.id;
              t.trigger("showtooltip", d, event, content);
            })
            .on("mouseout focusout", (event: any, d: any) => t.trigger("hidetooltip", d, event))
            .on("contextmenu", (event: any, d: any) => t.trigger("contextmenu", d, event))
            .on("click", (event: any, d: any) => t.trigger("select", d, event));

          const nodeLabels = newNodes
            .append("text")
            .text((d: any) => d.data.id)
            .style("font-size", t.nodeLabelSize + "px")
            .attr("y", 2)
            .style("opacity", (d: any) =>
              ( d.children && t.branchLabels) ||
              (!d.children && t.leafLabels) ? 1 : 0
            );

          setNodeLabelPosition(nodeLabels, t.layout);

          newNodes
            .transition()
            .duration(t.animation)
            .attr("opacity", 1);
        },
        (update: d3.Selection<any, any, any, any>) => {
          // Progressive transition: update transform, fill, and label position smoothly
          const nodeTransformer = nodeTransformers[t.type][t.layout];
          const shape = t.nodeShape || "circle";
          const glyphSelector = shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";

          if (!(t.animation > 0)) {
            // No animation: directly set attributes
            update.attr("transform", (d: any) => nodeTransformer(d));
            update.select(glyphSelector)
              .style("fill", (d: any) => findNodeColor(d, t.colorOptions))
              .style("opacity", (d: any) =>
                (d.children && t.branchNodes) ||
                (!d.children && t.leafNodes) ? 1 : 0
              );
            setNodeLabelPosition(update.select("text"), t.layout);
            // Update annotation text
            update.select("text.tidytree-node-annotation")
              .text((d: any) => {
                const ann = t.annotations.get(d.data._guid);
                return ann ? JSON.stringify(ann) : "";
              })
              .style("opacity", (d: any) =>
                ( d.children && t.branchLabels) ||
                (!d.children && t.leafLabels) ? 1 : 0
              );
            setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
            // Update temporal annotation bar
            update.each(function(this: any, d: any) {
              const node = d3.select(this);
              node.select("rect.tidytree-temporal-bar").remove();
              if (t.showTemporalAnnotations) {
                const ta = t.temporalAnnotations.get(d.data._guid);
                if (ta) {
                  const barColor = ta.color || "#e67e22";
                  const bar = node.append("rect")
                    .attr("class", "tidytree-temporal-bar")
                    .attr("fill", barColor)
                    .attr("opacity", 0.8)
                    .attr("title", ta.label || `${ta.start} - ${ta.end}`);
                  if (t.layout === "horizontal" || t.layout === "unrooted") {
                    const barWidth = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", ta.start * t.scalar - barWidth / 2)
                      .attr("y", -t.nodeSize / 2 - 8)
                      .attr("width", barWidth)
                      .attr("height", 6);
                  } else if (t.layout === "vertical") {
                    const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", -t.nodeSize / 2 - 8)
                      .attr("y", ta.start * t.scalar - barHeight / 2)
                      .attr("width", 6)
                      .attr("height", barHeight);
                  } else {
                    bar
                      .attr("x", -3)
                      .attr("y", -3)
                      .attr("width", 6)
                      .attr("height", 6)
                      .attr("rx", 3)
                      .attr("ry", 3);
                  }
                }
              }
            });
          } else {
            // Animate transform and fill, ensure opacity is restored to 1
            update
              .transition()
              .duration(t.animation)
              .attr("transform", (d: any) => nodeTransformer(d))
              .attr("opacity", 1);

            const nodeGlyphs = update.select(glyphSelector);
            nodeGlyphs
              .transition()
              .duration(t.animation)
              .style("fill", (d: any) => findNodeColor(d, t.colorOptions))
              .style("opacity", (d: any) =>
                (d.children && t.branchNodes) ||
                (!d.children && t.leafNodes) ? 1 : 0
              );

            // Animate label rotation and offset alongside the node. Named so
            // it doesn't interrupt (or get interrupted by) opacity transitions
            // from setLeafLabels / setBranchLabels.
            const nodeLabels = update.select("text");
            setNodeLabelPosition(
              nodeLabels.transition("position").duration(t.animation),
              t.layout
            );
            // Update annotation text
            update.select("text.tidytree-node-annotation")
              .text((d: any) => {
                const ann = t.annotations.get(d.data._guid);
                return ann ? JSON.stringify(ann) : "";
              })
              .style("opacity", (d: any) =>
                ( d.children && t.branchLabels) ||
                (!d.children && t.leafLabels) ? 1 : 0
              );
            setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
            // Update temporal annotation bar
            update.each(function(this: any, d: any) {
              const node = d3.select(this);
              node.select("rect.tidytree-temporal-bar").remove();
              if (t.showTemporalAnnotations) {
                const ta = t.temporalAnnotations.get(d.data._guid);
                if (ta) {
                  const barColor = ta.color || "#e67e22";
                  const bar = node.append("rect")
                    .attr("class", "tidytree-temporal-bar")
                    .attr("fill", barColor)
                    .attr("opacity", 0.8)
                    .attr("title", ta.label || `${ta.start} - ${ta.end}`);
                  if (t.layout === "horizontal" || t.layout === "unrooted") {
                    const barWidth = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", ta.start * t.scalar - barWidth / 2)
                      .attr("y", -t.nodeSize / 2 - 8)
                      .attr("width", barWidth)
                      .attr("height", 6);
                  } else if (t.layout === "vertical") {
                    const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                    bar
                      .attr("x", -t.nodeSize / 2 - 8)
                      .attr("y", ta.start * t.scalar - barHeight / 2)
                      .attr("width", 6)
                      .attr("height", barHeight);
                  } else {
                    bar
                      .attr("x", -3)
                      .attr("y", -3)
                      .attr("width", 6)
                      .attr("height", 6)
                      .attr("rx", 3)
                      .attr("ry", 3);
                  }
                }
              }
            });
          }
        },
        (exit: d3.Selection<any, any, any, any>) =>
          exit
            .transition()
            .duration(t.animation)
            .remove()
      );

      // Pass current zoom transform so the ruler respects zoom level
      updateRuler.call(t, t.transform || { k: 1 });
    });
    tree._pendingFrames.add(frame);

    return this;
  }

  /**
   * Set the TidyTree's interactivity
   * @param bool Whether the tree should be interactive
   * @return The TidyTree object
   */
  setInteractive(bool: boolean): TidyTree {
    this.interactive = bool;

    const svg = this.parent!.select("svg");
    if (this.interactive) {
      svg.call(this.zoom!);
    } else {
      svg.on('.zoom', null);
    }
    
    return this;
  }

  /**
   * Set the branch node size.
   * @param size The size of branch nodes.
   * @return The TidyTree object.
   */
  setBranchNodeSize(size: number): TidyTree {
    this.nodeSize = size;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the branch label size.
   * @param size The font size for branch labels.
   * @return The TidyTree object.
   */
  setBranchLabelSize(size: number): TidyTree {
    this.branchLabelSize = size;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the branch distance size.
   * @param size The font size for branch distance labels.
   * @return The TidyTree object.
   */
  setBranchDistanceSize(size: number): TidyTree {
    this.branchLabelSize = size;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the leaf node size.
   * @param size The size of leaf nodes.
   * @return The TidyTree object.
   */
  setLeafNodeSize(size: number): TidyTree {
    this.nodeSize = size;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set the leaf label size.
   * @param size The font size for leaf labels.
   * @return The TidyTree object.
   */
  setLeafLabelSize(size: number): TidyTree {
    this.nodeLabelSize = size;
    if (this.parent) return this.redraw();
    return this;
  }

  /**
   * Set whether tooltips are enabled.
   * @param enabled Whether tooltips should be shown.
   * @return The TidyTree object.
   */
  setTooltips(enabled: boolean): TidyTree {
    // Tooltips are controlled via event listeners; this is a no-op for now
    // but kept for UI compatibility.
    return this;
  }

  /**
   * Set whether temporal annotations are visible.
   * @param show Whether to show temporal annotations.
   * @return The TidyTree object.
   */
  setShowTemporal(show: boolean): TidyTree {
    return this.setShowTemporalAnnotations(show);
  }

  /**
   * Set the background color of the tree container.
   * @param color A CSS color string.
   * @return The TidyTree object.
   */
  setBackground(color: string): TidyTree {
    if (this.parent) {
      this.parent.style("background-color", color);
    }
    return this;
  }

  /**
   * Recenters the tree in the center of the view
   * @return The TidyTree object
   */
  recenter(): TidyTree {
    const svg = this.parent!.select("svg");
    let x = this.margin[3];
    let y = this.margin[0];
    if (this.layout === "circular") {
      x += parseFloat(svg.style("width")) / 2;
      y += parseFloat(svg.style("height")) / 2;
    }
    svg
      .transition()
      .duration(this.animation)
      .call(this.zoom!.transform, d3.zoomIdentity.translate(x, y));
    return this;
  }
}

/**
 * Finds the color of a given node based on the color options provided.
 *
 * @param node - The node for which to find the color.
 * @param colorOptions - The color options object containing the color mode, leavesOnly, predicate, default color, and highlight color.
 * @return The color of the node.
 */
function findNodeColor(node: any, colorOptions: ColorOptions): string {
  if (colorOptions.nodeColorMode === "none") {
    return colorOptions.defaultNodeColor ?? "#4682B4";
  }

  if (colorOptions.nodeColorMode === "predicate") {
    const guidList = colorOptions.nodeList?.map(n => n._guid);

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
 * @param colorA - Starting hex color.
 * @param colorB - Ending hex color.
 * @param t - Interpolation factor between 0 to 1.
 * @return The interpolated hex color.
 */
function interpolateColor(colorA: string, colorB: string, t: number): string {
  t = Math.max(0, Math.min(1, t));
  const hexToRgb = (hex: string): [number, number, number] => {
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
 * @param link - The link for which to find the color.
 * @param colorOptions - The options for different link colors.
 * @return The color of the link.
 */
function findBranchColor(link: any, colorOptions: ColorOptions): string {
  if (colorOptions.branchColorMode === "none") {
    return colorOptions.defaultBranchColor ?? "#cccccc";
  }

  if (colorOptions.branchColorMode === "predicate") {
    const source = link.source;
    const childLeafNodes = getAllLeaves(source);
    const guidList = colorOptions.nodeList?.map(node => node._guid);
    
    const allChildLeafNodesInNodeList = childLeafNodes.every((child: any) =>
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
 * @param node - A node of the tree.
 * @param includeSelf - Whether to include the given node itself as a leaf node. Defaults to false.
 * @return An array of leaf nodes.
 */
function getAllLeaves(node: any, includeSelf: boolean = false): any[] {
  const leaves: any[] = [];

  if (includeSelf && node.height === 0) {
    leaves.push(node);
  } else {
    node.children?.forEach((child: any) => {
      leaves.push(...getAllLeaves(child, true));
    });
  }

  return leaves;
}

const radToDeg = 180 / Math.PI;

const getX = (d: any) => d.x;
const getY = (d: any) => d.y;
const getLength = (d: any) => d.weight;

const linkTransformers: Record<string, Record<string, Record<string, (d: any) => string>>> = {
  tree: {
    smooth: {
      horizontal: (d3
        .linkHorizontal()
        .x(getY)
        .y(getX) as any),
      vertical: (d3
        .linkVertical()
        .x(getX)
        .y(getY) as any),
      circular: (d3
        .linkRadial()
        .angle(getX)
        .radius(getY) as any),
      radial: (d3
        .linkRadial()
        .angle(getX)
        .radius(getY) as any),
      unrooted: (d3
        .linkHorizontal()
        .x(getY)
        .y(getX) as any)
    },
    straight: {
      horizontal: (d: any) =>
        `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
      vertical: (d: any) =>
        `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
      circular: (d: any) => {
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
      radial: (d: any) => {
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
      unrooted: (d: any) =>
        `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`
    },
    square: {
      horizontal: (d: any) =>
        `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
      vertical: (d: any) =>
        `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
      circular: (d: any) => {
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
      radial: (d: any) => {
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
      unrooted: (d: any) =>
        `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`
    }
  },
  weighted: {
    smooth: {
      horizontal: (d3
        .linkHorizontal()
        .x(getLength)
        .y(getX) as any),
      vertical: (d3
        .linkVertical()
        .x(getX)
        .y(getLength) as any),
      circular: (d3
        .linkRadial()
        .angle(getX)
        .radius(getLength) as any),
      radial: (d3
        .linkRadial()
        .angle(getX)
        .radius(getLength) as any),
      unrooted: (d3
        .linkHorizontal()
        .x(getLength)
        .y(getX) as any)
    },
    straight: {
      horizontal: (d: any) =>
        `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`,
      vertical: (d: any) =>
        `M${d.source.x} ${d.source.weight} L ${d.target.x} ${d.target.weight}`,
      circular: (d: any) => {
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
      radial: (d: any) => {
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
      unrooted: (d: any) =>
        `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`
    },
    square: {
      horizontal: (d: any) =>
        `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${
          d.target.weight
        }`,
      vertical: (d: any) =>
        `M${d.source.x} ${d.source.weight} H ${d.target.x} V ${
          d.target.weight
        }`,
      circular: (d: any) => {
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
      radial: (d: any) => {
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
      unrooted: (d: any) =>
        `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${
          d.target.weight
        }`
    }
  }
};

linkTransformers.dendrogram = linkTransformers.tree;

/**
 * Sets the position and rotation of node labels based on layout.
 * @param selection - The text selection to position.
 * @param layout - The current layout ("vertical", "horizontal", "circular").
 */
function setNodeLabelPosition(
  selection: d3.Selection<any, any, any, any> | d3.Transition<any, any, any, any>,
  layout: string
): void {
  const circular = layout !== "vertical" && layout !== "horizontal" && layout !== "unrooted";
  const anchor = (l: any) => (circular && isLeftHalf(l.x) ? "end" : "start");
  const x = (l: any) => (circular && isLeftHalf(l.x) ? -5 : 5);
  const transform = (l: any) =>
    layout === "vertical" ? "rotate(90)" :
    circular ? `rotate(${(((l.x / Math.PI) * 180) % 180) - 90})` :
    "rotate(0)";

  if ("duration" in selection) {
    // text-anchor can't be tweened, so flip it halfway through, when the
    // label is mid-turn, rather than snapping at the start.
    (selection as d3.Transition<any, any, any, any>)
      .attr("transform", transform)
      .attr("x", x)
      .attrTween("text-anchor", function (this: any, l: any) {
        const from = this.getAttribute("text-anchor") || "start";
        const to = anchor(l);
        return (t: number) => (t < 0.5 ? from : to);
      });
  } else {
    (selection as d3.Selection<any, any, any, any>)
      .attr("text-anchor", anchor)
      .attr("x", x)
      .attr("transform", transform);
  }
}

const nodeTransformers: Record<string, Record<string, (d: any) => string>> = {
  tree: {
    horizontal: (d: any) => `translate(${d.y}, ${d.x})`,
    vertical: (d: any) => `translate(${d.x}, ${d.y})`,
    circular: (d: any) => `translate(${circularPoint(d.x, d.y)})`,
    radial: (d: any) => `translate(${circularPoint(d.x, d.y)})`,
    unrooted: (d: any) => `translate(${d.y}, ${d.x})`
  },
  weighted: {
    horizontal: (d: any) => `translate(${d.weight}, ${d.x})`,
    vertical: (d: any) => `translate(${d.x}, ${d.weight})`,
    circular: (d: any) => `translate(${circularPoint(d.x, d.weight)})`,
    radial: (d: any) => `translate(${circularPoint(d.x, d.weight)})`,
    unrooted: (d: any) => `translate(${d.weight}, ${d.x})`
  }
};

nodeTransformers.dendrogram = nodeTransformers.tree;

const labelTransformers: Record<string, Record<string, Record<string, (l: any) => string>>> = {
  tree: {
    straight: {
      horizontal: (l: any) =>
        `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.y - l.source.y)
        ) * radToDeg})`,
      vertical: (l: any) =>
        `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.y +
          l.target.y) /
          2}) rotate(${Math.atan(
          (l.source.y - l.target.y) / (l.source.x - l.target.x)
        ) * radToDeg})`,
      circular: (l: any) => chordLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y),
      radial: (l: any) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
      unrooted: (l: any) =>
        `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.y - l.source.y)
        ) * radToDeg})`
    },
    square: {
      horizontal: (l: any) =>
        `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`,
      vertical: (l: any) =>
        `translate(${l.target.x}, ${(l.source.y + l.target.y) / 2}) rotate(90)`,
      circular: (l: any) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
      radial: (l: any) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
      unrooted: (l: any) =>
        `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`
    }
  },
  weighted: {
    straight: {
      horizontal: (l: any) =>
        `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.weight - l.source.weight)
        ) * radToDeg})`,
      vertical: (l: any) =>
        `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.weight +
          l.target.weight) /
          2}) rotate(${Math.atan(
          (l.source.weight - l.target.weight) / (l.source.x - l.target.x)
        ) * radToDeg})`,
      circular: (l: any) => chordLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight),
      radial: (l: any) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
      unrooted: (l: any) =>
        `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
          l.target.x) /
          2}) rotate(${Math.atan(
          (l.target.x - l.source.x) / (l.target.weight - l.source.weight)
        ) * radToDeg})`
    },
    square: {
      horizontal: (l: any) => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `,
      vertical: (l: any) => `
        translate(${l.target.x}, ${(l.source.weight + l.target.weight) / 2})
        rotate(90)
      `,
      circular: (l: any) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
      radial: (l: any) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
      unrooted: (l: any) => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `
    }
  }
};

// Smooth links are Bézier curves (d3.linkHorizontal / linkVertical /
// linkRadial), so their labels follow the curve rather than the chord.
labelTransformers.tree.smooth = {
  horizontal: (l: any) => smoothLinkLabel(l.source.y, l.source.x, l.target.y, l.target.x, true),
  vertical: (l: any) => smoothLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y, false),
  unrooted: (l: any) => smoothLinkLabel(l.source.y, l.source.x, l.target.y, l.target.x, true),
  circular: (l: any) => smoothRadialLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y),
  radial: (l: any) => smoothRadialLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y)
};
labelTransformers.weighted.smooth = {
  horizontal: (l: any) => smoothLinkLabel(l.source.weight, l.source.x, l.target.weight, l.target.x, true),
  vertical: (l: any) => smoothLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight, false),
  unrooted: (l: any) => smoothLinkLabel(l.source.weight, l.source.x, l.target.weight, l.target.x, true),
  circular: (l: any) => smoothRadialLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight),
  radial: (l: any) => smoothRadialLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight)
};
labelTransformers.dendrogram = labelTransformers.tree;

function labeler(d: any): string {
  // Show actual branch length; leaves without an explicit length show "—"
  const length = d.target.data.length;
  return length != null && length > 0 ? length.toFixed(3) : "\u2014";
}

/**
 * Updates the ruler display based on the current zoom transform.
 * @param transform - The current zoom transform.
 */
function updateRuler(this: TidyTree, transform: d3.ZoomTransform): void {
  if (!transform) transform = { k: 1 } as d3.ZoomTransform;
  const height = parseFloat(this.parent!.style("height")) - this.margin[2] - 15;
  const ruler = this.parent!.select("g.tidytree-ruler");
  const bg = ruler.select("rect");
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
    const axisFn: any = this.layout == "horizontal" ? d3.axisBottom : d3.axisLeft;
    const axis = axisFn();
    const orient = this.layout == "horizontal" ? "bottom" : "left";
    if (ruler.attr("data-orient") !== orient) {
      // d3-axis only sets tick line/text attributes and the group's
      // text-anchor when its elements are first created, so clear the
      // previous axis before switching between axisLeft and axisBottom.
      ruler.selectAll(".tick, .domain").remove();
      ruler.property("__axis", null).attr("data-orient", orient);
    }
    if (this.type === "tree" && this.layout !== "circular") {
      ruler
        .attr("opacity", 1)
        .call(
          axis.scale(
            d3.scaleLinear(
              [0, this.hierarchy!.height / transform.k],
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
