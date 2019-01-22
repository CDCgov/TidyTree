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
   */
  function TidyTree(newick){
		var tree = patristic.parseNewick(newick);
		var hierarchy = d3.hierarchy(tree, d => d.children);
    Object.assign(this, {
			layout: 'vertical',
			type: 'tree',
      mode: 'smooth',
			inverted: false,
      distance: false,
			leafLabels: false,
			branchLabels: false,
      animation: true,
      tree,
			hierarchy
    });
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
  TidyTree.validModes = ['smooth', 'square'];

	var width = 960;
	var height = 500;
	var margin = {left: 100, top: 100, right: 50, bottom: 50}

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

		var tree = d3.tree();

		var parent = d3.select(selector);
		var svg = parent.append("svg")
		      .attr("width", "100%")
		      .attr("height", "100%");

		var g = svg.append("g").attr('transform','translate('+ margin.left +','+ margin.right +')');

		var zoom = d3.zoom().on("zoom", () => g.attr("transform", d3.event.transform));
    svg.call(zoom);

		// Set initial vertical Tree
		var link = g.selectAll(".link")
		    .data(tree(this.hierarchy).links())
		    .enter().append("path")
		      .attr("class", "link")
			  .attr("fill","none")
			  .attr("stroke","#ccc")
		      .attr("d", smoothLinkTransformers[this.layout]);

		var node = g.selectAll(".node")
		  .data(this.hierarchy.descendants())
		  .enter().append("g")
		    .attr("class", function(d) { return "node" + (d.children ? " node--internal" : " node--leaf"); });

		node.append("circle")
			.attr("r", 2.5);

		node.append("text")
	   .text(function(d) { return d.data.id; })
		 .attr('y',-10)
		 .attr('x',-10)
		 .attr('text-anchor','middle');

		this.redraw();

		return this;
  };

	var smoothLinkTransformers = {
		vertical: d3.linkVertical().x(d => d.x).y(d => d.y),
		horizontal: d3.linkHorizontal().x(d => d.y).y(d => d.x),
		circular: d3.linkRadial().angle(d => d.x).radius(d => d.y)
	};

	var squareLinkTransformers = {
		vertical: d => `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
		horizontal: d => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
		circular: d => {
			var startAngle = d.source.x / 180 * Math.PI,
					startRadius = d.source.y,
					endAngle = d.target.x / 180 * Math.PI,
					endRadius = d.target.y;
			var c0 = Math.cos(startAngle),
					s0 = Math.sin(startAngle),
					c1 = Math.cos(endAngle),
					s1 = Math.sin(endAngle);
			return "M" + startRadius * c0 + "," + startRadius * s0
					+ (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
					+ "L" + endRadius * c1 + "," + endRadius * s1;
		}
	};

	function circularPoint(x, y){
		return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
	}

	var nodeTransformers = {
		vertical: d => "translate(" + d.x + "," + d.y + ")",
		horizontal: d => "translate(" + d.y + "," + d.x + ")",
		circular: function(d){
			return "translate(" + circularPoint(d.x, d.y) + ")";
		}
	};

	TidyTree.prototype.redraw = function(){
		var g = d3.select(this.parent).select('svg g');

		var source = this.type == 'tree' ? d3.tree() : d3.cluster();
    source.size(this.layout === 'circular' ?
			[2 * Math.PI, height/2] :
			[height-margin.top-margin.bottom,width-margin.left-margin.right]
		);

		var dt = this.animation ? 800 : 0;

		g.selectAll('.link')
			.data(source(this.hierarchy).links())
			.transition()
			.attr("d", tree.mode === 'smooth' ?
				smoothLinkTransformers[this.layout] :
				squareLinkTransformers[this.layout]
			)
			.duration(dt);

		var node = g.selectAll('.node')

		node
			.transition()
			.attr("transform", nodeTransformers[this.layout])
			.duration(dt);

		var showLeafLabels = this.leafLabels, showBranchLabels = this.branchLabels;
		node
			.selectAll('text')
			.transition()
			.style('display', d => {
				if((d.children && showBranchLabels) || (!d.children && showLeafLabels)) return 'block';
				return 'none';
			})
			.duration(dt);

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
	 * Set the TidyTree's inversion
	 * @param  {boolean} inversion Should the tree be inverted?
	 * @return {TidyTree}           the TidyTree Object
	 */
	TidyTree.prototype.setInverted = function(inversion){
		if(inversion){
			this.inverted = true;
		} else {
			this.inverted = false;
		}
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
	};

	TidyTree.prototype.setAnimate = function(animate){
		if(animate){
			this.animate = true;
		} else {
			this.animate = false;
		}
    return this;
	};

	/**
	 * Set the TidyTree's distance
	 * @param  {boolean} inversion Should the tree show its distances?
	 * @return {TidyTree}           the TidyTree Object
	 */
	TidyTree.prototype.setDistance = function(distance){
		if(distance){
			this.distance = true;
		} else {
			this.distance = false;
		}
    if(this.parent){ //i.e. has already been drawn
      this.redraw();
    }
    return this;
	};

  return TidyTree;
}));
