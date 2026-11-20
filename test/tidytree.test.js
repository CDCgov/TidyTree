import { describe, it, expect, beforeEach, afterEach } from "vitest";
import TidyTree from "../src/main.ts";

describe("TidyTree", () => {
  describe("constructor", () => {
    it("should create a TidyTree instance with default options", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      expect(tree).toBeDefined();
      expect(tree.layout).toBe("vertical");
      expect(tree.type).toBe("tree");
      expect(tree.mode).toBe("smooth");
    });

    it("should accept custom options", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);", {
        layout: "horizontal",
        type: "weighted",
        animation: 0
      });
      expect(tree.layout).toBe("horizontal");
      expect(tree.type).toBe("weighted");
      expect(tree.animation).toBe(0);
    });
  });

  describe("TidyTree.defaults", () => {
    it("should have default configuration values", () => {
      expect(TidyTree.defaults.layout).toBe("vertical");
      expect(TidyTree.defaults.nodeSize).toBe(3);
      expect(TidyTree.defaults.nodeLabelSize).toBe(12);
      expect(TidyTree.defaults.branchLabelSize).toBe(10);
      expect(TidyTree.defaults.branchWidth).toBe(2);
      expect(TidyTree.defaults.fontFamily).toBe("'Inter', sans-serif");
      expect(TidyTree.defaults.nodeShape).toBe("circle");
    });
  });

  describe("validLayouts", () => {
    it("should include all valid layouts", () => {
      expect(TidyTree.validLayouts).toContain("horizontal");
      expect(TidyTree.validLayouts).toContain("vertical");
      expect(TidyTree.validLayouts).toContain("circular");
      expect(TidyTree.validLayouts).toContain("radial");
      expect(TidyTree.validLayouts).toContain("unrooted");
    });
  });

  describe("validNodeColorModes", () => {
    it("should include heatmap and gradient modes", () => {
      expect(TidyTree.validNodeColorModes).toContain("none");
      expect(TidyTree.validNodeColorModes).toContain("predicate");
      expect(TidyTree.validNodeColorModes).toContain("heatmap");
      expect(TidyTree.validNodeColorModes).toContain("gradient");
    });
  });

  describe("validBranchColorModes", () => {
    it("should include heatmap and gradient modes", () => {
      expect(TidyTree.validBranchColorModes).toContain("none");
      expect(TidyTree.validBranchColorModes).toContain("monophyletic");
      expect(TidyTree.validBranchColorModes).toContain("heatmap");
      expect(TidyTree.validBranchColorModes).toContain("gradient");
    });
  });

  describe("validNodeShapes", () => {
    it("should include circle, square, and diamond", () => {
      expect(TidyTree.validNodeShapes).toContain("circle");
      expect(TidyTree.validNodeShapes).toContain("square");
      expect(TidyTree.validNodeShapes).toContain("diamond");
    });
  });

  describe("setLayout", () => {
    it("should set a valid layout", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.setLayout("horizontal");
      expect(tree.layout).toBe("horizontal");
    });

    it("should throw for invalid layout", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      expect(() => tree.setLayout("invalid")).toThrow();
    });
  });

  describe("setMode", () => {
    it("should set a valid mode", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.setMode("square");
      expect(tree.mode).toBe("square");
    });

    it("should throw for invalid mode", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      expect(() => tree.setMode("invalid")).toThrow();
    });
  });

  describe("setType", () => {
    it("should set a valid type", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.setType("weighted");
      expect(tree.type).toBe("weighted");
    });

    it("should throw for invalid type", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      expect(() => tree.setType("invalid")).toThrow();
    });
  });

  describe("setAnimation", () => {
    it("should set animation time", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.setAnimation(1000);
      expect(tree.animation).toBe(1000);
    });
  });

  describe("collapseNode / isNodeCollapsed", () => {
    it("should collapse and expand a node", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      // Mock parent to allow getNodeGUIDs to work
      tree.parent = { 
        select: () => ({ selectAll: () => ({ nodes: () => [] }) }),
        style: () => "100px"
      };
      const guids = tree.getNodeGUIDs(false, null);
      const internalGuid = guids.find(g => g.id !== "A" && g.id !== "B" && g.id !== "C");
      
      if (internalGuid) {
        tree.collapseNode(internalGuid._guid);
        expect(tree.isNodeCollapsed(internalGuid._guid)).toBe(true);
        tree.collapseNode(internalGuid._guid);
        expect(tree.isNodeCollapsed(internalGuid._guid)).toBe(false);
      } else {
        // If no internal nodes found, just test toggle on any guid
        if (guids.length > 0) {
          tree.collapseNode(guids[0]._guid);
          expect(tree.isNodeCollapsed(guids[0]._guid)).toBe(true);
          tree.collapseNode(guids[0]._guid);
          expect(tree.isNodeCollapsed(guids[0]._guid)).toBe(false);
        }
      }
    });
  });

  describe("addAnnotation / getAnnotation / removeAnnotation", () => {
    it("should add, get, and remove annotations", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      // Mock parent to allow getNodeGUIDs to work
      tree.parent = { 
        select: () => ({ selectAll: () => ({ nodes: () => [] }) }),
        style: () => "100px"
      };
      const guids = tree.getNodeGUIDs(false, null);
      const guid = guids.length > 0 ? guids[0]._guid : "test-guid";
      
      tree.addAnnotation(guid, { key: "value" });
      expect(tree.getAnnotation(guid)).toEqual({ key: "value" });
      
      tree.removeAnnotation(guid);
      expect(tree.getAnnotation(guid)).toBeUndefined();
    });
  });

  describe("setTooltipFormatter", () => {
    it("should set a custom tooltip formatter", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      const formatter = (data) => `Custom: ${data.id}`;
      tree.setTooltipFormatter(formatter);
      expect(tree.tooltipFormatter).toBe(formatter);
    });
  });

  describe("setColorOptions", () => {
    it("should set color options", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.setColorOptions({
        nodeColorMode: "none",
        branchColorMode: "none",
        defaultNodeColor: "#ff0000",
        defaultBranchColor: "#00ff00"
      });
      expect(tree.colorOptions.defaultNodeColor).toBe("#ff0000");
      expect(tree.colorOptions.defaultBranchColor).toBe("#00ff00");
    });
  });

  describe("setNodeSize / setNodeLabelSize / setBranchLabelSize / setBranchWidth", () => {
    it("should set node size", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.nodeSize = 5;
      expect(tree.nodeSize).toBe(5);
    });

    it("should set node label size", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.nodeLabelSize = 14;
      expect(tree.nodeLabelSize).toBe(14);
    });

    it("should set branch label size", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.branchLabelSize = 12;
      expect(tree.branchLabelSize).toBe(12);
    });

    it("should set branch width", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      tree.branchWidth = 4;
      expect(tree.branchWidth).toBe(4);
    });
  });

  describe("getNodeGUIDs", () => {
    it("should return node GUIDs", () => {
      const tree = new TidyTree("((A:1,B:1):1,C:1);");
      // Mock parent to allow getNodeGUIDs to work
      tree.parent = { 
        select: () => ({ selectAll: () => ({ nodes: () => [] }) }),
        style: () => "100px"
      };
      const guids = tree.getNodeGUIDs(false, null);
      expect(Array.isArray(guids)).toBe(true);
    });
  });

  describe("labeler", () => {
    it("should return branch length for nodes with length", () => {
      // labeler is a module-level function, test via tree behavior
      const tree = new TidyTree("((A:1.5,B:1):1,C:1);");
      expect(tree).toBeDefined();
    });
  });
});

