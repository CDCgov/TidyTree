import * as d3 from "d3";
import * as patristic from "patristic";
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
    nodeList?: Array<{
        _guid: string;
        id: string;
    }>;
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
export default class TidyTree {
    static patristic: typeof patristic;
    static defaults: TidyTreeOptions;
    static validLayouts: Layout[];
    static validTypes: TreeType[];
    static validModes: Mode[];
    static validNodeColorModes: NodeColorMode[];
    static validBranchColorModes: BranchColorMode[];
    static validNodeShapes: NodeShape[];
    parent?: d3.Selection<any, any, any, any>;
    layout: Layout;
    type: TreeType;
    mode: Mode;
    colorOptions: ColorOptions;
    leafNodes: boolean;
    leafLabels: boolean;
    equidistantLeaves: boolean;
    branchNodes: boolean;
    branchLabels: boolean;
    branchDistances: boolean;
    hStretch: number;
    vStretch: number;
    rotation: number;
    ruler: boolean;
    interactive: boolean;
    animation: number;
    margin: [number, number, number, number];
    nodeSize: number;
    nodeLabelSize: number;
    branchLabelSize: number;
    branchWidth: number;
    fontFamily: string;
    nodeShape: NodeShape;
    virtualize: boolean;
    virtualizationThreshold: number;
    data?: patristic.Branch;
    hierarchy?: d3.HierarchyNode<NodeDatum>;
    range: [number, number];
    width: number;
    height: number;
    scalar: number;
    transform: d3.ZoomTransform;
    zoom?: d3.ZoomBehavior<any, any>;
    tooltipFormatter?: (data: any) => string;
    collapsedNodes: Set<string>;
    annotations: Map<string, any>;
    temporalAnnotations: Map<string, TemporalAnnotation>;
    showTemporalAnnotations: boolean;
    events: TidyTreeEvents;
    /**
     * This class function creates a TidyTree object.
     * @param data A valid newick string or patristic.Branch object
     * @param options A Javascript object containing options to set up the tree
     * @param events Event handlers
     */
    constructor(data: string | patristic.Branch, options?: TidyTreeOptions, events?: TidyTreeEvents);
    /**
     * Update the TidyTree's underlying data structure
     * There are two contexts in which you should call this:
     * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
     * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
     * @param data A patristic.Branch object
     * @return the TidyTree object
     */
    setData(data: patristic.Branch): TidyTree;
    /**
     * Update the TidyTree's underlying data structure
     * There are two contexts in which you should call this:
     * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
     * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
     * @param newick A valid newick string
     * @return the TidyTree object
     */
    setTree(newick: string): TidyTree;
    /**
     * Returns the CSS selector for the node glyph element based on the current nodeShape.
     * @return The selector string ("circle", "rect", or "polygon").
     */
    _nodeGlyphSelector(): string;
    /**
     * Private method to calculate how much vertical space to leave for the ruler
     */
    _rulerOffset(): number;
    /**
     * Draws a Phylogenetic on the element referred to by selector
     * @param selector A CSS selector
     * @return the TidyTree object
     */
    draw(selector: string | d3.Selection<any, any, any, any>): TidyTree;
    /**
     * Set the TidyTree's layout
     * @param newLayout The new layout
     * @return The TidyTree Object
     */
    setLayout(newLayout: Layout): TidyTree;
    /**
     * Set the TidyTree's colorOptions
     * @param newColorOptions The new colorOptions
     * @return The TidyTree Object
     */
    setColorOptions(newColorOptions: ColorOptions): TidyTree;
    /**
     * Set the TidyTree's mode
     * @param newMode The new mode
     * @return the TidyTree object
     */
    setMode(newMode: Mode): TidyTree;
    /**
     * Set the TidyTree's type
     * @param newType The new type
     * @return the TidyTree object
     */
    setType(newType: TreeType): TidyTree;
    /**
     * Set the TidyTree's rotation
     * @param degrees The new number of degrees by which to rotate the tree
     * @return the TidyTree object
     */
    setRotation(degrees: number): TidyTree;
    /**
     * Set the TidyTree's Horizontal Stretch
     * @param proportion The new proportion by which to stretch the tree
     * @return the TidyTree object
     */
    setHStretch(proportion: number): TidyTree;
    /**
     * Set the TidyTree's Vertical Stretch
     * @param proportion The new proportion by which to stretch the tree
     * @return the TidyTree object
     */
    setVStretch(proportion: number): TidyTree;
    /**
     * Set the TidyTree's animation time. Note that this does not trigger a
     * redraw.
     * @param time The desired duration of an animation, in ms. Set to 0
     * to turn animations off completely.
     * @return The TidyTree object
     */
    setAnimation(time: number): TidyTree;
    /**
     * Shows or hides the Branch Nodes
     * @param show Should Branch nodes be shown?
     * @return the TidyTree object
     */
    setBranchNodes(show: boolean): TidyTree;
    /**
     * Restyles Leaf Nodes
     * @param styler A function that restyles each node. `styler`
     * receives a reference to the DOM node to be styled, and an associated data
     * object.
     * @return the TidyTree Object
     */
    eachBranchNode(styler: (node: Element, datum: any) => void): TidyTree;
    /**
     * Set the TidyTree's branchLabels
     * @param show Should the TidyTree show branchLabels?
     * @return the TidyTree Object
     */
    setBranchLabels(show: boolean): TidyTree;
    /**
     * Restyles Branch Label
     * @param styler A function that restyles each node. `styler`
     * receives a reference to the DOM node to be styled, and an associated data
     * object.
     * @return the TidyTree Object
     */
    eachBranchLabel(styler: (node: Element, datum: any) => void): TidyTree;
    /**
     * Shows or hides the TidyTree's branch labels
     * @param show Should the TidyTree show branch distances?
     * @return The TidyTree Object
     */
    setBranchDistances(show: boolean): TidyTree;
    /**
     * Restyles Branch Distances
     * @param styler A function that restyles each node. `styler`
     * receives a reference to the DOM node to be styled, and an associated data
     * object.
     * @return the TidyTree Object
     */
    eachBranchDistance(styler: (node: Element, datum: any) => void): TidyTree;
    /**
     * Shows or Hides the Leaf Nodes
     * @param show Should leaf nodes be visible?
     * @return The TidyTree Object
     */
    setLeafNodes(show: boolean): TidyTree;
    /**
     * Restyles Leaf Nodes
     * @param styler A function that restyles each node. `styler`
     * receives a reference to the DOM node to be styled, and an associated data
     * object.
     * @return the TidyTree Object
     */
    eachLeafNode(styler: (node: Element, datum: any) => void): TidyTree;
    /**
     * Set the TidyTree's leaves to be equidistant
     */
    setEquidistantLeaves(isEquidistant: boolean): TidyTree;
    /**
     * Shows or Hides the TidyTree's Leaf Labels
     * @param show Should the TidyTree show leafLabels?
     * @return the TidyTree Object
     */
    setLeafLabels(show: boolean): TidyTree;
    /**
     * Restyles Leaf Labels
     * @param styler A function that restyles each node. `styler`
     * receives a reference to the DOM node to be styled, and an associated data
     * object.
     * @return the TidyTree Object
     */
    eachLeafLabel(styler: (node: Element, datum: any) => void): TidyTree;
    /**
     * Shows or hides the TidyTree's branch labels
     * @param show Should the TidyTree show branchLabels?
     * @return The TidyTree Object
     */
    setRuler(show: boolean): TidyTree;
    /**
     * Set a custom formatter function for tooltip content.
     * The formatter receives the node data object and should return a string
     * to display in the tooltip. If not set, the node id is used by default.
     * @param formatter A function that takes node data and returns a string.
     * @return The TidyTree object.
     */
    setTooltipFormatter(formatter: (data: any) => string): TidyTree;
    /**
     * Collapse or expand a subtree rooted at the given node GUID.
     * If the node is already collapsed, it will be expanded; otherwise it will be collapsed.
     * @param nodeGuid The GUID of the node whose subtree to collapse/expand.
     * @return The TidyTree object.
     */
    collapseNode(nodeGuid: string): TidyTree;
    /**
     * Check whether a node is currently collapsed.
     * @param nodeGuid The GUID of the node to check.
     * @return True if the node is collapsed, false otherwise.
     */
    isNodeCollapsed(nodeGuid: string): boolean;
    /**
     * Returns an array of all descendant GUIDs (including the node itself) for a given node GUID.
     * @param nodeGuid The GUID of the root node.
     * @return Array of descendant GUIDs.
     */
    getDescendantGUIDs(nodeGuid: string): string[];
    /**
     * Returns a filtered copy of the hierarchy that excludes collapsed subtrees.
     * Nodes that are collapsed (and all their descendants) are removed from the
     * returned hierarchy so they are not rendered.
     * @return A filtered d3 hierarchy object.
     */
    _getFilteredHierarchy(): d3.HierarchyNode<NodeDatum>;
    /**
     * Returns a filtered hierarchy containing only nodes within the visible viewport.
     * Used for virtualization of large trees (1000+ nodes).
     * @param hierarchy The full filtered hierarchy
     * @return A d3 hierarchy with only visible nodes
     */
    _getVisibleHierarchy(hierarchy: d3.HierarchyNode<NodeDatum>): d3.HierarchyNode<NodeDatum>;
    /**
     * Add or update an annotation (metadata) for a specific node.
     * @param nodeGuid The GUID of the node to annotate.
     * @param data The annotation data to store.
     * @return The TidyTree object.
     */
    addAnnotation(nodeGuid: string, data: any): TidyTree;
    /**
     * Retrieve the annotation data for a specific node.
     * @param nodeGuid The GUID of the node.
     * @return The annotation data, or undefined if none exists.
     */
    getAnnotation(nodeGuid: string): any | undefined;
    /**
     * Remove the annotation for a specific node.
     * @param nodeGuid The GUID of the node.
     * @return The TidyTree object.
     */
    removeAnnotation(nodeGuid: string): TidyTree;
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
    addTemporalAnnotation(guid: string, start: number, end: number, label?: string, color?: string): TidyTree;
    /**
     * Retrieve the temporal annotation for a specific node.
     * @param guid The GUID of the node.
     * @return The temporal annotation data, or undefined if none exists.
     */
    getTemporalAnnotation(guid: string): TemporalAnnotation | undefined;
    /**
     * Remove the temporal annotation for a specific node.
     * @param guid The GUID of the node.
     * @return The TidyTree object.
     */
    removeTemporalAnnotation(guid: string): TidyTree;
    /**
     * Set whether temporal annotations are visible.
     * @param show Whether to show temporal annotations.
     * @return The TidyTree object.
     */
    setShowTemporalAnnotations(show: boolean): TidyTree;
    /**
     * Retrieves the GUIDs of the nodes in the TidyTree instance.
     *
     * @param leavesOnly - Whether to retrieve GUIDs only for leaf nodes.
     * @param predicate - A function that returns true if the node should be included
     * @return An array of GUIDs of the nodes.
     */
    getNodeGUIDs(leavesOnly: boolean, predicate?: (node: Element) => boolean): Array<{
        _guid: string;
        id: string;
    }>;
    /**
     * Searches the tree, returns Search Results
     * @param test A function which takes a Branch and returns a Truthy
     * or Falsy value.
     * @return The array of results
     */
    search(test: (d: any) => boolean): d3.Selection<any, any, any, any> | undefined;
    /**
     * Attaches a new event listener
     * Please note that this is not yet functioning.
     * @param events A space-delimited list of event names
     * @param callback The function to run when one of the `events` occurs.
     * @return The TidyTree on which this method was called.
     */
    on(events: string, callback: (...args: any[]) => void): TidyTree;
    /**
     * Removes all event listeners from the given events
     * @param events A space-delimited list of event names
     * @return The TidyTree on which this method was called.
     */
    off(events: string): TidyTree;
    /**
     * Forces the tree to respond as though an `event` has occurred
     * @param events space-delimited list of names of events to trigger.
     * @param args Any arguments which should be passed to the event
     * handler(s).
     * @return The output of the callback run on `event`
     */
    trigger(events: string, ...args: any[]): any[];
    /**
     * Destroys the TidyTree
     * @return undefined
     */
    destroy(): void;
    /**
     * Wraps a d3 selection transition with requestAnimationFrame for smoother rendering.
     * If animation is 0, applies attributes immediately without animation.
     * @param selection - The d3 selection to transition.
     * @param attrs - Object of attribute/style key-value pairs to apply.
     * @param applyFn - Optional function to apply custom transition logic.
     * @return The transition or selection.
     */
    _transition(selection: d3.Selection<any, any, any, any>, attrs?: Record<string, string | number>, applyFn?: (transition: d3.Transition<any, any, any, any>) => void): d3.Selection<any, any, any, any> | d3.Transition<any, any, any, any>;
    /**
     * Redraws the links and relocates the nodes accordingly
     * @return The TidyTree Object
     */
    redraw(): TidyTree;
    /**
     * Set the TidyTree's interactivity
     * @param bool Whether the tree should be interactive
     * @return The TidyTree object
     */
    setInteractive(bool: boolean): TidyTree;
    /**
     * Set the branch node size.
     * @param size The size of branch nodes.
     * @return The TidyTree object.
     */
    setBranchNodeSize(size: number): TidyTree;
    /**
     * Set the branch label size.
     * @param size The font size for branch labels.
     * @return The TidyTree object.
     */
    setBranchLabelSize(size: number): TidyTree;
    /**
     * Set the branch distance size.
     * @param size The font size for branch distance labels.
     * @return The TidyTree object.
     */
    setBranchDistanceSize(size: number): TidyTree;
    /**
     * Set the leaf node size.
     * @param size The size of leaf nodes.
     * @return The TidyTree object.
     */
    setLeafNodeSize(size: number): TidyTree;
    /**
     * Set the leaf label size.
     * @param size The font size for leaf labels.
     * @return The TidyTree object.
     */
    setLeafLabelSize(size: number): TidyTree;
    /**
     * Set whether tooltips are enabled.
     * @param enabled Whether tooltips should be shown.
     * @return The TidyTree object.
     */
    setTooltips(enabled: boolean): TidyTree;
    /**
     * Set whether temporal annotations are visible.
     * @param show Whether to show temporal annotations.
     * @return The TidyTree object.
     */
    setShowTemporal(show: boolean): TidyTree;
    /**
     * Set the background color of the tree container.
     * @param color A CSS color string.
     * @return The TidyTree object.
     */
    setBackground(color: string): TidyTree;
    /**
     * Recenters the tree in the center of the view
     * @return The TidyTree object
     */
    recenter(): TidyTree;
}
export {};
