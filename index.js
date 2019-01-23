(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function(){ return (root.TidyTree = factory()); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TidyTree = factory();
  }
}(typeof self !== 'undefined' ? self : this, function(){
  "use strict";

	/**
   * This class function creates a TidyTree object.
   * @param {string} newick A valid newick string
   * @param {object} options A Javascript object containing options to set up the tree
   */
  function TidyTree(newick, options){
    if(!options) options = {};
		let tree = patristic.parseNewick(newick);
		let hierarchy = d3.hierarchy(tree, d => d.children).sum(d => d.length);
    Object.assign(this, {
			layout: 'vertical',
			type: 'tree',
      mode: 'smooth',
      distance: false,
      leafNodes: true,
			leafLabels: false,
      branchNodes: false,
			branchLabels: false,
      branchDistances: false,
      animation: true,
      margin: [50, 50, 50, 50], //CSS order: top, right, bottom, left
      tree,
			hierarchy
    }, options);
    if(options.parent) this.draw();
  }

  /**
   * The available layouts for rendering trees.
   * @type {Array}
   */
  TidyTree.validLayouts = ['horizontal', 'vertical', 'circular'];

	/**
	 * The available types for rendering branches.
	 * @type {Array}
	 */
	TidyTree.validTypes = ['tree', 'dendrogram'];

	/**
   * The available modes for rendering branches.
   * @type {Array}
   */
  TidyTree.validModes = ['smooth', 'square', 'straight'];

	/**
	 * Draws a Phylogenetic on the element referred to by selector
	 * @param  {string} selector A CSS selector
	 * @return {TidyTree}           the TidyTree object
	 */
  TidyTree.prototype.draw = function(selector){
    if(!selector && !this.parent){
      console.error("No valid target for drawing given! Where should the tree go?");
    }
    if(!selector) selector = this.parent;
    if(!this.parent) this.parent = selector;

		let tree = d3.tree();

		let parent = d3.select(selector);
		let svg = parent.append("svg")
		      .attr("width", "100%")
		      .attr("height", "100%");

		let g = svg.append("g");

		let zoom = d3.zoom().on("zoom", () => g.attr("transform", d3.event.transform));
    svg.call(zoom);

		// Set initial tree
		let link = g.selectAll(".link")
		    .data(tree(this.hierarchy).links())
        .enter().append("g")
        .attr("class", "link");

    link.append('path')
			  .attr("fill", "none")
			  .attr("stroke", "#ccc")
		    .attr("d", linkTransformers[this.mode][this.layout]);

    link.append('text')
        .attr('y', 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '6px')
        .text(d => d.source.value.toLocaleString());

		let node = g.selectAll(".node")
        .data(this.hierarchy.descendants())
        .enter().append("g")
        .attr("class", d => "node " + (d.children ? "node--internal" : "node--leaf"));

		node.append("circle")
        .attr("r", 2.5);

		node.append("text")
        .text(d => d.data.id)
        .style('font-size', '6px')
        .attr('y', 2)
        .attr('x', 5);

		this.redraw();

    svg.call(zoom.translateBy, this.margin[0], this.margin[3]);

		return this;
  };

  const getX = d => d.x,
        getY = d => d.y;

  const linkTransformers = {
    smooth: {
      vertical:   d3.linkVertical(  ).x(getX).y(getY),
      horizontal: d3.linkHorizontal().x(getY).y(getX),
      circular:   d3.linkRadial().angle(getX).radius(getY)
    },
    straight: {
      vertical:   d => `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
      horizontal: d => `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
      circular:   d => {
        let startAngle  = d.source.x - Math.PI/2,
            startRadius = d.source.y,
            endAngle    = d.target.x - Math.PI/2,
            endRadius   = d.target.y;
        const x0 = Math.cos(startAngle);
        const y0 = Math.sin(startAngle);
        const x1 = Math.cos(endAngle);
        const y1 = Math.sin(endAngle);
        return  "M" + startRadius*x0 + "," + startRadius*y0 +
                "L" +   endRadius*x1 + "," +   endRadius*y1;
      }
    },
    square: {
      vertical:   d => `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
      horizontal: d => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
      circular:   d => {
        let startAngle  = d.source.x - Math.PI/2,
            startRadius = d.source.y,
            endAngle    = d.target.x - Math.PI/2,
            endRadius   = d.target.y;
        const x0 = Math.cos(startAngle);
        const y0 = Math.sin(startAngle);
        const x1 = Math.cos(endAngle);
        const y1 = Math.sin(endAngle);
        return  "M" + startRadius*x0 + "," + startRadius*y0 +
                      (endAngle === startAngle ? "" :
                "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius*x1 + "," + startRadius*y1) +
                "L" + endRadius*x1 + "," + endRadius * y1;
      }
    }
	};

  const labelTransformers = {
    vertical:   l => `translate(${(l.source.x + l.target.x)/2}, ${(l.source.y + l.target.y)/2})`,
    horizontal: l => `translate(${(l.source.y + l.target.y)/2}, ${(l.source.x + l.target.x)/2})`,
    circular:   l => {
      let s = circularPoint(l.source.x, l.source.y),
          t = circularPoint(l.target.x, l.target.y);
      return `translate(${(s[0] + t[0])/2}, ${(s[1] + t[1])/2})`;
    }
  };

	function circularPoint(x, y){
		return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
	}

	const nodeTransformers = {
		vertical:   d => `translate(${d.x},${d.y})`,
		horizontal: d => `translate(${d.y},${d.x})`,
		circular:   d => `translate(${circularPoint(d.x, d.y)})`
	};

	TidyTree.prototype.redraw = function(){
    let parent = d3.select(this.parent);

    let width  = parseFloat(parent.style('width'))  - this.margin[0] - this.margin[2];
    let height = parseFloat(parent.style('height')) - this.margin[1] - this.margin[3];

		let g = parent.select('svg g');

		let source = this.type === 'tree' ? d3.tree() : d3.cluster();
    source.size(this.layout === 'circular' ?
			[2 * Math.PI, height/2] :
      [height, width]
		);

		let dt = this.animation ? 800 : 0;

    let link = g.selectAll('.link').data(source(this.hierarchy).links());

    if(this.branchDistances){
      link.selectAll('text')
          .transition()
          .style('opacity', 1)
          .attr('transform', labelTransformers[this.layout])
          .duration(dt);
    } else {
      link.selectAll('text')
          .transition()
          .style('opacity', 0)
          .duration(dt);
    }

    link.select('path')
  			.transition()
  			.attr("d", linkTransformers[this.mode][this.layout])
  			.duration(dt);

		let node = g.selectAll('.node');

    node.selectAll('circle')
        .style('display', d => ((d.children && this.branchNodes) || (!d.children && this.leafNodes)) ? 'block' : 'none');

		node
  			.transition()
  			.attr("transform", nodeTransformers[this.layout])
  			.duration(dt);

    let showLeafLabels   = this.leafLabels,
        showBranchLabels = this.branchLabels;

		let text = node.selectAll('text');

		text.style('display', d => ((d.children && showBranchLabels) || (!d.children && showLeafLabels)) ? 'block' : 'none');

    if(this.layout === 'vertical'){
      text
        .attr('transform', 'rotate(90)')
        .attr('text-anchor', 'start')
        .attr('x', 5);
    } else if(this.layout === 'horizontal'){
      text
        .attr('transform', 'rotate(0)')
        .attr('text-anchor', 'start')
        .attr('x', 5);
    } else {
      text
        .attr('transform', l => 'rotate('+(l.x / Math.PI * 180 % 180 - 90)+')')
        .attr('text-anchor', l => l.x % (2*Math.PI) > Math.PI ? 'end' : 'start')
        .attr('x', l => l.x % (2*Math.PI) > Math.PI ? -5 : 5);
    }

		return this;
	};

  /**
   * Update the TidyTree's underlying data structure
   * There are two contexts in which you should call this:
   * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
   * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
   * @param  {string} newick A valid newick string
   * @return {object}        the TidyTree object
   */
  TidyTree.prototype.setTree = function(newick){
		if(newick){
			this.tree = patristic.parseNewick(newick);
		}
		this.hierarchy = d3.hierarchy(this.tree, d => d.children);
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

	/**
	 * Set the TidyTree's layout
	 * @param  {string} newLayout The new layout
	 * @return {TidyTree}         The TidyTree Object
	 */
	TidyTree.prototype.setLayout = function(newLayout){
    if(!TidyTree.validLayouts.includes(newLayout)){
			console.error('Cannot set TidyTree to layout:', newLayout, '\nValid layouts are:', TidyTree.validLayouts);
			return;
		}
		this.layout = newLayout;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

	/**
	 * Set the TidyTree's mode
	 * @param  {string}   newMode The new mode
	 * @return {TidyTree}         The TidyTree object
	 */
  TidyTree.prototype.setMode = function(newMode){
    if(!TidyTree.validModes.includes(newMode)){
			console.error('Cannot set TidyTree to mode:', newMode, '\nValid modes are:', TidyTree.validModes);
			return;
    }
		this.mode = newMode;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

	/**
   * Set the TidyTree's type
   * @param  {boolean} newType The new type
   * @return {TidyTree}        the TidyTree object
   */
  TidyTree.prototype.setType = function(newType){
    if(!TidyTree.validTypes.includes(newType)){
			console.error('Cannot set TidyTree to type:', newType, '\nValid types are:', TidyTree.validTypes);
			return;
		}
		this.type = newType;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

  /**
   * Set the TidyTree's animation
   * Note that this does not trigger a redraw.
   * @param  {boolean} animation Should changes to the tree be animated?
   * @return {TidyTree}          the TidyTree object
   */
  TidyTree.prototype.setAnimation = function(animation){
		this.animation = animation ? true : false;
    return this;
	};

  TidyTree.prototype.setLeafNodes = function(show){
    this.leafNodes = show ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

  /**
   * Set the TidyTree's leafLabels
   * @param  {boolean} show Should the TidyTree show leafLabels?
   * @return {TidyTree}     the TidyTree Object
   */
  TidyTree.prototype.setLeafLabels = function(show){
    this.leafLabels = show ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

  TidyTree.prototype.setBranchNodes = function(show){
    this.branchNodes = show ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

  /**
   * Set the TidyTree's branchLabels
   * @param  {boolean} show Should the TidyTree show branchLabels?
   * @return {TidyTree}     the TidyTree Object
   */
  TidyTree.prototype.setBranchLabels = function(show){
    this.branchLabels = show ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

  /**
   * Set the TidyTree's branchLabels
   * @param  {boolean} show Should the TidyTree show branchLabels?
   * @return {TidyTree}     the TidyTree Object
   */
  TidyTree.prototype.setBranchDistances = function(show){
    this.branchDistances = show ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
  };

	/**
	 * Set the TidyTree's distance
	 * @param  {boolean} distance Should the tree show its distances?
	 * @return {TidyTree}           the TidyTree Object
	 */
	TidyTree.prototype.setDistance = function(distance){
		this.distance = distance ? true : false;
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
	};

  return TidyTree;
}));