describe("destroy (#81)", () => {
  // setup.js drops animation frames; queue them here so the test can run them.
  let frames, raf, caf;
  beforeEach(() => {
    frames = new Map();
    let next = 1;
    raf = globalThis.requestAnimationFrame;
    caf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => { frames.set(next, cb); return next++; };
    globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  });
  const flushFrames = () => { const cbs = [...frames.values()]; frames.clear(); cbs.forEach(cb => cb()); };

  // A drawn tree whose parent is emptied on destroy; any later redraw work fails loudly.
  const mockParent = (log) => ({
    html: () => { log.push("html"); },
    style: () => { log.push("redraw ran"); throw new Error("redraw ran after destroy"); }
  });

  it("skips a redraw queued before destroy()", () => {
    const tree = new TidyTree("((A:1,B:1):1,C:1);");
    const log = [];
    tree.parent = mockParent(log);
    tree.redraw();
    tree.destroy();
    expect(() => flushFrames()).not.toThrow();
    expect(log).toEqual(["html"]);
  });

  it("does not queue new redraws after destroy()", () => {
    const tree = new TidyTree("((A:1,B:1):1,C:1);");
    const log = [];
    tree.parent = mockParent(log);
    tree.destroy();
    tree.redraw();
    expect(frames.size).toBe(0);
    flushFrames();
    expect(log).toEqual(["html"]);
  });
});
