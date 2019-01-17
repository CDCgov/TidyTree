(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function(){ return (root.Dtree = factory()); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Dtree = factory();
  }
}(typeof self !== 'undefined' ? self : this, function(){
  "use strict";

  /**
   * This class function creates a Dtree object.
   * @param {string} newick A valid newick string
   * @returns {Dtree} a Dtree object representing the newick tree
   */
  function Dtree(newick){
    Object.assign(this, {
      mode: 'square',
      layout: 'circular',
      distance: false,
      animation: true,
      tree: patristic.parseNewick(newick)
    });
  }

  Dtree.validModes = ['smooth', 'square'];
  Dtree.validLayouts = ['circular', 'radial', 'hierarchical', 'vertical', 'horizontal', 'inverted'];

  Dtree.prototype.draw = function(selector){
    if(!selector && !this.parent){
      console.error("No valid target for drawing given! Where should the tree go?");
    }
    if(!selector) selector = this.parent;
    if(!this.parent) this.parent = selector;
    if(!this.outerRadius) this.outerRadius = 480;
    if(!this.innerRadius) this.innerRadius = 310;

    var innerRadius = this.innerRadius,
        mode = this.mode,
        layout = this.layout;

    var svg = d3.select(selector).append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

    var cluster = d3.cluster()
        .size([360, this.innerRadius])
        .separation(a => 1);

    var chart = svg.append("g");

    var zoom = d3.zoom().on("zoom", () => chart.attr("transform", d3.event.transform));
    svg.call(zoom);

    svg.transition().duration(1000).call(zoom.transform, () => d3.zoomIdentity.translate(this.outerRadius, this.outerRadius));

    this.hierarchy = d3.hierarchy(this.tree, d => d.children)
        .sum(d => d.children ? 0 : 1)
        .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));

    cluster(this.hierarchy);

    setRadius(this.hierarchy, this.hierarchy.data.length = 0, this.innerRadius / maxLength(this.hierarchy));

    this.linkExtension = chart.append("g")
        .attr("class", "link-extensions")
      .selectAll("path")
      .data(this.hierarchy.links().filter(d => !d.target.children))
      .enter().append("path")
        .each(function(d){ d.target.linkExtensionNode = this; });

    this.link = chart.append("g")
        .attr("class", "links")
      .selectAll("path")
      .data(this.hierarchy.links())
      .enter().append("path")
        .each(function(d) { d.target.linkNode = this; });

    chart.append("g")
        .attr("class", "labels")
      .selectAll("text")
      .data(this.hierarchy.leaves())
      .enter().append("text")
        .attr("dy", ".31em")
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .text(d => d.data.id)
        .on("mouseover", mouseovered(true))
        .on("mouseout", mouseovered(false));

    function moveToFront(){
      this.parentNode.appendChild(this);
    }

    function mouseovered(active){
      return function(d) {
        d3.select(this).classed("label--active", active);
        d3.select(d.linkExtensionNode).classed("link-extension--active", active).each(moveToFront);
        do d3.select(d.linkNode).classed("link--active", active).each(moveToFront); while (d = d.parent);
      };
    }

    // Compute the maximum cumulative length of any node in the tree.
    function maxLength(d){
      return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
    }

    // Set the radius of each node by recursively summing and scaling the distance from the hierarchy.
    function setRadius(d, y0, k){
      d.radius = (y0 += d.data.length) * k;
      if(d.children) d.children.forEach(d => setRadius(d, y0, k));
    }

    this.redraw();
  };

  Dtree.prototype._setLabelTransform = function(){
    var innerRadius = this.innerRadius;
    var labels = d3.select(this.parent + " .labels").selectAll("text").data(this.hierarchy.leaves());
    if(this.layout == 'circular'){
      labels.attr("transform", function(d){
        return "rotate(" + (d.x - 90) + ")translate(" + (innerRadius + 4) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
      });
    } else {
      labels.attr("transform", function(d){
        return "translate(" + d.x + "," + d.y + ")";
      });
    }
  };

  Dtree.prototype.setTree = function(newick){
    this.tree = patristic.parseNewick(newick);
  };

  Dtree.prototype.redraw = function(){
    this._setLabelTransform();
    var innerRadius = this.innerRadius;
    var t = d3.transition().duration(this.animation ? 750 : 0);
    var mode = this.mode;
    if(this.distance){
      this.linkExtension.transition(t).attr("d", d => _linkStep(d.target.x, d.target.radius, d.target.x, innerRadius, mode));
      this.link.transition(t).attr("d", d => _linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius, mode));
    } else {
      this.linkExtension.transition(t).attr("d", d => _linkStep(d.target.x, d.target.y, d.target.x, innerRadius, mode));
      this.link.transition(t).attr("d", d => _linkStep(d.source.x, d.source.y, d.target.x, d.target.y, mode));
    }
    return this;
  };

  Dtree.prototype.setDistance = function(dist){
    this.distance = dist;
    this.redraw();
    return this;
  };

  Dtree.prototype.setMode = function(newMode){
    if(Dtree.validModes.includes(newMode)){
      this.mode = newMode;
    }
    //Three of the next four lines are a hack to prevent a boatload of errors from trying to animate the construction of the circular tree with right angles.
    var animCache = this.animation;
    if(newMode == 'square') this.animation = false;
    this.redraw();
    if(newMode == 'square') this.animation = animCache;
    return this;
  };

  Dtree.prototype.setLayout = function(newMode){
    if(Dtree.validLayouts.includes(newMode)){
      this.mode = newMode;
    }
    this.redraw();
    return this;
  };

  function _linkStep(startAngle, startRadius, endAngle, endRadius, mode){
    if(!mode) mode = 'smooth';
    startAngle = startAngle / 180 * Math.PI;
    endAngle = endAngle / 180 * Math.PI;
    if(mode === 'smooth'){
      return d3.linkRadial()({
        source: [startAngle, startRadius],
        target: [endAngle, endRadius]
      });
    }
    if(mode === 'square'){
      var c0 = Math.cos(startAngle = startAngle - Math.PI/2),
          s0 = Math.sin(startAngle),
          c1 = Math.cos(endAngle = endAngle - Math.PI/2),
          s1 = Math.sin(endAngle);
      return "M" + startRadius * c0 + "," + startRadius * s0
        + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
        + "L" + endRadius * c1 + "," + endRadius * s1;
    }
  }

  return Dtree;
}));
