(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['patristic'], function () {
      return root.TidyTree = factory(patristic);
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('patristic'));
  } else {
    root.TidyTree = factory(root.patristic);
  }
})(typeof self !== 'undefined' ? self : this, function (patristic) {
  'use strict';
  /**
    * This class function creates a TidyTree object.
    * @param {String} newick A valid newick string
    * @param {Object} options A Javascript object containing options to set up the tree
    */

  function TidyTree(data, options) {
    if (data instanceof patristic.Branch) {
      this.setData(data);
    } else {
      this.setTree(data);
    }

    if (!options) options = {};
    Object.assign(this, {
      layout: 'vertical',
      type: 'tree',
      mode: 'smooth',
      leafNodes: true,
      leafLabels: false,
      leafLabelSize: 6,
      branchNodes: false,
      branchLabels: false,
      branchDistances: false,
      ruler: true,
      animation: 500,
      margin: [50, 50, 50, 50],
      //CSS order: top, right, bottom, left
      contextMenu: d => d3.event.preventDefault(),
      tooltip: d => null
    }, options);
    if (this.parent) this.draw();
  }
  /**
   * Update the TidyTree's underlying data structure
   * There are two contexts in which you should call this:
   * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
   * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
   * @param  {Object} data A patristic.Branch object
   * @return {Object}        the TidyTree object
   */


  TidyTree.prototype.setData = function (data) {
    if (!data) return console.error('Invalid Data');
    this.data = data;
    this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    this.hierarchy = d3.hierarchy(this.data, d => d.children).eachBefore(d => {
      d.value = (d.parent ? d.parent.value : 0) + (d.data.length ? d.data.length : 0);
      if (d.value < this.range[0]) this.range[0] = d.value;
      if (d.value > this.range[1]) this.range[1] = d.value;
    }).each(d => d.value /= this.range[1]);
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
    if (!newick) return console.error("Invalid Newick String");
    return this.setData(patristic.parseNewick(newick));
  };
  /**
   * The available layouts for rendering trees.
   * @type {Array}
   */


  TidyTree.validLayouts = ['horizontal', 'vertical', 'circular'];
  /**
   * The available types for rendering branches.
   * @type {Array}
   */

  TidyTree.validTypes = ['tree', 'weighted', 'dendrogram'];
  /**
    * The available modes for rendering branches.
    * @type {Array}
    */

  TidyTree.validModes = ['smooth', 'square', 'straight'];
  /**
   * Draws a Phylogenetic on the element referred to by selector
   * @param  {String} selector A CSS selector
   * @return {TidyTree}           the TidyTree object
   */

  TidyTree.prototype.draw = function (selector) {
    if (!selector && !this.parent) {
      throw new Error('No valid target for drawing given! Where should the tree go?');
    }

    if (selector) this.parent = selector;
    let tree = d3.tree();
    let svg = d3.select(this.parent).html(null).append('svg').attr('width', '100%').attr('height', '100%');
    let g = svg.append('g');
    this.zoom = d3.zoom().on('zoom', () => g.attr('transform', d3.event.transform));
    svg.call(this.zoom);
    g.append('g').attr('class', 'tidytree-links');
    g.append('g').attr('class', 'tidytree-nodes');
    g.append('g').attr('class', 'tidytree-ruler');
    return this.redraw().recenter();
  };

  const getX = d => d.x,
        getY = d => d.y,
        getLength = d => d.weight;

  let linkTransformers = {
    tree: {
      smooth: {
        horizontal: d3.linkHorizontal().x(getY).y(getX),
        vertical: d3.linkVertical().x(getX).y(getY),
        circular: d3.linkRadial().angle(getX).radius(getY)
      },
      straight: {
        horizontal: d => `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
        vertical: d => `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
        circular: d => {
          const startAngle = d.source.x - Math.PI / 2,
                startRadius = d.source.y,
                endAngle = d.target.x - Math.PI / 2,
                endRadius = d.target.y;
          const x0 = Math.cos(startAngle),
                y0 = Math.sin(startAngle),
                x1 = Math.cos(endAngle),
                y1 = Math.sin(endAngle);
          return 'M' + startRadius * x0 + ',' + startRadius * y0 + 'L' + endRadius * x1 + ',' + endRadius * y1;
        }
      },
      square: {
        horizontal: d => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
        vertical: d => `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
        circular: d => {
          const startAngle = d.source.x - Math.PI / 2,
                startRadius = d.source.y,
                endAngle = d.target.x - Math.PI / 2,
                endRadius = d.target.y;
          const x0 = Math.cos(startAngle),
                y0 = Math.sin(startAngle),
                x1 = Math.cos(endAngle),
                y1 = Math.sin(endAngle);
          return 'M' + startRadius * x0 + ',' + startRadius * y0 + (endAngle === startAngle ? '' : 'A' + startRadius + ',' + startRadius + ' 0 0 ' + (endAngle > startAngle ? 1 : 0) + ' ' + startRadius * x1 + ',' + startRadius * y1) + 'L' + endRadius * x1 + ',' + endRadius * y1;
        }
      }
    },
    weighted: {
      smooth: {
        horizontal: d3.linkHorizontal().x(getLength).y(getX),
        vertical: d3.linkVertical().x(getX).y(getLength),
        circular: d3.linkRadial().angle(getX).radius(getLength)
      },
      straight: {
        horizontal: d => `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`,
        vertical: d => `M${d.source.x} ${d.source.weight} L ${d.target.x} ${d.target.weight}`,
        circular: d => {
          const startAngle = d.source.x - Math.PI / 2,
                startRadius = d.source.weight,
                endAngle = d.target.x - Math.PI / 2,
                endRadius = d.target.weight;
          const x0 = Math.cos(startAngle),
                y0 = Math.sin(startAngle),
                x1 = Math.cos(endAngle),
                y1 = Math.sin(endAngle);
          return 'M' + startRadius * x0 + ',' + startRadius * y0 + 'L' + endRadius * x1 + ',' + endRadius * y1;
        }
      },
      square: {
        horizontal: d => `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${d.target.weight}`,
        vertical: d => `M${d.source.x} ${d.source.weight} H ${d.target.x} V ${d.target.weight}`,
        circular: d => {
          const startAngle = d.source.x - Math.PI / 2,
                startRadius = d.source.weight,
                endAngle = d.target.x - Math.PI / 2,
                endRadius = d.target.weight;
          const x0 = Math.cos(startAngle),
                y0 = Math.sin(startAngle),
                x1 = Math.cos(endAngle),
                y1 = Math.sin(endAngle);
          return 'M' + startRadius * x0 + ',' + startRadius * y0 + (endAngle === startAngle ? '' : 'A' + startRadius + ',' + startRadius + ' 0 0 ' + (endAngle > startAngle ? 1 : 0) + ' ' + startRadius * x1 + ',' + startRadius * y1) + 'L' + endRadius * x1 + ',' + endRadius * y1;
        }
      }
    }
  };
  linkTransformers.dendrogram = linkTransformers.tree;

  function circularPoint(x, y) {
    return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
  }

  let nodeTransformers = {
    tree: {
      horizontal: d => `translate(${d.y}, ${d.x})`,
      vertical: d => `translate(${d.x}, ${d.y})`,
      circular: d => `translate(${circularPoint(d.x, d.y)})`
    },
    weighted: {
      horizontal: d => `translate(${d.weight}, ${d.x})`,
      vertical: d => `translate(${d.x}, ${d.weight})`,
      circular: d => `translate(${circularPoint(d.x, d.weight)})`
    }
  };
  nodeTransformers.dendrogram = nodeTransformers.tree;
  const radToDeg = 180 / Math.PI;
  let labelTransformers = {
    tree: {
      straight: {
        horizontal: l => `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x + l.target.x) / 2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.y - l.source.y)) * radToDeg})`,
        vertical: l => `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.y + l.target.y) / 2}) rotate(${Math.atan((l.source.y - l.target.y) / (l.source.x - l.target.x)) * radToDeg})`,
        circular: l => {
          let s = circularPoint(l.source.x, l.source.y),
              t = circularPoint(l.target.x, l.target.y);
          return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) / 2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
        }
      },
      square: {
        horizontal: l => `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`,
        vertical: l => `translate(${l.target.x}, ${(l.source.y + l.target.y) / 2}) rotate(90)`,
        circular: l => {
          let u = circularPoint(l.target.x, (l.source.y + l.target.y) / 2);
          return `translate(${u[0]}, ${u[1]}) rotate(${l.target.x * radToDeg % 180 - 90})`;
        }
      }
    },
    weighted: {
      straight: {
        horizontal: l => `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x + l.target.x) / 2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.weight - l.source.weight)) * radToDeg})`,
        vertical: l => `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.weight + l.target.weight) / 2}) rotate(${Math.atan((l.source.weight - l.target.weight) / (l.source.x - l.target.x)) * radToDeg})`,
        circular: l => {
          let s = circularPoint(l.source.x, l.source.weight),
              t = circularPoint(l.target.x, l.target.weight);
          return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) / 2}) rotate(${Math.atan((s[1] - t[1]) / (s[0] - t[0])) * radToDeg})`;
        }
      },
      square: {
        horizontal: l => `translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})`,
        vertical: l => `translate(${l.target.x}, ${(l.source.weight + l.target.weight) / 2}) rotate(90)`,
        circular: l => {
          let u = circularPoint(l.target.x, (l.source.weight + l.target.weight) / 2);
          return `translate(${u[0]}, ${u[1]}) rotate(${l.target.x * radToDeg % 180 - 90})`;
        }
      }
    }
  };
  labelTransformers.tree.smooth = labelTransformers.tree.straight;
  labelTransformers.weighted.smooth = labelTransformers.weighted.straight;
  labelTransformers.dendrogram = labelTransformers.tree;
  /**
   * Redraws the links and relocates the nodes accordingly
   * @return {TidyTree} The TidyTree Object
   */

  TidyTree.prototype.redraw = function () {
    let parent = d3.select(this.parent);
    let width = parseFloat(parent.style('width')) - this.margin[0] - this.margin[2];
    let height = parseFloat(parent.style('height')) - this.margin[1] - this.margin[3];
    let scalar = this.layout === 'horizontal' ? width : this.layout === 'vertical' ? height : Math.min(width, height) / 2;
    this.hierarchy.each(d => d.weight = scalar * d.value);
    let g = parent.select('svg g');
    let source = (this.type === 'tree' ? d3.tree() : d3.cluster()).size(this.layout === 'circular' ? [2 * Math.PI, Math.min(height, width) / 2] : this.layout === 'horizontal' ? [height, width] : [width, height]).separation((a, b) => 1); //Note: You must render links prior to nodes in order to get correct placement!

    let links = g.select('g.tidytree-links').selectAll('g.tidytree-link').data(source(this.hierarchy).links());
    links.join(enter => {
      let newLinks = enter.append('g').attr('class', 'tidytree-link');
      newLinks.append('path').attr('fill', 'none').attr('stroke', '#ccc').attr('d', linkTransformers[this.type][this.mode][this.layout]).transition().duration(this.animation).attr('opacity', 1);
      newLinks.append('text').attr('y', 2).attr('text-anchor', 'middle').style('font-size', '6px').text(d => {
        if (typeof d.target.data.length === 'undefined') return '0.000';
        return d.target.data.length.toLocaleString();
      }).transition().duration(this.animation).style('opacity', this.branchDistances ? 1 : 0);
    }, update => {
      update.select('path').transition().duration(this.animation).attr('d', linkTransformers[this.type][this.mode][this.layout]);
    }, exit => exit.transition().duration(this.animation).attr('opacity', 0).remove());

    if (this.branchDistances) {
      links.selectAll('text').transition().duration(this.animation).attr('transform', labelTransformers[this.type][this.mode][this.layout]);
    }

    let nodes = g.select('g.tidytree-nodes').selectAll('g.tidytree-node').data(this.hierarchy.descendants());
    nodes.join(enter => {
      let newNodes = enter.append('g').attr('class', d => 'tidytree-node ' + (d.children ? 'tidytree-node-internal' : 'tidytree-node-leaf')).attr('transform', nodeTransformers[this.type][this.layout]);
      newNodes.append('circle').attr('title', d => d.data.id).style('opacity', d => d.children && this.branchNodes || !d.children && this.leafNodes ? 1 : 0).on('mouseover', this.tooltip).on('contextmenu', this.contextMenu).attr('r', 2.5);
      newNodes.append('text').text(d => d.data.id).style('font-size', '6px').attr('y', 2).attr('x', 5).style('opacity', d => d.children && this.branchLabels || !d.children && this.leafLabels ? 1 : 0);
    }, update => {
      update.transition().duration(this.animation).attr('transform', nodeTransformers[this.type][this.layout]);
    }, exit => exit.transition().duration(this.animation).attr('opacity', 0).remove());

    if (this.layout === 'vertical') {
      nodes.selectAll('text').attr('transform', 'rotate(90)').attr('text-anchor', 'start').attr('x', 5);
    } else if (this.layout === 'horizontal') {
      nodes.selectAll('text').attr('transform', 'rotate(0)').attr('text-anchor', 'start').attr('x', 5);
    } else {
      nodes.selectAll('text').attr('transform', l => 'rotate(' + (l.x / Math.PI * 180 % 180 - 90) + ')').attr('text-anchor', l => l.x % (2 * Math.PI) > Math.PI ? 'end' : 'start').attr('x', l => l.x % (2 * Math.PI) > Math.PI ? -5 : 5);
    }

    let ruler = g.select('g.tidytree-ruler');

    if (this.ruler) {
      ruler.attr('transform', this.layout == 'horizontal' ? `translate(0,${height})` : 'translate(0,0)');
      let axis = this.layout == 'horizontal' ? d3.axisBottom() : d3.axisRight();

      if (this.type === 'tree') {
        ruler.transition().duration(this.animation).attr('opacity', 1).call(axis.scale(d3.scaleLinear([this.hierarchy.depth, this.hierarchy.height], [0, scalar])));
      } else if (this.type === 'weighted') {
        ruler.transition().duration(this.animation).attr('opacity', 1).call(axis.scale(d3.scaleLinear(this.range, [0, scalar])));
      } else {
        ruler.transition().duration(this.animation).attr('opacity', 0);
      }
    } else {
      ruler.transition().duration(this.animation).attr('opacity', 0);
    }

    return this;
  };
  /**
   * Recenters the tree in the center of the view
   * @return {TidyTree} The TidyTree object
   */


  TidyTree.prototype.recenter = function () {
    let svg = d3.select(this.parent).select('svg'),
        x = this.margin[0],
        y = this.margin[3];

    if (this.layout === 'circular') {
      x += parseFloat(svg.style('width')) / 2;
      y += parseFloat(svg.style('height')) / 2;
    }

    svg.transition().duration(this.animation).call(this.zoom.transform, d3.zoomIdentity.translate(x, y));
    return this;
  };
  /**
   * Set the TidyTree's layout
   * @param {String} newLayout The new layout
   * @return {TidyTree} The TidyTree Object
   */


  TidyTree.prototype.setLayout = function (newLayout) {
    if (!TidyTree.validLayouts.includes(newLayout)) {
      console.error('Cannot set TidyTree to layout:', newLayout, '\nValid layouts are:', TidyTree.validLayouts);
      return;
    }

    this.layout = newLayout;
    if (this.parent) return this.redraw();
    return this;
  };
  /**
   * Set the TidyTree's mode
   * @param {String} newMode The new mode
   * @return {TidyTree} The TidyTree object
   */


  TidyTree.prototype.setMode = function (newMode) {
    if (!TidyTree.validModes.includes(newMode)) {
      console.error('Cannot set TidyTree to mode:', newMode, '\nValid modes are:', TidyTree.validModes);
      return;
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
      console.error('Cannot set TidyTree to type:', newType, '\nValid types are:', TidyTree.validTypes);
      return;
    }

    this.type = newType;
    if (this.parent) return this.redraw();
    return this;
  };
  /**
   * Set the TidyTree's animation speed. Note that this does not trigger a
   * redraw.
   * @param {number} speed The desired duration of an animation, in ms. Set to 0
   * to turn animations off completely.
   * @return {TidyTree} The TidyTree object
   */


  TidyTree.prototype.setAnimation = function (speed) {
    this.animation = speed;
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
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-leaf circle').transition().duration(this.animation).style('opacity', show ? 1 : 0);
    }

    return this;
  };
  /**
   * Shows or Hides the TidyTree's Leaf Labels
   * @param  {Boolean} show Should the TidyTree show leafLabels?
   * @return {TidyTree}     the TidyTree Object
   */


  TidyTree.prototype.setLeafLabels = function (show) {
    this.leafLabels = show ? true : false;

    if (this.parent) {
      //i.e. has already been drawn
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-leaf text').transition().duration(this.animation).style('opacity', show ? 1 : 0);
    }

    return this;
  };
  /**
   * Sets the size of Leaf Labels
   * @param  {Number} size The desired size (in font pixels) of the leaf labels.
   * Note that this is not necessarily the actual on-screen size, as labels
   * scale with zooming over the tree.
   * @return {TidyTree} the TidyTree Object
   */


  TidyTree.prototype.setLeafLabelSize = function (size) {
    this.leafLabelSize = size;

    if (this.parent) {
      //i.e. has already been drawn
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-leaf text').transition().duration(this.animation).attr(this.layout === 'horizontal' ? 'y' : 'x', size / 2.5).style('font-size', size + 'px');
    }

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
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-internal circle').transition().duration(this.animation).style('opacity', show ? 1 : 0);
    }

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
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-internal text').transition().duration(this.animation).style('opacity', show ? 1 : 0);
    }

    return this;
  };
  /**
   * Sets the size of the Branch Labels
   * @param {Number} size The desired size (in font-pixels). Note that this is
   * not necessarily the actual on-screen size, as labels scale with zooming.
   * @return {TidyTree} The TidyTree Object
   */


  TidyTree.prototype.setBranchLabelSize = function (size) {
    this.branchLabelSize = size;

    if (this.parent) {
      //i.e. has already been drawn
      d3.select(this.parent).select('svg').selectAll('g.tidytree-node-internal text').transition().duration(this.animation).attr(this.layout === 'horizontal' ? 'y' : 'x', size / 2.5).style('font-size', size + 'px');
    }

    return this;
  };
  /**
   * Shows or hides the TidyTree's branch labels
   * @param {Boolean} show Should the TidyTree show branchLabels?
   * @return {TidyTree} The TidyTree Object
   */


  TidyTree.prototype.setBranchDistances = function (show) {
    this.branchDistances = show ? true : false;

    if (this.parent) {
      //i.e. has already been drawn
      let links = d3.select(this.parent).select('svg g.tidytree-links').selectAll('g.tidytree-link').selectAll('text');
      if (show) links.attr('transform', labelTransformers[this.type][this.mode][this.layout]);
      links.transition().duration(this.animation).style('opacity', show ? 1 : 0);
    }

    return this;
  };
  /**
   * Set the TidyTree's branchLabels
   * @param {Boolean} show Should the TidyTree show branchLabels?
   * @return {TidyTree} The TidyTree Object
   */


  TidyTree.prototype.setBranchDistanceSize = function (size) {
    this.branchDistanceSize = size;

    if (this.parent) {
      //i.e. has already been drawn
      d3.select(this.parent).select('svg g.tidytree-links').selectAll('g.tidytree-link').selectAll('text').transition().duration(this.animation).style('font-size', size + 'px');
    }

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
      this.redraw();
    }

    return this;
  };

  return TidyTree;
});

