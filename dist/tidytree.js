var TidyTree = (function () {
  'use strict';

  // https://d3js.org/d3-array/ v3.2.5 Copyright 2010-2026 Mike Bostock
  function ascending$1(a, b) {
    return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function descending(a, b) {
    return a == null || b == null ? NaN
      : b < a ? -1
      : b > a ? 1
      : b >= a ? 0
      : NaN;
  }

  function bisector(f) {
    let compare1, compare2, delta;

    // If an accessor is specified, promote it to a comparator. In this case we
    // can test whether the search value is (self-) comparable. We can’t do this
    // for a comparator (except for specific, known comparators) because we can’t
    // tell if the comparator is symmetric, and an asymmetric comparator can’t be
    // used to test whether a single value is comparable.
    if (f.length !== 2) {
      compare1 = ascending$1;
      compare2 = (d, x) => ascending$1(f(d), x);
      delta = (d, x) => f(d) - x;
    } else {
      compare1 = f === ascending$1 || f === descending ? f : zero$1;
      compare2 = f;
      delta = f;
    }

    function left(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = (lo + hi) >>> 1;
          if (compare2(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }

    function right(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = (lo + hi) >>> 1;
          if (compare2(a[mid], x) <= 0) lo = mid + 1;
          else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }

    function center(a, x, lo = 0, hi = a.length) {
      const i = left(a, x, lo, hi - 1);
      return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
    }

    return {left, center, right};
  }

  function zero$1() {
    return 0;
  }

  function number$3(x) {
    return x === null ? NaN : +x;
  }

  const ascendingBisect = bisector(ascending$1);
  const bisectRight = ascendingBisect.right;
  bisector(number$3).center;

  const e10 = Math.sqrt(50),
      e5 = Math.sqrt(10),
      e2 = Math.sqrt(2);

  function tickSpec(start, stop, count) {
    const step = (stop - start) / Math.max(0, count),
        power = Math.floor(Math.log10(step)),
        error = step / Math.pow(10, power),
        factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
    let i1, i2, inc;
    if (power < 0) {
      inc = Math.pow(10, -power) / factor;
      i1 = Math.round(start * inc);
      i2 = Math.round(stop * inc);
      if (i1 / inc < start) ++i1;
      if (i2 / inc > stop) --i2;
      inc = -inc;
    } else {
      inc = Math.pow(10, power) * factor;
      i1 = Math.round(start / inc);
      i2 = Math.round(stop / inc);
      if (i1 * inc < start) ++i1;
      if (i2 * inc > stop) --i2;
    }
    if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
    return [i1, i2, inc];
  }

  function ticks(start, stop, count) {
    stop = +stop, start = +start, count = +count;
    if (!(count > 0)) return [];
    if (start === stop) return [start];
    const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
    if (!(i2 >= i1)) return [];
    const n = i2 - i1 + 1, ticks = new Array(n);
    if (reverse) {
      if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) / -inc;
      else for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) * inc;
    } else {
      if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) / -inc;
      else for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) * inc;
    }
    return ticks;
  }

  function tickIncrement(start, stop, count) {
    stop = +stop, start = +start, count = +count;
    return tickSpec(start, stop, count)[2];
  }

  function tickStep(start, stop, count) {
    stop = +stop, start = +start, count = +count;
    const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
    return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
  }

  // https://d3js.org/d3-axis/ v3.0.1 Copyright 2010-2026 Mike Bostock
  function identity$4(x) {
    return x;
  }

  var top = 1,
      right = 2,
      bottom = 3,
      left = 4,
      epsilon$2 = 1e-6;

  function translateX(x) {
    return "translate(" + x + ",0)";
  }

  function translateY(y) {
    return "translate(0," + y + ")";
  }

  function number$2(scale) {
    return d => +scale(d);
  }

  function center(scale, offset) {
    offset = Math.max(0, scale.bandwidth() - offset * 2) / 2;
    if (scale.round()) offset = Math.round(offset);
    return d => +scale(d) + offset;
  }

  function entering() {
    return !this.__axis;
  }

  function axis(orient, scale) {
    var tickArguments = [],
        tickValues = null,
        tickFormat = null,
        tickSizeInner = 6,
        tickSizeOuter = 6,
        tickPadding = 3,
        offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5,
        k = orient === top || orient === left ? -1 : 1,
        x = orient === left || orient === right ? "x" : "y",
        transform = orient === top || orient === bottom ? translateX : translateY;

    function axis(context) {
      var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
          format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity$4) : tickFormat,
          spacing = Math.max(tickSizeInner, 0) + tickPadding,
          range = scale.range(),
          range0 = +range[0] + offset,
          range1 = +range[range.length - 1] + offset,
          position = (scale.bandwidth ? center : number$2)(scale.copy(), offset),
          selection = context.selection ? context.selection() : context,
          path = selection.selectAll(".domain").data([null]),
          tick = selection.selectAll(".tick").data(values, scale).order(),
          tickExit = tick.exit(),
          tickEnter = tick.enter().append("g").attr("class", "tick"),
          line = tick.select("line"),
          text = tick.select("text");

      path = path.merge(path.enter().insert("path", ".tick")
          .attr("class", "domain")
          .attr("stroke", "currentColor"));

      tick = tick.merge(tickEnter);

      line = line.merge(tickEnter.append("line")
          .attr("stroke", "currentColor")
          .attr(x + "2", k * tickSizeInner));

      text = text.merge(tickEnter.append("text")
          .attr("fill", "currentColor")
          .attr(x, k * spacing)
          .attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

      if (context !== selection) {
        path = path.transition(context);
        tick = tick.transition(context);
        line = line.transition(context);
        text = text.transition(context);

        tickExit = tickExit.transition(context)
            .attr("opacity", epsilon$2)
            .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d + offset) : this.getAttribute("transform"); });

        tickEnter
            .attr("opacity", epsilon$2)
            .attr("transform", function(d) { var p = this.parentNode.__axis; return transform((p && isFinite(p = p(d)) ? p : position(d)) + offset); });
      }

      tickExit.remove();

      path
          .attr("d", orient === left || orient === right
              ? (tickSizeOuter ? "M" + k * tickSizeOuter + "," + range0 + "H" + offset + "V" + range1 + "H" + k * tickSizeOuter : "M" + offset + "," + range0 + "V" + range1)
              : (tickSizeOuter ? "M" + range0 + "," + k * tickSizeOuter + "V" + offset + "H" + range1 + "V" + k * tickSizeOuter : "M" + range0 + "," + offset + "H" + range1));

      tick
          .attr("opacity", 1)
          .attr("transform", function(d) { return transform(position(d) + offset); });

      line
          .attr(x + "2", k * tickSizeInner);

      text
          .attr(x, k * spacing)
          .text(format);

      selection.filter(entering)
          .attr("fill", "none")
          .attr("font-size", 10)
          .attr("font-family", "sans-serif")
          .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

      selection
          .each(function() { this.__axis = position; });
    }

    axis.scale = function(_) {
      return arguments.length ? (scale = _, axis) : scale;
    };

    axis.ticks = function() {
      return tickArguments = Array.from(arguments), axis;
    };

    axis.tickArguments = function(_) {
      return arguments.length ? (tickArguments = _ == null ? [] : Array.from(_), axis) : tickArguments.slice();
    };

    axis.tickValues = function(_) {
      return arguments.length ? (tickValues = _ == null ? null : Array.from(_), axis) : tickValues && tickValues.slice();
    };

    axis.tickFormat = function(_) {
      return arguments.length ? (tickFormat = _, axis) : tickFormat;
    };

    axis.tickSize = function(_) {
      return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
    };

    axis.tickSizeInner = function(_) {
      return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
    };

    axis.tickSizeOuter = function(_) {
      return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
    };

    axis.tickPadding = function(_) {
      return arguments.length ? (tickPadding = +_, axis) : tickPadding;
    };

    axis.offset = function(_) {
      return arguments.length ? (offset = +_, axis) : offset;
    };

    return axis;
  }

  function axisBottom(scale) {
    return axis(bottom, scale);
  }

  function axisLeft(scale) {
    return axis(left, scale);
  }

  // https://d3js.org/d3-dispatch/ v3.0.2 Copyright 2010-2026 Mike Bostock
  var noop$1 = {value: () => {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _) || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames$1(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames$1(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get$1(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set$1(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop$1, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  // https://d3js.org/d3-selection/ v3.0.1 Copyright 2010-2026 Mike Bostock
  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name; // eslint-disable-line no-prototype-builtins
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection$1(subgroups, this._parents);
  }

  // Given something array like (or null), returns something that is strictly an
  // array. This is used to ensure that array-like objects passed to d3.selectAll
  // or selection.selectAll are converted into proper arrays when creating a
  // selection; we don’t ever want to create a selection backed by a live
  // HTMLCollection or NodeList. However, note that selection.selectAll will use a
  // static NodeList as a group, since it safely derived from querySelectorAll.
  function array(x) {
    return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function arrayAll(select) {
    return function() {
      return array(select.apply(this, arguments));
    };
  }

  function selection_selectAll(select) {
    if (typeof select === "function") select = arrayAll(select);
    else select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection$1(subgroups, parents);
  }

  function matcher(selector) {
    return function() {
      return this.matches(selector);
    };
  }

  function childMatcher(selector) {
    return function(node) {
      return node.matches(selector);
    };
  }

  var find = Array.prototype.find;

  function childFind(match) {
    return function() {
      return find.call(this.children, match);
    };
  }

  function childFirst() {
    return this.firstElementChild;
  }

  function selection_selectChild(match) {
    return this.select(match == null ? childFirst
        : childFind(typeof match === "function" ? match : childMatcher(match)));
  }

  var filter = Array.prototype.filter;

  function children() {
    return Array.from(this.children);
  }

  function childrenFilter(match) {
    return function() {
      return filter.call(this.children, match);
    };
  }

  function selection_selectChildren(match) {
    return this.selectAll(match == null ? children
        : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
  }

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection$1(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection$1(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant$3(x) {
    return function() {
      return x;
    };
  }

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = new Map,
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
        if (nodeByKeyValue.has(keyValue)) {
          exit[i] = node;
        } else {
          nodeByKeyValue.set(keyValue, node);
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = key.call(parent, data[i], i, data) + "";
      if (node = nodeByKeyValue.get(keyValue)) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue.delete(keyValue);
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
        exit[i] = node;
      }
    }
  }

  function datum(node) {
    return node.__data__;
  }

  function selection_data(value, key) {
    if (!arguments.length) return Array.from(this, datum);

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant$3(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = arraylike(value.call(parent, parent && parent.__data__, j, parents)),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection$1(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  // Given some data, this returns an array-like view of it: an object that
  // exposes a length property and allows numeric indexing. Note that unlike
  // selectAll, this isn’t worried about “live” collections because the resulting
  // array will only be used briefly while data is being bound. (It is possible to
  // cause the data to change while iterating by using a key function, but please
  // don’t; we’d rather avoid a gratuitous copy.)
  function arraylike(data) {
    return typeof data === "object" && "length" in data
      ? data // Array, TypedArray, NodeList, array-like
      : Array.from(data); // Map, Set, iterable, string, or anything else
  }

  function selection_exit() {
    return new Selection$1(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_join(onenter, onupdate, onexit) {
    var enter = this.enter(), update = this, exit = this.exit();
    if (typeof onenter === "function") {
      enter = onenter(enter);
      if (enter) enter = enter.selection();
    } else {
      enter = enter.append(onenter + "");
    }
    if (onupdate != null) {
      update = onupdate(update);
      if (update) update = update.selection();
    }
    if (onexit == null) exit.remove(); else onexit(exit);
    return enter && update ? enter.merge(update).order() : update;
  }

  function selection_merge(context) {
    var selection = context.selection ? context.selection() : context;

    for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection$1(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection$1(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    return Array.from(this);
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    let size = 0;
    for (const node of this) ++size; // eslint-disable-line no-unused-vars
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove$1(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS$1(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant$1(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS$1(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction$1(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS$1(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS$1 : attrRemove$1) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove$1(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction$1(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove$1 : typeof value === "function"
              ? styleFunction$1
              : styleConstant$1)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction$1
            : textConstant$1)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    var clone = this.cloneNode(false), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }

  function selection_cloneDeep() {
    var clone = this.cloneNode(true), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  function contextListener(listener) {
    return function(event) {
      listener.call(this, event, this.__data__);
    };
  }

  function parseTypenames(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, options) {
    return function() {
      var on = this.__on, o, listener = contextListener(value);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
          this.addEventListener(o.type, o.listener = listener, o.options = options);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, options);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, options: options};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, options) {
    var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
    return this;
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  function* selection_iterator() {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) yield node;
      }
    }
  }

  var root = [null];

  function Selection$1(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection$1([[document.documentElement]], root);
  }

  function selection_selection() {
    return this;
  }

  Selection$1.prototype = selection.prototype = {
    constructor: Selection$1,
    select: selection_select,
    selectAll: selection_selectAll,
    selectChild: selection_selectChild,
    selectChildren: selection_selectChildren,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    join: selection_join,
    merge: selection_merge,
    selection: selection_selection,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch,
    [Symbol.iterator]: selection_iterator
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection$1([[document.querySelector(selector)]], [document.documentElement])
        : new Selection$1([[selector]], root);
  }

  var nextId = 0;

  function Local() {
    this._ = "@" + (++nextId).toString(36);
  }

  Local.prototype = {
    constructor: Local,
    get: function(node) {
      var id = this._;
      while (!(id in node)) if (!(node = node.parentNode)) return;
      return node[id];
    },
    set: function(node, value) {
      return node[this._] = value;
    },
    remove: function(node) {
      return this._ in node && delete node[this._];
    },
    toString: function() {
      return this._;
    }
  };

  function sourceEvent(event) {
    let sourceEvent;
    while (sourceEvent = event.sourceEvent) event = sourceEvent;
    return event;
  }

  function pointer(event, node) {
    event = sourceEvent(event);
    if (node === undefined) node = event.currentTarget;
    if (node) {
      var svg = node.ownerSVGElement || node;
      if (svg.createSVGPoint) {
        var point = svg.createSVGPoint();
        point.x = event.clientX, point.y = event.clientY;
        point = point.matrixTransform(node.getScreenCTM().inverse());
        return [point.x, point.y];
      }
      if (node.getBoundingClientRect) {
        var rect = node.getBoundingClientRect();
        return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
      }
    }
    return [event.pageX, event.pageY];
  }

  // https://d3js.org/d3-drag/ v3.0.1 Copyright 2010-2026 Mike Bostock
  const nonpassivecapture = {capture: true, passive: false};

  function noevent$1(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function nodrag(view) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", noevent$1, nonpassivecapture);
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", noevent$1, nonpassivecapture);
    } else {
      root.__noselect = root.style.MozUserSelect;
      root.style.MozUserSelect = "none";
    }
  }

  function yesdrag(view, noclick) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", null);
    if (noclick) {
      selection.on("click.drag", noevent$1, nonpassivecapture);
      setTimeout(function() { selection.on("click.drag", null); }, 0);
    }
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", null);
    } else {
      root.style.MozUserSelect = root.__noselect;
      delete root.__noselect;
    }
  }

  // https://d3js.org/d3-color/ v3.1.1 Copyright 2010-2026 Mike Bostock
  function define(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex = /^#([0-9a-f]{3,8})$/,
      reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
      reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
      reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
      reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
      reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
      reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define(Color, color, {
    copy(channels) {
      return Object.assign(new this.constructor, this, channels);
    },
    displayable() {
      return this.rgb().displayable();
    },
    hex: color_formatHex, // Deprecated! Use color.formatHex.
    formatHex: color_formatHex,
    formatHex8: color_formatHex8,
    formatHsl: color_formatHsl,
    formatRgb: color_formatRgb,
    toString: color_formatRgb
  });

  function color_formatHex() {
    return this.rgb().formatHex();
  }

  function color_formatHex8() {
    return this.rgb().formatHex8();
  }

  function color_formatHsl() {
    return hslConvert(this).formatHsl();
  }

  function color_formatRgb() {
    return this.rgb().formatRgb();
  }

  function color(format) {
    var m, l;
    format = (format + "").trim().toLowerCase();
    return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
        : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
        : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
        : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
        : null) // invalid hex
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb$1(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Rgb, rgb$1, extend(Color, {
    brighter(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb() {
      return this;
    },
    clamp() {
      return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
    },
    displayable() {
      return (-0.5 <= this.r && this.r < 255.5)
          && (-0.5 <= this.g && this.g < 255.5)
          && (-0.5 <= this.b && this.b < 255.5)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: rgb_formatHex, // Deprecated! Use color.formatHex.
    formatHex: rgb_formatHex,
    formatHex8: rgb_formatHex8,
    formatRgb: rgb_formatRgb,
    toString: rgb_formatRgb
  }));

  function rgb_formatHex() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
  }

  function rgb_formatHex8() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
  }

  function rgb_formatRgb() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
  }

  function clampa(opacity) {
    return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
  }

  function clampi(value) {
    return Math.max(0, Math.min(255, Math.round(value) || 0));
  }

  function hex(value) {
    value = clampi(value);
    return (value < 16 ? "0" : "") + value.toString(16);
  }

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hsl, hsl, extend(Color, {
    brighter(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    clamp() {
      return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
    },
    displayable() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    formatHsl() {
      const a = clampa(this.opacity);
      return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
    }
  }));

  function clamph(value) {
    value = (value || 0) % 360;
    return value < 0 ? value + 360 : value;
  }

  function clampt(value) {
    return Math.max(0, Math.min(1, value || 0));
  }

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  const radians = Math.PI / 180;
  const degrees$1 = 180 / Math.PI;

  // https://observablehq.com/@mbostock/lab-and-rgb
  const K = 18,
      Xn = 0.96422,
      Yn = 1,
      Zn = 0.82521,
      t0 = 4 / 29,
      t1 = 6 / 29,
      t2 = 3 * t1 * t1,
      t3 = t1 * t1 * t1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) return hcl2lab(o);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = rgb2lrgb(o.r),
        g = rgb2lrgb(o.g),
        b = rgb2lrgb(o.b),
        y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
    if (r === g && g === b) x = z = y; else {
      x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
      z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
    }
    return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
  }

  function lab(l, a, b, opacity) {
    return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
  }

  function Lab(l, a, b, opacity) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Lab, lab, extend(Color, {
    brighter(k) {
      return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    darker(k) {
      return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    rgb() {
      var y = (this.l + 16) / 116,
          x = isNaN(this.a) ? y : y + this.a / 500,
          z = isNaN(this.b) ? y : y - this.b / 200;
      x = Xn * lab2xyz(x);
      y = Yn * lab2xyz(y);
      z = Zn * lab2xyz(z);
      return new Rgb(
        lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
        lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
        this.opacity
      );
    }
  }));

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function lrgb2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2lrgb(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function hclConvert(o) {
    if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
    if (!(o instanceof Lab)) o = labConvert(o);
    if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);
    var h = Math.atan2(o.b, o.a) * degrees$1;
    return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
  }

  function hcl(h, c, l, opacity) {
    return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
  }

  function Hcl(h, c, l, opacity) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
    this.opacity = +opacity;
  }

  function hcl2lab(o) {
    if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
    var h = o.h * radians;
    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
  }

  define(Hcl, hcl, extend(Color, {
    brighter(k) {
      return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
    },
    darker(k) {
      return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
    },
    rgb() {
      return hcl2lab(this).rgb();
    }
  }));

  var A = -0.14861,
      B = 1.78277,
      C = -0.29227,
      D = -0.90649,
      E = 1.97294,
      ED = E * D,
      EB = E * B,
      BC_DA = B * C - D * A;

  function cubehelixConvert(o) {
    if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
        bl = b - l,
        k = (E * (g - l) - C * bl) / D,
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * degrees$1 - 120 : NaN;
    return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
  }

  function cubehelix$1(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Cubehelix, cubehelix$1, extend(Color, {
    brighter(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    darker(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    rgb() {
      var h = isNaN(this.h) ? 0 : (this.h + 120) * radians,
          l = +this.l,
          a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
          cosh = Math.cos(h),
          sinh = Math.sin(h);
      return new Rgb(
        255 * (l + a * (A * cosh + B * sinh)),
        255 * (l + a * (C * cosh + D * sinh)),
        255 * (l + a * (E * cosh)),
        this.opacity
      );
    }
  }));

  // https://d3js.org/d3-interpolate/ v3.0.2 Copyright 2010-2026 Mike Bostock

  var constant$2 = x => () => x;

  function linear$1(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function hue$1(a, b) {
    var d = b - a;
    return d ? linear$1(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$2(isNaN(a) ? b : a);
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$2(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear$1(a, d) : constant$2(isNaN(a) ? b : a);
  }

  var rgb = (function rgbGamma(y) {
    var color = gamma(y);

    function rgb(start, end) {
      var r = color((start = rgb$1(start)).r, (end = rgb$1(end)).r),
          g = color(start.g, end.g),
          b = color(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb.gamma = rgbGamma;

    return rgb;
  })(1);

  function numberArray(a, b) {
    if (!b) b = [];
    var n = a ? Math.min(b.length, a.length) : 0,
        c = b.slice(),
        i;
    return function(t) {
      for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
      return c;
    };
  }

  function isNumberArray(x) {
    return ArrayBuffer.isView(x) && !(x instanceof DataView);
  }

  function genericArray(a, b) {
    var nb = b ? b.length : 0,
        na = a ? Math.min(nb, a.length) : 0,
        x = new Array(na),
        c = new Array(nb),
        i;

    for (i = 0; i < na; ++i) x[i] = value(a[i], b[i]);
    for (; i < nb; ++i) c[i] = b[i];

    return function(t) {
      for (i = 0; i < na; ++i) c[i] = x[i](t);
      return c;
    };
  }

  function date(a, b) {
    var d = new Date;
    return a = +a, b = +b, function(t) {
      return d.setTime(a * (1 - t) + b * t), d;
    };
  }

  function number(a, b) {
    return a = +a, b = +b, function(t) {
      return a * (1 - t) + b * t;
    };
  }

  function object(a, b) {
    var i = {},
        c = {},
        k;

    if (a === null || typeof a !== "object") a = {};
    if (b === null || typeof b !== "object") b = {};

    for (k in b) {
      if (k in a) {
        i[k] = value(a[k], b[k]);
      } else {
        c[k] = b[k];
      }
    }

    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function string(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: number(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  function value(a, b) {
    var t = typeof b, c;
    return b == null || t === "boolean" ? constant$2(b)
        : (t === "number" ? number
        : t === "string" ? ((c = color(b)) ? (b = c, rgb) : string)
        : b instanceof color ? rgb
        : b instanceof Date ? date
        : isNumberArray(b) ? numberArray
        : Array.isArray(b) ? genericArray
        : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
        : number)(a, b);
  }

  function round(a, b) {
    return a = +a, b = +b, function(t) {
      return Math.round(a * (1 - t) + b * t);
    };
  }

  var degrees = 180 / Math.PI;

  var identity$3 = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };

  function decompose(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  var svgNode;

  /* eslint-disable no-undef */
  function parseCss(value) {
    const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
    return m.isIdentity ? identity$3 : decompose(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  function parseSvg(value) {
    if (value == null) return identity$3;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity$3;
    value = value.matrix;
    return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
  }

  function interpolateTransform(parse, pxComma, pxParen, degParen) {

    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }

    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }

    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
        q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number(a, b)});
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }

    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number(a, b)});
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }

    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }

    return function(a, b) {
      var s = [], // string constants and placeholders
          q = []; // number interpolators
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null; // gc
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }

  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  var epsilon2 = 1e-12;

  function cosh(x) {
    return ((x = Math.exp(x)) + 1 / x) / 2;
  }

  function sinh(x) {
    return ((x = Math.exp(x)) - 1 / x) / 2;
  }

  function tanh(x) {
    return ((x = Math.exp(2 * x)) - 1) / (x + 1);
  }

  var zoom$1 = (function zoomRho(rho, rho2, rho4) {

    // p0 = [ux0, uy0, w0]
    // p1 = [ux1, uy1, w1]
    function zoom(p0, p1) {
      var ux0 = p0[0], uy0 = p0[1], w0 = p0[2],
          ux1 = p1[0], uy1 = p1[1], w1 = p1[2],
          dx = ux1 - ux0,
          dy = uy1 - uy0,
          d2 = dx * dx + dy * dy,
          i,
          S;

      // Special case for u0 ≅ u1.
      if (d2 < epsilon2) {
        S = Math.log(w1 / w0) / rho;
        i = function(t) {
          return [
            ux0 + t * dx,
            uy0 + t * dy,
            w0 * Math.exp(rho * t * S)
          ];
        };
      }

      // General case.
      else {
        var d1 = Math.sqrt(d2),
            b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
            b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
            r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
            r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
        S = (r1 - r0) / rho;
        i = function(t) {
          var s = t * S,
              coshr0 = cosh(r0),
              u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
          return [
            ux0 + u * dx,
            uy0 + u * dy,
            w0 * coshr0 / cosh(rho * s + r0)
          ];
        };
      }

      i.duration = Math.abs(S) * 1000 * rho / Math.SQRT2;

      return i;
    }

    zoom.rho = function(_) {
      var _1 = Math.max(1e-3, +_), _2 = _1 * _1, _4 = _2 * _2;
      return zoomRho(_1, _2, _4);
    };

    return zoom;
  })(Math.SQRT2, 2, 4);

  function cubehelix(hue) {
    return (function cubehelixGamma(y) {
      y = +y;

      function cubehelix(start, end) {
        var h = hue((start = cubehelix$1(start)).h, (end = cubehelix$1(end)).h),
            s = nogamma(start.s, end.s),
            l = nogamma(start.l, end.l),
            opacity = nogamma(start.opacity, end.opacity);
        return function(t) {
          start.h = h(t);
          start.s = s(t);
          start.l = l(Math.pow(t, y));
          start.opacity = opacity(t);
          return start + "";
        };
      }

      cubehelix.gamma = cubehelixGamma;

      return cubehelix;
    })(1);
  }

  cubehelix(hue$1);
  cubehelix(nogamma);

  // https://d3js.org/d3-timer/ v3.0.2 Copyright 2010-2026 Mike Bostock
  var frame = 0, // is an animation frame pending?
      timeout$1 = 0, // is a timeout pending?
      interval$1 = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(undefined, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout$1 = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout$1) timeout$1 = clearTimeout(timeout$1);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout$1 = setTimeout(wake, Math.ceil(time - clock.now() - clockSkew) + 1);
      if (interval$1) interval$1 = clearInterval(interval$1);
    } else {
      if (!interval$1) clockLast = clock.now(), interval$1 = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(elapsed => {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  // https://d3js.org/d3-ease/ v3.0.2 Copyright 2010-2026 Mike Bostock, 2001 Robert Penner

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var exponent$1 = 3;

  ((function custom(e) {
    e = +e;

    function polyIn(t) {
      return Math.pow(t, e);
    }

    polyIn.exponent = custom;

    return polyIn;
  }))(exponent$1);

  ((function custom(e) {
    e = +e;

    function polyOut(t) {
      return 1 - Math.pow(1 - t, e);
    }

    polyOut.exponent = custom;

    return polyOut;
  }))(exponent$1);

  ((function custom(e) {
    e = +e;

    function polyInOut(t) {
      return ((t *= 2) <= 1 ? Math.pow(t, e) : 2 - Math.pow(2 - t, e)) / 2;
    }

    polyInOut.exponent = custom;

    return polyInOut;
  }))(exponent$1);

  // tpmt is two power minus ten times t scaled to [0,1]
  function tpmt(x) {
    return (Math.pow(2, -10 * x) - 0.0009765625) * 1.0009775171065494;
  }

  var overshoot = 1.70158;

  ((function custom(s) {
    s = +s;

    function backIn(t) {
      return (t = +t) * t * (s * (t - 1) + t);
    }

    backIn.overshoot = custom;

    return backIn;
  }))(overshoot);

  ((function custom(s) {
    s = +s;

    function backOut(t) {
      return --t * t * ((t + 1) * s + t) + 1;
    }

    backOut.overshoot = custom;

    return backOut;
  }))(overshoot);

  ((function custom(s) {
    s = +s;

    function backInOut(t) {
      return ((t *= 2) < 1 ? t * t * ((s + 1) * t - s) : (t -= 2) * t * ((s + 1) * t + s) + 2) / 2;
    }

    backInOut.overshoot = custom;

    return backInOut;
  }))(overshoot);

  var tau$1 = 2 * Math.PI,
      amplitude = 1,
      period = 0.3;

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$1);

    function elasticIn(t) {
      return a * tpmt(-(--t)) * Math.sin((s - t) / p);
    }

    elasticIn.amplitude = function(a) { return custom(a, p * tau$1); };
    elasticIn.period = function(p) { return custom(a, p); };

    return elasticIn;
  }))(amplitude, period);

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$1);

    function elasticOut(t) {
      return 1 - a * tpmt(t = +t) * Math.sin((t + s) / p);
    }

    elasticOut.amplitude = function(a) { return custom(a, p * tau$1); };
    elasticOut.period = function(p) { return custom(a, p); };

    return elasticOut;
  }))(amplitude, period);

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$1);

    function elasticInOut(t) {
      return ((t = t * 2 - 1) < 0
          ? a * tpmt(-t) * Math.sin((s - t) / p)
          : 2 - a * tpmt(t) * Math.sin((s + t) / p)) / 2;
    }

    elasticInOut.amplitude = function(a) { return custom(a, p * tau$1); };
    elasticInOut.period = function(p) { return custom(a, p); };

    return elasticInOut;
  }))(amplitude, period);

  // https://d3js.org/d3-transition/ v3.0.2 Copyright 2010-2026 Mike Bostock

  var emptyOn = dispatch("start", "end", "cancel", "interrupt");
  var emptyTween = [];

  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;

  function schedule(node, name, id, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id in schedules) return;
    create(node, id, {
      name: name,
      index: index, // For context during callback.
      group: group, // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }

  function init(node, id) {
    var schedule = get(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set(node, id) {
    var schedule = get(node, id);
    if (schedule.state > STARTED) throw new Error("too late; already running");
    return schedule;
  }

  function get(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create(node, id, self) {
    var schedules = node.__transition,
        tween;

    // Initialize the self timer when the transition is created.
    // Note the actual delay is not known until the first callback!
    schedules[id] = self;
    self.timer = timer(schedule, 0, self.time);

    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start, self.delay, self.time);

      // If the elapsed delay is less than our first sleep, start immediately.
      if (self.delay <= elapsed) start(elapsed - self.delay);
    }

    function start(elapsed) {
      var i, j, n, o;

      // If the state is not SCHEDULED, then we previously errored on start.
      if (self.state !== SCHEDULED) return stop();

      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;

        // While this element already has a starting transition during this frame,
        // defer starting an interrupting transition until that transition has a
        // chance to tick (and possibly end); see d3/d3-transition#54!
        if (o.state === STARTED) return timeout(start);

        // Interrupt the active transition, if any.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions.
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("cancel", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });

      // Dispatch the start event.
      // Note this must be done before the tween are initialized.
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return; // interrupted
      self.state = STARTED;

      // Initialize the tween, deleting null tween.
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }

    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
          i = -1,
          n = tween.length;

      while (++i < n) {
        tween[i].call(node, t);
      }

      // Dispatch the end event.
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }

    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id];
      for (var i in schedules) return;
      delete node.__transition;
    }
  }

  function interrupt(node, name) {
    var schedules = node.__transition,
        schedule,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule.state > STARTING && schedule.state < ENDING;
      schedule.state = ENDED;
      schedule.timer.stop();
      schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
      delete schedules[i];
    }

    if (empty) delete node.__transition;
  }

  function selection_interrupt(name) {
    return this.each(function() {
      interrupt(this, name);
    });
  }

  function tweenRemove(id, name) {
    var tween0, tween1;
    return function() {
      var schedule = set(this, id),
          tween = schedule.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }

      schedule.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule = set(this, id),
          tween = schedule.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }

      schedule.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get(this.node(), id).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }

    return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
  }

  function tweenValue(transition, name, value) {
    var id = transition._id;

    transition.each(function() {
      var schedule = set(this, id);
      (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get(node, id).value[name];
    };
  }

  function interpolate(a, b) {
    var c;
    return (typeof b === "number" ? number
        : b instanceof color ? rgb
        : (c = color(b)) ? (b = c, rgb)
        : string)(a, b);
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = this.getAttribute(name);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function attrConstantNS(fullname, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = this.getAttributeNS(fullname.space, fullname.local);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function attrFunction(name, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttribute(name);
      string0 = this.getAttribute(name);
      string1 = value1 + "";
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function attrFunctionNS(fullname, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      string0 = this.getAttributeNS(fullname.space, fullname.local);
      string1 = value1 + "";
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function transition_attr(name, value) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
    return this.attrTween(name, typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value))
        : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname)
        : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
  }

  function attrInterpolate(name, i) {
    return function(t) {
      this.setAttribute(name, i.call(this, t));
    };
  }

  function attrInterpolateNS(fullname, i) {
    return function(t) {
      this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
    };
  }

  function attrTweenNS(fullname, value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
      return t0;
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
      return t0;
    }
    tween._value = value;
    return tween;
  }

  function transition_attrTween(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    var fullname = namespace(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }

  function delayFunction(id, value) {
    return function() {
      init(this, id).delay = +value.apply(this, arguments);
    };
  }

  function delayConstant(id, value) {
    return value = +value, function() {
      init(this, id).delay = value;
    };
  }

  function transition_delay(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? delayFunction
            : delayConstant)(id, value))
        : get(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get(this.node(), id).ease;
  }

  function easeVarying(id, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (typeof v !== "function") throw new Error;
      set(this, id).ease = v;
    };
  }

  function transition_easeVarying(value) {
    if (typeof value !== "function") throw new Error;
    return this.each(easeVarying(this._id, value));
  }

  function transition_filter(match) {
    if (typeof match !== "function") match = matcher(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  function transition_merge(transition) {
    if (transition._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Transition(merges, this._parents, this._name, this._id);
  }

  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }

  function onFunction(id, name, listener) {
    var on0, on1, sit = start(name) ? init : set;
    return function() {
      var schedule = sit(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get(this.node(), id).on.on(name)
        : this.each(onFunction(id, name, listener));
  }

  function removeFunction(id) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id) return;
      if (parent) parent.removeChild(this);
    };
  }

  function transition_remove() {
    return this.on("end.remove", removeFunction(this._id));
  }

  function transition_select(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) {
            if (child = children[k]) {
              schedule(child, name, id, k, children, inherit);
            }
          }
          subgroups.push(children);
          parents.push(node);
        }
      }
    }

    return new Transition(subgroups, parents, name, id);
  }

  var Selection = selection.prototype.constructor;

  function transition_selection() {
    return new Selection(this._groups, this._parents);
  }

  function styleNull(name, interpolate) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0 = styleValue(this, name),
          string1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, string10 = string1);
    };
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = styleValue(this, name);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function styleFunction(name, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0 = styleValue(this, name),
          value1 = value(this),
          string1 = value1 + "";
      if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function styleMaybeRemove(id, name) {
    var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
    return function() {
      var schedule = set(this, id),
          on = schedule.on,
          listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : undefined;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);

      schedule.on = on1;
    };
  }

  function transition_style(name, value, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
    return value == null ? this
        .styleTween(name, styleNull(name, i))
        .on("end.style." + name, styleRemove(name))
      : typeof value === "function" ? this
        .styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value)))
        .each(styleMaybeRemove(this._id, name))
      : this
        .styleTween(name, styleConstant(name, i, value), priority)
        .on("end.style." + name, null);
  }

  function styleInterpolate(name, i, priority) {
    return function(t) {
      this.style.setProperty(name, i.call(this, t), priority);
    };
  }

  function styleTween(name, value, priority) {
    var t, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
      return t;
    }
    tween._value = value;
    return tween;
  }

  function transition_styleTween(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction(tweenValue(this, "text", value))
        : textConstant(value == null ? "" : value + ""));
  }

  function textInterpolate(i) {
    return function(t) {
      this.textContent = i.call(this, t);
    };
  }

  function textTween(value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
      return t0;
    }
    tween._value = value;
    return tween;
  }

  function transition_textTween(value) {
    var key = "text";
    if (arguments.length < 1) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, textTween(value));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get(node, id0);
          schedule(node, name, id1, i, group, {
            time: inherit.time + inherit.delay + inherit.duration,
            delay: 0,
            duration: inherit.duration,
            ease: inherit.ease
          });
        }
      }
    }

    return new Transition(groups, this._parents, name, id1);
  }

  function transition_end() {
    var on0, on1, that = this, id = that._id, size = that.size();
    return new Promise(function(resolve, reject) {
      var cancel = {value: reject},
          end = {value: function() { if (--size === 0) resolve(); }};

      that.each(function() {
        var schedule = set(this, id),
            on = schedule.on;

        // If this node shared a dispatch with the previous node,
        // just assign the updated shared dispatch and we’re done!
        // Otherwise, copy-on-write.
        if (on !== on0) {
          on1 = (on0 = on).copy();
          on1._.cancel.push(cancel);
          on1._.interrupt.push(cancel);
          on1._.end.push(end);
        }

        schedule.on = on1;
      });

      // The selection was empty, resolve end immediately
      if (size === 0) resolve();
    });
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = {
    constructor: Transition,
    select: transition_select,
    selectAll: transition_selectAll,
    selectChild: selection_prototype.selectChild,
    selectChildren: selection_prototype.selectChildren,
    filter: transition_filter,
    merge: transition_merge,
    selection: transition_selection,
    transition: transition_transition,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: transition_on,
    attr: transition_attr,
    attrTween: transition_attrTween,
    style: transition_style,
    styleTween: transition_styleTween,
    text: transition_text,
    textTween: transition_textTween,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease,
    easeVarying: transition_easeVarying,
    end: transition_end,
    [Symbol.iterator]: selection_prototype[Symbol.iterator]
  };

  var defaultTiming = {
    time: null, // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };

  function inherit(node, id) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id])) {
      if (!(node = node.parentNode)) {
        throw new Error(`transition ${id} not found`);
      }
    }
    return timing;
  }

  function selection_transition(name) {
    var id,
        timing;

    if (name instanceof Transition) {
      id = name._id, name = name._name;
    } else {
      id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule(node, name, id, i, group, timing || inherit(node, id));
        }
      }
    }

    return new Transition(groups, this._parents, name, id);
  }

  selection.prototype.interrupt = selection_interrupt;
  selection.prototype.transition = selection_transition;

  // https://d3js.org/d3-path/ v3.1.1 Copyright 2015-2026 Mike Bostock
  const pi = Math.PI,
      tau = 2 * pi,
      epsilon$1 = 1e-6,
      tauEpsilon = tau - epsilon$1;

  function append(strings) {
    this._ += strings[0];
    for (let i = 1, n = strings.length; i < n; ++i) {
      this._ += arguments[i] + strings[i];
    }
  }

  function appendRound(digits) {
    let d = Math.floor(digits);
    if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
    if (d > 15) return append;
    const k = 10 ** d;
    return function(strings) {
      this._ += strings[0];
      for (let i = 1, n = strings.length; i < n; ++i) {
        this._ += Math.round(arguments[i] * k) / k + strings[i];
      }
    };
  }

  function equal(x0, y0, x1, y1) {
    return x0 === x1 && y0 === y1;
  }

  function equalRound(digits) {
    const d = Math.floor(digits);
    if (!(d <= 15)) return equal;
    const k = 10 ** d;
    const r = function(value) {
      return Math.round(value * k);
    };
    return function(x0, y0, x1, y1) {
      return r(x0) === r(x1) && r(y0) === r(y1);
    };
  }

  class Path {
    constructor(digits) {
      this._x0 = this._y0 = // start of current subpath
      this._x1 = this._y1 = null; // end of current subpath
      this._ = "";
      this._append = digits == null ? append : appendRound(digits);
      this._equal = digits == null ? equal : equalRound(digits);
    }
    moveTo(x, y) {
      this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}`;
    }
    closePath() {
      if (this._x1 !== null) {
        this._x1 = this._x0, this._y1 = this._y0;
        this._append`Z`;
      }
    }
    lineTo(x, y) {
      this._append`L${this._x1 = +x},${this._y1 = +y}`;
    }
    quadraticCurveTo(x1, y1, x, y) {
      this._append`Q${+x1},${+y1},${this._x1 = +x},${this._y1 = +y}`;
    }
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      this._append`C${+x1},${+y1},${+x2},${+y2},${this._x1 = +x},${this._y1 = +y}`;
    }
    arcTo(x1, y1, x2, y2, r) {
      x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;

      // Is the radius negative? Error.
      if (r < 0) throw new Error(`negative radius: ${r}`);

      let x0 = this._x1,
          y0 = this._y1,
          x21 = x2 - x1,
          y21 = y2 - y1,
          x01 = x0 - x1,
          y01 = y0 - y1,
          l01_2 = x01 * x01 + y01 * y01;

      // Is this path empty? Move to (x1,y1).
      if (this._x1 === null) {
        this._append`M${this._x1 = x1},${this._y1 = y1}`;
      }

      // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
      else if (!(l01_2 > epsilon$1));

      // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
      // Equivalently, is (x1,y1) coincident with (x2,y2)?
      // Or, is the radius zero? Line to (x1,y1).
      else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$1) || !r) {
        this._append`L${this._x1 = x1},${this._y1 = y1}`;
      }

      // Otherwise, draw an arc!
      else {
        let x20 = x2 - x0,
            y20 = y2 - y0,
            l21_2 = x21 * x21 + y21 * y21,
            l20_2 = x20 * x20 + y20 * y20,
            l21 = Math.sqrt(l21_2),
            l01 = Math.sqrt(l01_2),
            l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
            t01 = l / l01,
            t21 = l / l21;

        // If the start tangent is not coincident with (x0,y0), line to.
        if (Math.abs(t01 - 1) > epsilon$1) {
          this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`;
        }

        this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
      }
    }
    arc(x, y, r, a0, a1, ccw) {
      x = +x, y = +y, r = +r, ccw = !!ccw;

      // Is the radius negative? Error.
      if (r < 0) throw new Error(`negative radius: ${r}`);

      let dx = r * Math.cos(a0),
          dy = r * Math.sin(a0),
          x0 = x + dx,
          y0 = y + dy,
          cw = 1 ^ ccw,
          da = ccw ? a0 - a1 : a1 - a0;

      // Is this path empty? Move to (x0,y0).
      if (this._x1 === null) {
        this._append`M${x0},${y0}`;
      }

      // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
      else if (Math.abs(this._x1 - x0) > epsilon$1 || Math.abs(this._y1 - y0) > epsilon$1) {
        this._append`L${x0},${y0}`;
      }

      // Is this arc empty? We’re done.
      if (!r) return;

      // Does the angle go the wrong way? Flip the direction.
      if (da < 0) da = da % tau + tau;

      // Is this a complete circle? Draw two arcs to complete the circle.
      if (da > tauEpsilon) {
        this._append`A${r},${r},0,1,${cw},${x - dx},${y - dy}A${r},${r},0,1,${cw},${this._x1 = x0},${this._y1 = y0}`;
      }

      // Is this arc non-empty? Draw an arc!
      else if (da > epsilon$1) {
        // If the start and end points are coincident after rounding, we need to draw two consecutive arcs.
        const x1 = x + r * Math.cos(a1);
        const y1 = y + r * Math.sin(a1);
        if (da >= pi && this._equal(x0, y0, x1, y1)) {
          da /= 2;
          let a00 = a0 + da;
          this._append`A${r},${r},0,${+(da >= pi)},${cw},${x + r * Math.cos(a00)},${y + r * Math.sin(a00)}`;
        }
        this._append`A${r},${r},0,${+(da >= pi)},${cw},${this._x1 = x1},${this._y1 = y1}`;
      }
    }
    rect(x, y, w, h) {
      this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}h${w = +w}v${+h}h${-w}Z`;
    }
    toString() {
      return this._;
    }
  }

  // https://d3js.org/d3-format/ v3.1.3 Copyright 2010-2026 Mike Bostock
  function formatDecimal(x) {
    return Math.abs(x = Math.round(x)) >= 1e21
        ? x.toLocaleString("en").replace(/,/g, "")
        : x.toString(10);
  }

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimalParts(1.23) returns ["123", 0].
  function formatDecimalParts(x, p) {
    if (!isFinite(x) || x === 0) return null; // NaN, ±Infinity, ±0
    var i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e"), coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }

  function exponent(x) {
    return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
  }

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  }

  function formatNumerals(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }

  // [[fill]align][sign][symbol][0][width][,][.precision][~][type]
  var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
    var match;
    return new FormatSpecifier({
      fill: match[1],
      align: match[2],
      sign: match[3],
      symbol: match[4],
      zero: match[5],
      width: match[6],
      comma: match[7],
      precision: match[8] && match[8].slice(1),
      trim: match[9],
      type: match[10]
    });
  }

  formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

  function FormatSpecifier(specifier) {
    this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
    this.align = specifier.align === undefined ? ">" : specifier.align + "";
    this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
    this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
    this.zero = !!specifier.zero;
    this.width = specifier.width === undefined ? undefined : +specifier.width;
    this.comma = !!specifier.comma;
    this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
    this.trim = !!specifier.trim;
    this.type = specifier.type === undefined ? "" : specifier.type + "";
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width === undefined ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
        + (this.trim ? "~" : "")
        + this.type;
  };

  // Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
  function formatTrim(s) {
    out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (s[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
      }
    }
    return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
  }

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return prefixExponent = undefined, x.toPrecision(p);
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  }

  function formatRounded(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }

  var formatTypes = {
    "%": (x, p) => (x * 100).toFixed(p),
    "b": (x) => Math.round(x).toString(2),
    "c": (x) => x + "",
    "d": formatDecimal,
    "e": (x, p) => x.toExponential(p),
    "f": (x, p) => x.toFixed(p),
    "g": (x, p) => x.toPrecision(p),
    "o": (x) => Math.round(x).toString(8),
    "p": (x, p) => formatRounded(x * 100, p),
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": (x) => Math.round(x).toString(16).toUpperCase(),
    "x": (x) => Math.round(x).toString(16)
  };

  function identity$2(x) {
    return x;
  }

  var map = Array.prototype.map,
      prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale(locale) {
    var group = locale.grouping === undefined || locale.thousands === undefined ? identity$2 : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
        currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
        currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
        decimal = locale.decimal === undefined ? "." : locale.decimal + "",
        numerals = locale.numerals === undefined ? identity$2 : formatNumerals(map.call(locale.numerals, String)),
        percent = locale.percent === undefined ? "%" : locale.percent + "",
        minus = locale.minus === undefined ? "−" : locale.minus + "",
        nan = locale.nan === undefined ? "NaN" : locale.nan + "";

    function newFormat(specifier, options) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          trim = specifier.trim,
          type = specifier.type;

      // The "n" type is an alias for ",g".
      if (type === "n") comma = true, type = "g";

      // The "" type, and any invalid type, is an alias for ".12~g".
      else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

      // If zero fill is specified, padding goes after sign and before digits.
      if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = (options && options.prefix !== undefined ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : ""),
          suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "") + (options && options.suffix !== undefined ? options.suffix : "");

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision === undefined ? 6
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      function format(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix,
            i, n, c;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Determine the sign. -0 is not less than 0, but 1 / -0 is!
          var valueNegative = value < 0 || 1 / value < 0;

          // Perform the initial formatting.
          value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

          // Trim insignificant zeros.
          if (trim) value = formatTrim(value);

          // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
          if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type === "s" && !isNaN(value) && prefixExponent !== undefined ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": value = valuePrefix + value + valueSuffix + padding; break;
          case "=": value = valuePrefix + padding + value + valueSuffix; break;
          case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
          default: value = padding + valuePrefix + value + valueSuffix; break;
        }

        return numerals(value);
      }

      format.toString = function() {
        return specifier + "";
      };

      return format;
    }

    function formatPrefix(specifier, value) {
      var e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
          k = Math.pow(10, -e),
          f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), {suffix: prefixes[8 + e / 3]});
      return function(value) {
        return f(k * value);
      };
    }

    return {
      format: newFormat,
      formatPrefix: formatPrefix
    };
  }

  var locale;
  var format;
  var formatPrefix;

  defaultLocale({
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    format = locale.format;
    formatPrefix = locale.formatPrefix;
    return locale;
  }

  function precisionFixed(step) {
    return Math.max(0, -exponent(Math.abs(step)));
  }

  function precisionPrefix(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
  }

  function precisionRound(step, max) {
    step = Math.abs(step), max = Math.abs(max) - step;
    return Math.max(0, exponent(max) - exponent(step)) + 1;
  }

  // https://d3js.org/d3-hierarchy/ v3.1.3 Copyright 2010-2026 Mike Bostock
  function defaultSeparation$1(a, b) {
    return a.parent === b.parent ? 1 : 2;
  }

  function meanX(children) {
    return children.reduce(meanXReduce, 0) / children.length;
  }

  function meanXReduce(x, c) {
    return x + c.x;
  }

  function maxY(children) {
    return 1 + children.reduce(maxYReduce, 0);
  }

  function maxYReduce(y, c) {
    return Math.max(y, c.y);
  }

  function leafLeft(node) {
    var children;
    while (children = node.children) node = children[0];
    return node;
  }

  function leafRight(node) {
    var children;
    while (children = node.children) node = children[children.length - 1];
    return node;
  }

  function cluster() {
    var separation = defaultSeparation$1,
        dx = 1,
        dy = 1,
        nodeSize = false;

    function cluster(root) {
      var previousNode,
          x = 0;

      // First walk, computing the initial x & y values.
      root.eachAfter(function(node) {
        var children = node.children;
        if (children) {
          node.x = meanX(children);
          node.y = maxY(children);
        } else {
          node.x = previousNode ? x += separation(node, previousNode) : 0;
          node.y = 0;
          previousNode = node;
        }
      });

      var left = leafLeft(root),
          right = leafRight(root),
          x0 = left.x - separation(left, right) / 2,
          x1 = right.x + separation(right, left) / 2;

      // Second walk, normalizing x & y to the desired size.
      return root.eachAfter(nodeSize ? function(node) {
        node.x = (node.x - root.x) * dx;
        node.y = (root.y - node.y) * dy;
      } : function(node) {
        node.x = (node.x - x0) / (x1 - x0) * dx;
        node.y = (1 - (root.y ? node.y / root.y : 1)) * dy;
      });
    }

    cluster.separation = function(x) {
      return arguments.length ? (separation = x, cluster) : separation;
    };

    cluster.size = function(x) {
      return arguments.length ? (nodeSize = false, dx = +x[0], dy = +x[1], cluster) : (nodeSize ? null : [dx, dy]);
    };

    cluster.nodeSize = function(x) {
      return arguments.length ? (nodeSize = true, dx = +x[0], dy = +x[1], cluster) : (nodeSize ? [dx, dy] : null);
    };

    return cluster;
  }

  function count(node) {
    var sum = 0,
        children = node.children,
        i = children && children.length;
    if (!i) sum = 1;
    else while (--i >= 0) sum += children[i].value;
    node.value = sum;
  }

  function node_count() {
    return this.eachAfter(count);
  }

  function node_each(callback, that) {
    let index = -1;
    for (const node of this) {
      callback.call(that, node, ++index, this);
    }
    return this;
  }

  function node_eachBefore(callback, that) {
    var node = this, nodes = [node], children, i, index = -1;
    while (node = nodes.pop()) {
      callback.call(that, node, ++index, this);
      if (children = node.children) {
        for (i = children.length - 1; i >= 0; --i) {
          nodes.push(children[i]);
        }
      }
    }
    return this;
  }

  function node_eachAfter(callback, that) {
    var node = this, nodes = [node], next = [], children, i, n, index = -1;
    while (node = nodes.pop()) {
      next.push(node);
      if (children = node.children) {
        for (i = 0, n = children.length; i < n; ++i) {
          nodes.push(children[i]);
        }
      }
    }
    while (node = next.pop()) {
      callback.call(that, node, ++index, this);
    }
    return this;
  }

  function node_find(callback, that) {
    let index = -1;
    for (const node of this) {
      if (callback.call(that, node, ++index, this)) {
        return node;
      }
    }
  }

  function node_sum(value) {
    return this.eachAfter(function(node) {
      var sum = +value(node.data) || 0,
          children = node.children,
          i = children && children.length;
      while (--i >= 0) sum += children[i].value;
      node.value = sum;
    });
  }

  function node_sort(compare) {
    return this.eachBefore(function(node) {
      if (node.children) {
        node.children.sort(compare);
      }
    });
  }

  function node_path(end) {
    var start = this,
        ancestor = leastCommonAncestor(start, end),
        nodes = [start];
    while (start !== ancestor) {
      start = start.parent;
      nodes.push(start);
    }
    var k = nodes.length;
    while (end !== ancestor) {
      nodes.splice(k, 0, end);
      end = end.parent;
    }
    return nodes;
  }

  function leastCommonAncestor(a, b) {
    if (a === b) return a;
    var aNodes = a.ancestors(),
        bNodes = b.ancestors(),
        c = null;
    a = aNodes.pop();
    b = bNodes.pop();
    while (a === b) {
      c = a;
      a = aNodes.pop();
      b = bNodes.pop();
    }
    return c;
  }

  function node_ancestors() {
    var node = this, nodes = [node];
    while (node = node.parent) {
      nodes.push(node);
    }
    return nodes;
  }

  function node_descendants() {
    return Array.from(this);
  }

  function node_leaves() {
    var leaves = [];
    this.eachBefore(function(node) {
      if (!node.children) {
        leaves.push(node);
      }
    });
    return leaves;
  }

  function node_links() {
    var root = this, links = [];
    root.each(function(node) {
      if (node !== root) { // Don’t include the root’s parent, if any.
        links.push({source: node.parent, target: node});
      }
    });
    return links;
  }

  function* node_iterator() {
    var node = this, current, next = [node], children, i, n;
    do {
      current = next.reverse(), next = [];
      while (node = current.pop()) {
        yield node;
        if (children = node.children) {
          for (i = 0, n = children.length; i < n; ++i) {
            next.push(children[i]);
          }
        }
      }
    } while (next.length);
  }

  function hierarchy(data, children) {
    if (data instanceof Map) {
      data = [undefined, data];
      if (children === undefined) children = mapChildren;
    } else if (children === undefined) {
      children = objectChildren;
    }

    var root = new Node$1(data),
        node,
        nodes = [root],
        child,
        childs,
        i,
        n;

    while (node = nodes.pop()) {
      if ((childs = children(node.data)) && (n = (childs = Array.from(childs)).length)) {
        node.children = childs;
        for (i = n - 1; i >= 0; --i) {
          nodes.push(child = childs[i] = new Node$1(childs[i]));
          child.parent = node;
          child.depth = node.depth + 1;
        }
      }
    }

    return root.eachBefore(computeHeight);
  }

  function node_copy() {
    return hierarchy(this).eachBefore(copyData);
  }

  function objectChildren(d) {
    return d.children;
  }

  function mapChildren(d) {
    return Array.isArray(d) ? d[1] : null;
  }

  function copyData(node) {
    if (node.data.value !== undefined) node.value = node.data.value;
    node.data = node.data.data;
  }

  function computeHeight(node) {
    var height = 0;
    do node.height = height;
    while ((node = node.parent) && (node.height < ++height));
  }

  function Node$1(data) {
    this.data = data;
    this.depth =
    this.height = 0;
    this.parent = null;
  }

  Node$1.prototype = hierarchy.prototype = {
    constructor: Node$1,
    count: node_count,
    each: node_each,
    eachAfter: node_eachAfter,
    eachBefore: node_eachBefore,
    find: node_find,
    sum: node_sum,
    sort: node_sort,
    path: node_path,
    ancestors: node_ancestors,
    descendants: node_descendants,
    leaves: node_leaves,
    links: node_links,
    copy: node_copy,
    [Symbol.iterator]: node_iterator
  };

  function treemapDice(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (x1 - x0) / parent.value;

    while (++i < n) {
      node = nodes[i], node.y0 = y0, node.y1 = y1;
      node.x0 = x0, node.x1 = x0 += node.value * k;
    }
  }

  function defaultSeparation(a, b) {
    return a.parent === b.parent ? 1 : 2;
  }

  // function radialSeparation(a, b) {
  //   return (a.parent === b.parent ? 1 : 2) / a.depth;
  // }

  // This function is used to traverse the left contour of a subtree (or
  // subforest). It returns the successor of v on this contour. This successor is
  // either given by the leftmost child of v or by the thread of v. The function
  // returns null if and only if v is on the highest level of its subtree.
  function nextLeft(v) {
    var children = v.children;
    return children ? children[0] : v.t;
  }

  // This function works analogously to nextLeft.
  function nextRight(v) {
    var children = v.children;
    return children ? children[children.length - 1] : v.t;
  }

  // Shifts the current subtree rooted at w+. This is done by increasing
  // prelim(w+) and mod(w+) by shift.
  function moveSubtree(wm, wp, shift) {
    var change = shift / (wp.i - wm.i);
    wp.c -= change;
    wp.s += shift;
    wm.c += change;
    wp.z += shift;
    wp.m += shift;
  }

  // All other shifts, applied to the smaller subtrees between w- and w+, are
  // performed by this function. To prepare the shifts, we have to adjust
  // change(w+), shift(w+), and change(w-).
  function executeShifts(v) {
    var shift = 0,
        change = 0,
        children = v.children,
        i = children.length,
        w;
    while (--i >= 0) {
      w = children[i];
      w.z += shift;
      w.m += shift;
      shift += w.s + (change += w.c);
    }
  }

  // If vi-’s ancestor is a sibling of v, returns vi-’s ancestor. Otherwise,
  // returns the specified (default) ancestor.
  function nextAncestor(vim, v, ancestor) {
    return vim.a.parent === v.parent ? vim.a : ancestor;
  }

  function TreeNode(node, i) {
    this._ = node;
    this.parent = null;
    this.children = null;
    this.A = null; // default ancestor
    this.a = this; // ancestor
    this.z = 0; // prelim
    this.m = 0; // mod
    this.c = 0; // change
    this.s = 0; // shift
    this.t = null; // thread
    this.i = i; // number
  }

  TreeNode.prototype = Object.create(Node$1.prototype);

  function treeRoot(root) {
    var tree = new TreeNode(root, 0),
        node,
        nodes = [tree],
        child,
        children,
        i,
        n;

    while (node = nodes.pop()) {
      if (children = node._.children) {
        node.children = new Array(n = children.length);
        for (i = n - 1; i >= 0; --i) {
          nodes.push(child = node.children[i] = new TreeNode(children[i], i));
          child.parent = node;
        }
      }
    }

    (tree.parent = new TreeNode(null, 0)).children = [tree];
    return tree;
  }

  // Node-link tree diagram using the Reingold-Tilford "tidy" algorithm
  function tree() {
    var separation = defaultSeparation,
        dx = 1,
        dy = 1,
        nodeSize = null;

    function tree(root) {
      var t = treeRoot(root);

      // Compute the layout using Buchheim et al.’s algorithm.
      t.eachAfter(firstWalk), t.parent.m = -t.z;
      t.eachBefore(secondWalk);

      // If a fixed node size is specified, scale x and y.
      if (nodeSize) root.eachBefore(sizeNode);

      // If a fixed tree size is specified, scale x and y based on the extent.
      // Compute the left-most, right-most, and depth-most nodes for extents.
      else {
        var left = root,
            right = root,
            bottom = root;
        root.eachBefore(function(node) {
          if (node.x < left.x) left = node;
          if (node.x > right.x) right = node;
          if (node.depth > bottom.depth) bottom = node;
        });
        var s = left === right ? 1 : separation(left, right) / 2,
            tx = s - left.x,
            kx = dx / (right.x + s + tx),
            ky = dy / (bottom.depth || 1);
        root.eachBefore(function(node) {
          node.x = (node.x + tx) * kx;
          node.y = node.depth * ky;
        });
      }

      return root;
    }

    // Computes a preliminary x-coordinate for v. Before that, FIRST WALK is
    // applied recursively to the children of v, as well as the function
    // APPORTION. After spacing out the children by calling EXECUTE SHIFTS, the
    // node v is placed to the midpoint of its outermost children.
    function firstWalk(v) {
      var children = v.children,
          siblings = v.parent.children,
          w = v.i ? siblings[v.i - 1] : null;
      if (children) {
        executeShifts(v);
        var midpoint = (children[0].z + children[children.length - 1].z) / 2;
        if (w) {
          v.z = w.z + separation(v._, w._);
          v.m = v.z - midpoint;
        } else {
          v.z = midpoint;
        }
      } else if (w) {
        v.z = w.z + separation(v._, w._);
      }
      v.parent.A = apportion(v, w, v.parent.A || siblings[0]);
    }

    // Computes all real x-coordinates by summing up the modifiers recursively.
    function secondWalk(v) {
      v._.x = v.z + v.parent.m;
      v.m += v.parent.m;
    }

    // The core of the algorithm. Here, a new subtree is combined with the
    // previous subtrees. Threads are used to traverse the inside and outside
    // contours of the left and right subtree up to the highest common level. The
    // vertices used for the traversals are vi+, vi-, vo-, and vo+, where the
    // superscript o means outside and i means inside, the subscript - means left
    // subtree and + means right subtree. For summing up the modifiers along the
    // contour, we use respective variables si+, si-, so-, and so+. Whenever two
    // nodes of the inside contours conflict, we compute the left one of the
    // greatest uncommon ancestors using the function ANCESTOR and call MOVE
    // SUBTREE to shift the subtree and prepare the shifts of smaller subtrees.
    // Finally, we add a new thread (if necessary).
    function apportion(v, w, ancestor) {
      if (w) {
        var vip = v,
            vop = v,
            vim = w,
            vom = vip.parent.children[0],
            sip = vip.m,
            sop = vop.m,
            sim = vim.m,
            som = vom.m,
            shift;
        while (vim = nextRight(vim), vip = nextLeft(vip), vim && vip) {
          vom = nextLeft(vom);
          vop = nextRight(vop);
          vop.a = v;
          shift = vim.z + sim - vip.z - sip + separation(vim._, vip._);
          if (shift > 0) {
            moveSubtree(nextAncestor(vim, v, ancestor), v, shift);
            sip += shift;
            sop += shift;
          }
          sim += vim.m;
          sip += vip.m;
          som += vom.m;
          sop += vop.m;
        }
        if (vim && !nextRight(vop)) {
          vop.t = vim;
          vop.m += sim - sop;
        }
        if (vip && !nextLeft(vom)) {
          vom.t = vip;
          vom.m += sip - som;
          ancestor = v;
        }
      }
      return ancestor;
    }

    function sizeNode(node) {
      node.x *= dx;
      node.y = node.depth * dy;
    }

    tree.separation = function(x) {
      return arguments.length ? (separation = x, tree) : separation;
    };

    tree.size = function(x) {
      return arguments.length ? (nodeSize = false, dx = +x[0], dy = +x[1], tree) : (nodeSize ? null : [dx, dy]);
    };

    tree.nodeSize = function(x) {
      return arguments.length ? (nodeSize = true, dx = +x[0], dy = +x[1], tree) : (nodeSize ? [dx, dy] : null);
    };

    return tree;
  }

  function treemapSlice(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (y1 - y0) / parent.value;

    while (++i < n) {
      node = nodes[i], node.x0 = x0, node.x1 = x1;
      node.y0 = y0, node.y1 = y0 += node.value * k;
    }
  }

  var phi = (1 + Math.sqrt(5)) / 2;

  function squarifyRatio(ratio, parent, x0, y0, x1, y1) {
    var rows = [],
        nodes = parent.children,
        row,
        nodeValue,
        i0 = 0,
        i1 = 0,
        n = nodes.length,
        dx, dy,
        value = parent.value,
        sumValue,
        minValue,
        maxValue,
        newRatio,
        minRatio,
        alpha,
        beta;

    while (i0 < n) {
      dx = x1 - x0, dy = y1 - y0;

      // Find the next non-empty node.
      do sumValue = nodes[i1++].value; while (!sumValue && i1 < n);
      minValue = maxValue = sumValue;
      alpha = Math.max(dy / dx, dx / dy) / (value * ratio);
      beta = sumValue * sumValue * alpha;
      minRatio = Math.max(maxValue / beta, beta / minValue);

      // Keep adding nodes while the aspect ratio maintains or improves.
      for (; i1 < n; ++i1) {
        sumValue += nodeValue = nodes[i1].value;
        if (nodeValue < minValue) minValue = nodeValue;
        if (nodeValue > maxValue) maxValue = nodeValue;
        beta = sumValue * sumValue * alpha;
        newRatio = Math.max(maxValue / beta, beta / minValue);
        if (newRatio > minRatio) { sumValue -= nodeValue; break; }
        minRatio = newRatio;
      }

      // Position and record the row orientation.
      rows.push(row = {value: sumValue, dice: dx < dy, children: nodes.slice(i0, i1)});
      if (row.dice) treemapDice(row, x0, y0, x1, value ? y0 += dy * sumValue / value : y1);
      else treemapSlice(row, x0, y0, value ? x0 += dx * sumValue / value : x1, y1);
      value -= sumValue, i0 = i1;
    }

    return rows;
  }

  ((function custom(ratio) {

    function squarify(parent, x0, y0, x1, y1) {
      squarifyRatio(ratio, parent, x0, y0, x1, y1);
    }

    squarify.ratio = function(x) {
      return custom((x = +x) > 1 ? x : 1);
    };

    return squarify;
  }))(phi);

  ((function custom(ratio) {

    function resquarify(parent, x0, y0, x1, y1) {
      if ((rows = parent._squarify) && (rows.ratio === ratio)) {
        var rows,
            row,
            nodes,
            i,
            j = -1,
            n,
            m = rows.length,
            value = parent.value;

        while (++j < m) {
          row = rows[j], nodes = row.children;
          for (i = row.value = 0, n = nodes.length; i < n; ++i) row.value += nodes[i].value;
          if (row.dice) treemapDice(row, x0, y0, x1, value ? y0 += (y1 - y0) * row.value / value : y1);
          else treemapSlice(row, x0, y0, value ? x0 += (x1 - x0) * row.value / value : x1, y1);
          value -= row.value;
        }
      } else {
        parent._squarify = rows = squarifyRatio(ratio, parent, x0, y0, x1, y1);
        rows.ratio = ratio;
      }
    }

    resquarify.ratio = function(x) {
      return custom((x = +x) > 1 ? x : 1);
    };

    return resquarify;
  }))(phi);

  // https://d3js.org/d3-scale/ v4.0.3 Copyright 2010-2026 Mike Bostock

  function initRange(domain, range) {
    switch (arguments.length) {
      case 0: break;
      case 1: this.range(domain); break;
      default: this.range(range).domain(domain); break;
    }
    return this;
  }

  function constants(x) {
    return function() {
      return x;
    };
  }

  function number$1(x) {
    return +x;
  }

  var unit = [0, 1];

  function identity$1(x) {
    return x;
  }

  function normalize(a, b) {
    return (b -= (a = +a))
        ? function(x) { return (x - a) / b; }
        : constants(isNaN(b) ? NaN : 0.5);
  }

  function clamper(a, b) {
    var t;
    if (a > b) t = a, a = b, b = t;
    return function(x) { return Math.max(a, Math.min(b, x)); };
  }

  // normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
  // interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
  function bimap(domain, range, interpolate) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
    else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
    return function(x) { return r0(d0(x)); };
  }

  function polymap(domain, range, interpolate) {
    var j = Math.min(domain.length, range.length) - 1,
        d = new Array(j),
        r = new Array(j),
        i = -1;

    // Reverse descending domains.
    if (domain[j] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }

    while (++i < j) {
      d[i] = normalize(domain[i], domain[i + 1]);
      r[i] = interpolate(range[i], range[i + 1]);
    }

    return function(x) {
      var i = bisectRight(domain, x, 1, j) - 1;
      return r[i](d[i](x));
    };
  }

  function copy$1(source, target) {
    return target
        .domain(source.domain())
        .range(source.range())
        .interpolate(source.interpolate())
        .clamp(source.clamp())
        .unknown(source.unknown());
  }

  function transformer$2() {
    var domain = unit,
        range = unit,
        interpolate$1 = value,
        transform,
        untransform,
        unknown,
        clamp = identity$1,
        piecewise,
        output,
        input;

    function rescale() {
      var n = Math.min(domain.length, range.length);
      if (clamp !== identity$1) clamp = clamper(domain[0], domain[n - 1]);
      piecewise = n > 2 ? polymap : bimap;
      output = input = null;
      return scale;
    }

    function scale(x) {
      return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate$1)))(transform(clamp(x)));
    }

    scale.invert = function(y) {
      return clamp(untransform((input || (input = piecewise(range, domain.map(transform), number)))(y)));
    };

    scale.domain = function(_) {
      return arguments.length ? (domain = Array.from(_, number$1), rescale()) : domain.slice();
    };

    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
    };

    scale.rangeRound = function(_) {
      return range = Array.from(_), interpolate$1 = round, rescale();
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = _ ? true : identity$1, rescale()) : clamp !== identity$1;
    };

    scale.interpolate = function(_) {
      return arguments.length ? (interpolate$1 = _, rescale()) : interpolate$1;
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    return function(t, u) {
      transform = t, untransform = u;
      return rescale();
    };
  }

  function continuous() {
    return transformer$2()(identity$1, identity$1);
  }

  function tickFormat(start, stop, count, specifier) {
    var step = tickStep(start, stop, count),
        precision;
    specifier = formatSpecifier(specifier == null ? ",f" : specifier);
    switch (specifier.type) {
      case "s": {
        var value = Math.max(Math.abs(start), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
        return formatPrefix(specifier, value);
      }
      case "":
      case "e":
      case "g":
      case "p":
      case "r": {
        if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }
      case "f":
      case "%": {
        if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
    }
    return format(specifier);
  }

  function linearish(scale) {
    var domain = scale.domain;

    scale.ticks = function(count) {
      var d = domain();
      return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
    };

    scale.tickFormat = function(count, specifier) {
      var d = domain();
      return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
    };

    scale.nice = function(count) {
      if (count == null) count = 10;

      var d = domain();
      var i0 = 0;
      var i1 = d.length - 1;
      var start = d[i0];
      var stop = d[i1];
      var prestep;
      var step;
      var maxIter = 10;

      if (stop < start) {
        step = start, start = stop, stop = step;
        step = i0, i0 = i1, i1 = step;
      }
      
      while (maxIter-- > 0) {
        step = tickIncrement(start, stop, count);
        if (step === prestep) {
          d[i0] = start;
          d[i1] = stop;
          return domain(d);
        } else if (step > 0) {
          start = Math.floor(start / step) * step;
          stop = Math.ceil(stop / step) * step;
        } else if (step < 0) {
          start = Math.ceil(start * step) / step;
          stop = Math.floor(stop * step) / step;
        } else {
          break;
        }
        prestep = step;
      }

      return scale;
    };

    return scale;
  }

  function linear() {
    var scale = continuous();

    scale.copy = function() {
      return copy$1(scale, linear());
    };

    initRange.apply(scale, arguments);

    return linearish(scale);
  }

  // https://d3js.org/d3-shape/ v3.2.1 Copyright 2010-2026 Mike Bostock

  function constant$1(x) {
    return function constant() {
      return x;
    };
  }

  const epsilon = 1e-12;

  function withPath(shape) {
    let digits = 3;

    shape.digits = function(_) {
      if (!arguments.length) return digits;
      if (_ == null) {
        digits = null;
      } else {
        const d = Math.floor(_);
        if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
        digits = d;
      }
      return shape;
    };

    return () => new Path(digits);
  }

  var slice = Array.prototype.slice;

  function x(p) {
    return p[0];
  }

  function y(p) {
    return p[1];
  }

  function pointRadial(x, y) {
    return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
  }

  class Bump {
    constructor(context, x) {
      this._context = context;
      this._x = x;
    }
    areaStart() {
      this._line = 0;
    }
    areaEnd() {
      this._line = NaN;
    }
    lineStart() {
      this._point = 0;
    }
    lineEnd() {
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    }
    point(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: {
          this._point = 1;
          if (this._line) this._context.lineTo(x, y);
          else this._context.moveTo(x, y);
          break;
        }
        case 1: this._point = 2; // falls through
        default: {
          if (this._x) this._context.bezierCurveTo(this._x0 = (this._x0 + x) / 2, this._y0, this._x0, y, x, y);
          else this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + y) / 2, x, this._y0, x, y);
          break;
        }
      }
      this._x0 = x, this._y0 = y;
    }
  }

  class BumpRadial {
    constructor(context) {
      this._context = context;
    }
    lineStart() {
      this._point = 0;
    }
    lineEnd() {}
    point(x, y) {
      x = +x, y = +y;
      if (this._point === 0) {
        this._point = 1;
      } else {
        const p0 = pointRadial(this._x0, this._y0);
        const p1 = pointRadial(this._x0, this._y0 = (this._y0 + y) / 2);
        const p2 = pointRadial(x, this._y0);
        const p3 = pointRadial(x, y);
        this._context.moveTo(...p0);
        this._context.bezierCurveTo(...p1, ...p2, ...p3);
      }
      this._x0 = x, this._y0 = y;
    }
  }

  function bumpX(context) {
    return new Bump(context, true);
  }

  function bumpY(context) {
    return new Bump(context, false);
  }

  function bumpRadial(context) {
    return new BumpRadial(context);
  }

  function linkSource(d) {
    return d.source;
  }

  function linkTarget(d) {
    return d.target;
  }

  function link(curve) {
    let source = linkSource,
        target = linkTarget,
        x$1 = x,
        y$1 = y,
        context = null,
        output = null,
        path = withPath(link);

    function link() {
      let buffer;
      const argv = slice.call(arguments);
      const s = source.apply(this, argv);
      const t = target.apply(this, argv);
      if (context == null) output = curve(buffer = path());
      output.lineStart();
      argv[0] = s, output.point(+x$1.apply(this, argv), +y$1.apply(this, argv));
      argv[0] = t, output.point(+x$1.apply(this, argv), +y$1.apply(this, argv));
      output.lineEnd();
      if (buffer) return output = null, buffer + "" || null;
    }

    link.source = function(_) {
      return arguments.length ? (source = _, link) : source;
    };

    link.target = function(_) {
      return arguments.length ? (target = _, link) : target;
    };

    link.x = function(_) {
      return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant$1(+_), link) : x$1;
    };

    link.y = function(_) {
      return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant$1(+_), link) : y$1;
    };

    link.context = function(_) {
      return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), link) : context;
    };

    return link;
  }

  function linkHorizontal() {
    return link(bumpX);
  }

  function linkVertical() {
    return link(bumpY);
  }

  function linkRadial() {
    const l = link(bumpRadial);
    l.angle = l.x, delete l.x;
    l.radius = l.y, delete l.y;
    return l;
  }

  function noop() {}

  function point$3(that, x, y) {
    that._context.bezierCurveTo(
      (2 * that._x0 + that._x1) / 3,
      (2 * that._y0 + that._y1) / 3,
      (that._x0 + 2 * that._x1) / 3,
      (that._y0 + 2 * that._y1) / 3,
      (that._x0 + 4 * that._x1 + x) / 6,
      (that._y0 + 4 * that._y1 + y) / 6
    );
  }

  function Basis(context) {
    this._context = context;
  }

  Basis.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 3: point$3(this, this._x1, this._y1); // falls through
        case 2: this._context.lineTo(this._x1, this._y1); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6); // falls through
        default: point$3(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
    }
  };

  function Bundle(context, beta) {
    this._basis = new Basis(context);
    this._beta = beta;
  }

  Bundle.prototype = {
    lineStart: function() {
      this._x = [];
      this._y = [];
      this._basis.lineStart();
    },
    lineEnd: function() {
      var x = this._x,
          y = this._y,
          j = x.length - 1;

      if (j > 0) {
        var x0 = x[0],
            y0 = y[0],
            dx = x[j] - x0,
            dy = y[j] - y0,
            i = -1,
            t;

        while (++i <= j) {
          t = i / j;
          this._basis.point(
            this._beta * x[i] + (1 - this._beta) * (x0 + t * dx),
            this._beta * y[i] + (1 - this._beta) * (y0 + t * dy)
          );
        }
      }

      this._x = this._y = null;
      this._basis.lineEnd();
    },
    point: function(x, y) {
      this._x.push(+x);
      this._y.push(+y);
    }
  };

  ((function custom(beta) {

    function bundle(context) {
      return beta === 1 ? new Basis(context) : new Bundle(context, beta);
    }

    bundle.beta = function(beta) {
      return custom(+beta);
    };

    return bundle;
  }))(0.85);

  function point$2(that, x, y) {
    that._context.bezierCurveTo(
      that._x1 + that._k * (that._x2 - that._x0),
      that._y1 + that._k * (that._y2 - that._y0),
      that._x2 + that._k * (that._x1 - x),
      that._y2 + that._k * (that._y1 - y),
      that._x2,
      that._y2
    );
  }

  function Cardinal(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  Cardinal.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x2, this._y2); break;
        case 3: point$2(this, this._x1, this._y1); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
        case 2: this._point = 3; // falls through
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new Cardinal(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function CardinalClosed(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  CardinalClosed.prototype = {
    areaStart: noop,
    areaEnd: noop,
    lineStart: function() {
      this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
      this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 1: {
          this._context.moveTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 2: {
          this._context.lineTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 3: {
          this.point(this._x3, this._y3);
          this.point(this._x4, this._y4);
          this.point(this._x5, this._y5);
          break;
        }
      }
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
        case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
        case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new CardinalClosed(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function CardinalOpen(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  CardinalOpen.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
        case 3: this._point = 4; // falls through
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new CardinalOpen(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function point$1(that, x, y) {
    var x1 = that._x1,
        y1 = that._y1,
        x2 = that._x2,
        y2 = that._y2;

    if (that._l01_a > epsilon) {
      var a = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a,
          n = 3 * that._l01_a * (that._l01_a + that._l12_a);
      x1 = (x1 * a - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
      y1 = (y1 * a - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
    }

    if (that._l23_a > epsilon) {
      var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a,
          m = 3 * that._l23_a * (that._l23_a + that._l12_a);
      x2 = (x2 * b + that._x1 * that._l23_2a - x * that._l12_2a) / m;
      y2 = (y2 * b + that._y1 * that._l23_2a - y * that._l12_2a) / m;
    }

    that._context.bezierCurveTo(x1, y1, x2, y2, that._x2, that._y2);
  }

  function CatmullRom(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRom.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x2, this._y2); break;
        case 3: this.point(this._x2, this._y2); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; // falls through
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function CatmullRomClosed(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRomClosed.prototype = {
    areaStart: noop,
    areaEnd: noop,
    lineStart: function() {
      this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
      this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 1: {
          this._context.moveTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 2: {
          this._context.lineTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 3: {
          this.point(this._x3, this._y3);
          this.point(this._x4, this._y4);
          this.point(this._x5, this._y5);
          break;
        }
      }
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
        case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
        case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function CatmullRomOpen(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRomOpen.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
        case 3: this._point = 4; // falls through
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function sign(x) {
    return x < 0 ? -1 : 1;
  }

  // Calculate the slopes of the tangents (Hermite-type interpolation) based on
  // the following paper: Steffen, M. 1990. A Simple Method for Monotonic
  // Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
  // NOV(II), P. 443, 1990.
  function slope3(that, x2, y2) {
    var h0 = that._x1 - that._x0,
        h1 = x2 - that._x1,
        s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
        s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
        p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }

  // Calculate a one-sided slope.
  function slope2(that, t) {
    var h = that._x1 - that._x0;
    return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
  }

  // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
  // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
  // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
  function point(that, t0, t1) {
    var x0 = that._x0,
        y0 = that._y0,
        x1 = that._x1,
        y1 = that._y1,
        dx = (x1 - x0) / 3;
    that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
  }

  function MonotoneX(context) {
    this._context = context;
  }

  MonotoneX.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 =
      this._t0 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x1, this._y1); break;
        case 3: point(this, this._t0, slope2(this, this._t0)); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      var t1 = NaN;

      x = +x, y = +y;
      if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; point(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
        default: point(this, this._t0, t1 = slope3(this, x, y)); break;
      }

      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
      this._t0 = t1;
    }
  };

  (Object.create(MonotoneX.prototype)).point = function(x, y) {
    MonotoneX.prototype.point.call(this, y, x);
  };

  // https://d3js.org/d3-zoom/ v3.0.1 Copyright 2010-2026 Mike Bostock

  var constant = x => () => x;

  function ZoomEvent(type, {
    sourceEvent,
    target,
    transform,
    dispatch
  }) {
    Object.defineProperties(this, {
      type: {value: type, enumerable: true, configurable: true},
      sourceEvent: {value: sourceEvent, enumerable: true, configurable: true},
      target: {value: target, enumerable: true, configurable: true},
      transform: {value: transform, enumerable: true, configurable: true},
      _: {value: dispatch}
    });
  }

  function Transform(k, x, y) {
    this.k = k;
    this.x = x;
    this.y = y;
  }

  Transform.prototype = {
    constructor: Transform,
    scale: function(k) {
      return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
    },
    translate: function(x, y) {
      return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
    },
    apply: function(point) {
      return [point[0] * this.k + this.x, point[1] * this.k + this.y];
    },
    applyX: function(x) {
      return x * this.k + this.x;
    },
    applyY: function(y) {
      return y * this.k + this.y;
    },
    invert: function(location) {
      return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
    },
    invertX: function(x) {
      return (x - this.x) / this.k;
    },
    invertY: function(y) {
      return (y - this.y) / this.k;
    },
    rescaleX: function(x) {
      return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
    },
    rescaleY: function(y) {
      return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
    },
    toString: function() {
      return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
    }
  };

  var identity = new Transform(1, 0, 0);

  Transform.prototype;

  function nopropagation(event) {
    event.stopImmediatePropagation();
  }

  function noevent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // Ignore right-click, since that should open the context menu.
  // except for pinch-to-zoom, which is sent as a wheel+ctrlKey event
  function defaultFilter(event) {
    return (!event.ctrlKey || event.type === 'wheel') && !event.button;
  }

  function defaultExtent() {
    var e = this;
    if (e instanceof SVGElement) {
      e = e.ownerSVGElement || e;
      if (e.hasAttribute("viewBox")) {
        e = e.viewBox.baseVal;
        return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
      }
      return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
    }
    return [[0, 0], [e.clientWidth, e.clientHeight]];
  }

  function defaultTransform() {
    return this.__zoom || identity;
  }

  function defaultWheelDelta(event) {
    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
  }

  function defaultTouchable() {
    return navigator.maxTouchPoints || ("ontouchstart" in this);
  }

  function defaultConstrain(transform, extent, translateExtent) {
    var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
        dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
        dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
        dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
    return transform.translate(
      dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
      dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
    );
  }

  function zoom() {
    var filter = defaultFilter,
        extent = defaultExtent,
        constrain = defaultConstrain,
        wheelDelta = defaultWheelDelta,
        touchable = defaultTouchable,
        scaleExtent = [0, Infinity],
        translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
        duration = 250,
        interpolate = zoom$1,
        listeners = dispatch("start", "zoom", "end"),
        touchstarting,
        touchfirst,
        touchending,
        touchDelay = 500,
        wheelDelay = 150,
        clickDistance2 = 0,
        tapDistance = 10;

    function zoom(selection) {
      selection
          .property("__zoom", defaultTransform)
          .on("wheel.zoom", wheeled, {passive: false})
          .on("mousedown.zoom", mousedowned)
          .on("dblclick.zoom", dblclicked)
        .filter(touchable)
          .on("touchstart.zoom", touchstarted)
          .on("touchmove.zoom", touchmoved)
          .on("touchend.zoom touchcancel.zoom", touchended)
          .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
    }

    zoom.transform = function(collection, transform, point, event) {
      var selection = collection.selection ? collection.selection() : collection;
      selection.property("__zoom", defaultTransform);
      if (collection !== selection) {
        schedule(collection, transform, point, event);
      } else {
        selection.interrupt().each(function() {
          gesture(this, arguments)
            .event(event)
            .start()
            .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
            .end();
        });
      }
    };

    zoom.scaleBy = function(selection, k, p, event) {
      zoom.scaleTo(selection, function() {
        var k0 = this.__zoom.k,
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return k0 * k1;
      }, p, event);
    };

    zoom.scaleTo = function(selection, k, p, event) {
      zoom.transform(selection, function() {
        var e = extent.apply(this, arguments),
            t0 = this.__zoom,
            p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p,
            p1 = t0.invert(p0),
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
      }, p, event);
    };

    zoom.translateBy = function(selection, x, y, event) {
      zoom.transform(selection, function() {
        return constrain(this.__zoom.translate(
          typeof x === "function" ? x.apply(this, arguments) : x,
          typeof y === "function" ? y.apply(this, arguments) : y
        ), extent.apply(this, arguments), translateExtent);
      }, null, event);
    };

    zoom.translateTo = function(selection, x, y, p, event) {
      zoom.transform(selection, function() {
        var e = extent.apply(this, arguments),
            t = this.__zoom,
            p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
        return constrain(identity.translate(p0[0], p0[1]).scale(t.k).translate(
          typeof x === "function" ? -x.apply(this, arguments) : -x,
          typeof y === "function" ? -y.apply(this, arguments) : -y
        ), e, translateExtent);
      }, p, event);
    };

    function scale(transform, k) {
      k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
      return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
    }

    function translate(transform, p0, p1) {
      var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
      return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
    }

    function centroid(extent) {
      return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
    }

    function schedule(transition, transform, point, event) {
      transition
          .on("start.zoom", function() { gesture(this, arguments).event(event).start(); })
          .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).event(event).end(); })
          .tween("zoom", function() {
            var that = this,
                args = arguments,
                g = gesture(that, args).event(event),
                e = extent.apply(that, args),
                p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point,
                w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]),
                a = that.__zoom,
                b = typeof transform === "function" ? transform.apply(that, args) : transform,
                i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
            return function(t) {
              if (t === 1) t = b; // Avoid rounding error on end.
              else { var l = i(t), k = w / l[2]; t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k); }
              g.zoom(null, t);
            };
          });
    }

    function gesture(that, args, clean) {
      return (!clean && that.__zooming) || new Gesture(that, args);
    }

    function Gesture(that, args) {
      this.that = that;
      this.args = args;
      this.active = 0;
      this.sourceEvent = null;
      this.extent = extent.apply(that, args);
      this.taps = 0;
    }

    Gesture.prototype = {
      event: function(event) {
        if (event) this.sourceEvent = event;
        return this;
      },
      start: function() {
        if (++this.active === 1) {
          this.that.__zooming = this;
          this.emit("start");
        }
        return this;
      },
      zoom: function(key, transform) {
        if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
        if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
        if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
        this.that.__zoom = transform;
        this.emit("zoom");
        return this;
      },
      end: function() {
        if (--this.active === 0) {
          delete this.that.__zooming;
          this.emit("end");
        }
        return this;
      },
      emit: function(type) {
        var d = select(this.that).datum();
        listeners.call(
          type,
          this.that,
          new ZoomEvent(type, {
            sourceEvent: this.sourceEvent,
            target: zoom,
            transform: this.that.__zoom,
            dispatch: listeners
          }),
          d
        );
      }
    };

    function wheeled(event, ...args) {
      if (!filter.apply(this, arguments)) return;
      var g = gesture(this, args).event(event),
          t = this.__zoom,
          k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))),
          p = pointer(event);

      // If the mouse is in the same location as before, reuse it.
      // If there were recent wheel events, reset the wheel idle timeout.
      if (g.wheel) {
        if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
          g.mouse[1] = t.invert(g.mouse[0] = p);
        }
        clearTimeout(g.wheel);
      }

      // If this wheel event won’t trigger a transform change, ignore it.
      else if (t.k === k) return;

      // Otherwise, capture the mouse point and location at the start.
      else {
        g.mouse = [p, t.invert(p)];
        interrupt(this);
        g.start();
      }

      noevent(event);
      g.wheel = setTimeout(wheelidled, wheelDelay);
      g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));

      function wheelidled() {
        g.wheel = null;
        g.end();
      }
    }

    function mousedowned(event, ...args) {
      if (touchending || !filter.apply(this, arguments)) return;
      var currentTarget = event.currentTarget,
          g = gesture(this, args, true).event(event),
          v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
          p = pointer(event, currentTarget),
          x0 = event.clientX,
          y0 = event.clientY;

      nodrag(event.view);
      nopropagation(event);
      g.mouse = [p, this.__zoom.invert(p)];
      interrupt(this);
      g.start();

      function mousemoved(event) {
        noevent(event);
        if (!g.moved) {
          var dx = event.clientX - x0, dy = event.clientY - y0;
          g.moved = dx * dx + dy * dy > clickDistance2;
        }
        g.event(event)
         .zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer(event, currentTarget), g.mouse[1]), g.extent, translateExtent));
      }

      function mouseupped(event) {
        v.on("mousemove.zoom mouseup.zoom", null);
        yesdrag(event.view, g.moved);
        noevent(event);
        g.event(event).end();
      }
    }

    function dblclicked(event, ...args) {
      if (!filter.apply(this, arguments)) return;
      var t0 = this.__zoom,
          p0 = pointer(event.changedTouches ? event.changedTouches[0] : event, this),
          p1 = t0.invert(p0),
          k1 = t0.k * (event.shiftKey ? 0.5 : 2),
          t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);

      noevent(event);
      if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0, event);
      else select(this).call(zoom.transform, t1, p0, event);
    }

    function touchstarted(event, ...args) {
      if (!filter.apply(this, arguments)) return;
      var touches = event.touches,
          n = touches.length,
          g = gesture(this, args, event.changedTouches.length === n).event(event),
          started, i, t, p;

      nopropagation(event);
      for (i = 0; i < n; ++i) {
        t = touches[i], p = pointer(t, this);
        p = [p, this.__zoom.invert(p), t.identifier];
        if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
        else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
      }

      if (touchstarting) touchstarting = clearTimeout(touchstarting);

      if (started) {
        if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
        interrupt(this);
        g.start();
      }
    }

    function touchmoved(event, ...args) {
      if (!this.__zooming) return;
      var g = gesture(this, args).event(event),
          touches = event.changedTouches,
          n = touches.length, i, t, p, l;

      noevent(event);
      for (i = 0; i < n; ++i) {
        t = touches[i], p = pointer(t, this);
        if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
        else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
      }
      t = g.that.__zoom;
      if (g.touch1) {
        var p0 = g.touch0[0], l0 = g.touch0[1],
            p1 = g.touch1[0], l1 = g.touch1[1],
            dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp,
            dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
        t = scale(t, Math.sqrt(dp / dl));
        p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
      }
      else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
      else return;

      g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
    }

    function touchended(event, ...args) {
      if (!this.__zooming) return;
      var g = gesture(this, args).event(event),
          touches = event.changedTouches,
          n = touches.length, i, t;

      nopropagation(event);
      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, touchDelay);
      for (i = 0; i < n; ++i) {
        t = touches[i];
        if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
        else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
      }
      if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
      if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
      else {
        g.end();
        // If this was a dbltap, reroute to the (optional) dblclick.zoom handler.
        if (g.taps === 2) {
          t = pointer(t, this);
          if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
            var p = select(this).on("dblclick.zoom");
            if (p) p.apply(this, arguments);
          }
        }
      }
    }

    zoom.wheelDelta = function(_) {
      return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant(+_), zoom) : wheelDelta;
    };

    zoom.filter = function(_) {
      return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), zoom) : filter;
    };

    zoom.touchable = function(_) {
      return arguments.length ? (touchable = typeof _ === "function" ? _ : constant(!!_), zoom) : touchable;
    };

    zoom.extent = function(_) {
      return arguments.length ? (extent = typeof _ === "function" ? _ : constant([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
    };

    zoom.scaleExtent = function(_) {
      return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
    };

    zoom.translateExtent = function(_) {
      return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
    };

    zoom.constrain = function(_) {
      return arguments.length ? (constrain = _, zoom) : constrain;
    };

    zoom.duration = function(_) {
      return arguments.length ? (duration = +_, zoom) : duration;
    };

    zoom.interpolate = function(_) {
      return arguments.length ? (interpolate = _, zoom) : interpolate;
    };

    zoom.on = function() {
      var value = listeners.on.apply(listeners, arguments);
      return value === listeners ? zoom : value;
    };

    zoom.clickDistance = function(_) {
      return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
    };

    zoom.tapDistance = function(_) {
      return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
    };

    return zoom;
  }

  /**
   * The [SemVer](https://semver.org/) version string of the patristic library
   * @type {String} A string specifying the current version of the Patristic Library.
   * If not given, the version of patristic you are using if less than or equal to 0.2.2.
   * @example
   * console.log(patristic.version);
   */
  const version = "0.7.1";
  // No parent, child or sibling.
  const NONE = -1;
  // The parent of a slot whose Branch has moved to another Store.
  const MOVED = -2;
  /**
   * @private
   * @internal
   * The storage behind Branches: a forest kept in parallel arrays, one slot per
   * Branch. Each tree lives in one Store; Branch objects are views onto slots,
   * made the first time they're asked for and kept, so a Branch is always the
   * same object.
   */
  class Store {
      constructor(capacity = 16) {
          this.size = 0;
          this.ids = [];
          this.data = [];
          this.views = [];
          /** Counts changes to the structure, so the index knows when it's stale. */
          this.version = 0;
          /** Counts changes to ids, for the index's id lookup. */
          this.idVersion = 0;
          this.capacity = Math.max(capacity, 1);
          this.parent = new Int32Array(this.capacity);
          this.firstChild = new Int32Array(this.capacity);
          this.lastChild = new Int32Array(this.capacity);
          this.nextSibling = new Int32Array(this.capacity);
          this.prevSibling = new Int32Array(this.capacity);
          this.length = new Float64Array(this.capacity);
          this.value = new Float64Array(this.capacity);
          this.depth = new Int32Array(this.capacity);
          this.height = new Int32Array(this.capacity);
          this.representing = new Int32Array(this.capacity);
      }
      grow() {
          let capacity = this.capacity * 2;
          let resize = (array) => {
              let bigger = new array.constructor(capacity);
              bigger.set(array);
              return bigger;
          };
          this.parent = resize(this.parent);
          this.firstChild = resize(this.firstChild);
          this.lastChild = resize(this.lastChild);
          this.nextSibling = resize(this.nextSibling);
          this.prevSibling = resize(this.prevSibling);
          this.length = resize(this.length);
          this.value = resize(this.value);
          this.depth = resize(this.depth);
          this.height = resize(this.height);
          this.representing = resize(this.representing);
          this.capacity = capacity;
      }
      /** Adds a slot for a new root Branch and returns its index. */
      add(id, length, data) {
          if (this.size === this.capacity)
              this.grow();
          let i = this.size++;
          this.parent[i] = NONE;
          this.firstChild[i] = NONE;
          this.lastChild[i] = NONE;
          this.nextSibling[i] = NONE;
          this.prevSibling[i] = NONE;
          this.length[i] = length;
          this.value[i] = 1;
          this.depth[i] = 0;
          this.height[i] = 0;
          this.representing[i] = 1;
          this.ids[i] = id;
          this.data[i] = data;
          this.views[i] = undefined;
          this.version++;
          return i;
      }
      /** The Branch for slot i. */
      view(i) {
          let view = this.views[i];
          if (view === undefined) {
              view = Object.create(Branch.prototype);
              bind(view, this, i);
          }
          return view;
      }
      /**
       * Links root slot `child` under `parent`, before its child `before`, or
       * last if `before` is NONE.
       */
      link(child, parent, before) {
          let { firstChild, lastChild, nextSibling, prevSibling } = this;
          this.version++;
          this.parent[child] = parent;
          if (before === NONE) {
              let last = lastChild[parent];
              prevSibling[child] = last;
              nextSibling[child] = NONE;
              if (last === NONE)
                  firstChild[parent] = child;
              else
                  nextSibling[last] = child;
              lastChild[parent] = child;
          }
          else {
              let previous = prevSibling[before];
              prevSibling[child] = previous;
              nextSibling[child] = before;
              prevSibling[before] = child;
              if (previous === NONE)
                  firstChild[parent] = child;
              else
                  nextSibling[previous] = child;
          }
      }
      /** Unlinks slot `child` from its parent, if it has one. */
      unlink(child) {
          let parent = this.parent[child];
          if (parent < 0)
              return;
          this.version++;
          let { nextSibling, prevSibling } = this;
          let previous = prevSibling[child], next = nextSibling[child];
          if (previous === NONE)
              this.firstChild[parent] = next;
          else
              nextSibling[previous] = next;
          if (next === NONE)
              this.lastChild[parent] = previous;
          else
              prevSibling[next] = previous;
          this.parent[child] = NONE;
          nextSibling[child] = NONE;
          prevSibling[child] = NONE;
      }
      /** The slots of i's children, in order. */
      children(i) {
          let children = [];
          for (let c = this.firstChild[i]; c !== NONE; c = this.nextSibling[c]) {
              children.push(c);
          }
          return children;
      }
      /** The slots of the subtree under i, in pre-order. */
      preorder(i) {
          let order = [];
          let stack = [i];
          let { lastChild, prevSibling } = this;
          while (stack.length) {
              let j = stack.pop();
              order.push(j);
              for (let c = lastChild[j]; c !== NONE; c = prevSibling[c])
                  stack.push(c);
          }
          return order;
      }
      /** The slots of the subtree under i, in post-order. */
      postorder(i) {
          // Visiting children last to first and reversing gives post-order.
          let order = [];
          let stack = [i];
          let { firstChild, nextSibling } = this;
          while (stack.length) {
              let j = stack.pop();
              order.push(j);
              for (let c = firstChild[j]; c !== NONE; c = nextSibling[c])
                  stack.push(c);
          }
          return order.reverse();
      }
      /** Puts i's children in the given order. */
      reorder(i, children) {
          this.version++;
          let previous = NONE;
          for (let c of children) {
              this.prevSibling[c] = previous;
              if (previous === NONE)
                  this.firstChild[i] = c;
              else
                  this.nextSibling[previous] = c;
              previous = c;
          }
          if (previous !== NONE)
              this.nextSibling[previous] = NONE;
          this.lastChild[i] = previous;
      }
      /** Whether slot a is slot b or one of its ancestors. */
      isAncestorOrSelf(a, b) {
          for (let j = b; j >= 0; j = this.parent[j])
              if (j === a)
                  return true;
          return false;
      }
      /**
       * The index of the tree containing slot i, built if the tree has changed
       * since it was last built (or it's for another tree in this Store).
       */
      treeIndex(i) {
          let index = this.index;
          if (index && index.version === this.version && index.position[i] >= 0) {
              return index;
          }
          let root = i;
          while (this.parent[root] >= 0)
              root = this.parent[root];
          return (this.index = new TreeIndex(this, root));
      }
  }
  /**
   * @private
   * Facts about one tree that take a traversal to work out, kept until the
   * tree's structure changes: its slots in pre-order, where each slot falls in
   * that order, how many slots each subtree has (so a subtree is a contiguous
   * run of the order), each slot's number of edges from the root, and (built
   * when first needed) where each id appears.
   */
  class TreeIndex {
      constructor(store, root) {
          this.idVersion = -1;
          this.idPositions = new Map();
          this.store = store;
          this.version = store.version;
          let order = (this.order = store.preorder(root));
          let position = (this.position = new Int32Array(store.size).fill(-1));
          let size = (this.size = new Int32Array(store.size));
          let level = (this.level = new Int32Array(store.size));
          let parent = store.parent;
          for (let k = 0; k < order.length; k++) {
              let i = order[k];
              position[i] = k;
              if (i !== root)
                  level[i] = level[parent[i]] + 1;
          }
          for (let k = order.length - 1; k >= 0; k--) {
              let i = order[k];
              size[i] += 1;
              if (i !== root)
                  size[parent[i]] += size[i];
          }
      }
      /** Whether slot d is in the subtree under slot a (counting a itself). */
      contains(a, d) {
          let p = this.position[a], q = this.position[d];
          return q >= p && q < p + this.size[a];
      }
      /**
       * The first slot in pre-order, in the subtree under `under` (excluding
       * `under` itself if `strict`), whose id is `id` and which passes `test`.
       */
      find(under, id, strict, test) {
          let store = this.store;
          if (this.idVersion !== store.idVersion) {
              this.idPositions.clear();
              for (let k = 0; k < this.order.length; k++) {
                  let key = store.ids[this.order[k]];
                  let positions = this.idPositions.get(key);
                  if (positions)
                      positions.push(k);
                  else
                      this.idPositions.set(key, [k]);
              }
              this.idVersion = store.idVersion;
          }
          let positions = this.idPositions.get(id);
          if (!positions)
              return NONE;
          let start = this.position[under] + (strict ? 1 : 0), end = this.position[under] + this.size[under];
          // Binary search for the first position at or after start.
          let lo = 0, hi = positions.length;
          while (lo < hi) {
              let mid = (lo + hi) >> 1;
              if (positions[mid] < start)
                  lo = mid + 1;
              else
                  hi = mid;
          }
          for (let k = lo; k < positions.length && positions[k] < end; k++) {
              let i = this.order[positions[k]];
              if (!test || test(i))
                  return i;
          }
          return NONE;
      }
  }
  // Each Branch's _guid is unique within this copy of the library.
  let lastGuid = 0;
  // Points a view at a slot, and the slot at the view.
  function bind(view, store, index) {
      view._store = store;
      view._index = index;
      if (view._guid === undefined)
          view._guid = ++lastGuid;
      store.views[index] = view;
  }
  /**
   * @private
   * Moves the subtree under root slot `root` of `from` into `to`, and returns
   * its new root slot. Views of the moved Branches are re-pointed, so they keep
   * their identity; their old slots are left empty.
   */
  function move(from, root, to) {
      let order = from.preorder(root);
      let slots = new Map();
      for (let i of order) {
          let j = to.add(from.ids[i], from.length[i], from.data[i]);
          to.value[j] = from.value[i];
          to.depth[j] = from.depth[i];
          to.height[j] = from.height[i];
          to.representing[j] = from.representing[i];
          slots.set(i, j);
          let parent = from.parent[i];
          if (i !== root)
              to.link(j, slots.get(parent), NONE);
          let view = from.views[i];
          if (view !== undefined)
              bind(view, to, j);
      }
      from.version++;
      for (let i of order) {
          from.parent[i] = MOVED;
          from.firstChild[i] = NONE;
          from.lastChild[i] = NONE;
          from.ids[i] = "";
          from.data[i] = undefined;
          from.views[i] = undefined;
      }
      return slots.get(root);
  }
  // Removes a Branch from its parent's children, if it has a parent.
  function detach(branch) {
      branch._store.unlink(branch._index);
  }
  // Throws if `child` is `parent` or one of its ancestors.
  function checkNotAncestor(child, parent) {
      let store = parent._store;
      if (child._store === store && store.isAncestorOrSelf(child._index, parent._index)) {
          throw new Error("Cannot make a Branch a descendant of itself.");
      }
  }
  /**
   * @private
   * Makes `child` a child of `parent`: before `before` (one of parent's
   * children) or last. The child is detached from wherever it was, and moved
   * into parent's Store if it's in another.
   */
  function attach(child, parent, before) {
      let store = parent._store;
      checkNotAncestor(child, parent);
      detach(child);
      if (child._store !== store)
          move(child._store, child._index, store);
      store.link(child._index, parent._index, before ? before._index : NONE);
  }
  /**
   * A class for representing Branches in trees.
   * It's written predominantly for phylogenetic trees (hence the
   * [Newick parser](#parseNewick),
   * [neighbor-joining implementation](#parseMatrix), etc.), but could
   * conceivably be useful for representing other types of trees as well.
   *
   * A tree's data is stored in typed arrays; a Branch is a view onto one entry,
   * made when it's first asked for and kept from then on. Its links (`parent`
   * and `children`) can't disagree: setting either updates both sides.
   * @param {Object} [data] An object containing data you wish to assign to
   * this Branch object. In particular, intended to overwrite the default
   * attributes of a Branch, namely `id`, `parent`, `length`, and `children`.
   * @constructor
   */
  class Branch {
      constructor(data, children) {
          if (!data)
              data = {};
          let store = new Store(1);
          let i = store.add(data.id ?? "", data.length ?? 0, data);
          store.depth[i] = data.depth ?? 0;
          store.height[i] = data.height ?? 0;
          store.value[i] = data.value ?? 1;
          bind(this, store, i);
          let kids = (children ? children(data) : data.children) || [];
          kids.forEach(kid => this.addChild(kid));
          if (data.parent)
              attach(this, data.parent);
      }
      /** This Branch's identifier. */
      get id() {
          return this._store.ids[this._index];
      }
      set id(id) {
          this._store.ids[this._index] = id;
          this._store.idVersion++;
      }
      /** The length of the edge from this Branch to its parent. */
      get length() {
          return this._store.length[this._index];
      }
      set length(length) {
          this._store.length[this._index] = length;
      }
      /** The number of edges from the root (set by fixDistances). */
      get depth() {
          return this._store.depth[this._index];
      }
      set depth(depth) {
          this._store.depth[this._index] = depth;
      }
      /** The greatest number of edges to a leaf below (set by fixDistances). */
      get height() {
          return this._store.height[this._index];
      }
      set height(height) {
          this._store.height[this._index] = height;
      }
      /** A value for layouts and sorting (see count, sum and fixDistances). */
      get value() {
          return this._store.value[this._index];
      }
      set value(value) {
          this._store.value[this._index] = value;
      }
      /** How many Branches this one stands for, after excising others into it. */
      get representing() {
          return this._store.representing[this._index];
      }
      set representing(representing) {
          this._store.representing[this._index] = representing;
      }
      /** The data this Branch was made from, or an empty object. */
      get data() {
          var _a, _b;
          let store = this._store;
          return ((_a = store.data)[_b = this._index] ?? (_a[_b] = {}));
      }
      set data(data) {
          this._store.data[this._index] = data;
      }
      /**
       * This Branch's parent, or null for a root. Setting it moves this Branch
       * (with its subtree) to be the last child of the new parent, or detaches
       * it if set to null.
       */
      get parent() {
          let parent = this._store.parent[this._index];
          return parent < 0 ? null : this._store.view(parent);
      }
      set parent(parent) {
          if (parent === this.parent)
              return;
          if (parent === null)
              detach(this);
          else
              attach(this, parent);
      }
      /**
       * This Branch's children, as a new array, or undefined for a leaf (as in
       * d3-hierarchy). Changing the array doesn't change the tree. Assigning an
       * array of Branches makes them the children, in that order; children left
       * out are detached, and assigning null or an empty array makes this Branch
       * a leaf.
       */
      get children() {
          let store = this._store;
          let c = store.firstChild[this._index];
          if (c === NONE)
              return undefined;
          let children = [];
          for (; c !== NONE; c = store.nextSibling[c])
              children.push(store.view(c));
          return children;
      }
      set children(children) {
          let store = this._store;
          // Check every new child before changing anything.
          if (children)
              children.forEach(child => checkNotAncestor(child, this));
          for (let c of store.children(this._index))
              store.unlink(c);
          if (children)
              children.forEach(child => attach(child, this));
      }
      /**
       * Adds a new child to this Branch
       * @param  {(Branch|Object)} [data={}] The new Branch, or data to attach to it.
       * @return {Branch} The (possibly new) child Branch
       */
      addChild(data) {
          if (data instanceof Branch) {
              attach(data, this);
              return data;
          }
          if (!data) {
              let store = this._store;
              let i = store.add("", 0);
              store.link(i, this._index, NONE);
              return store.view(i);
          }
          let child = new Branch(data);
          attach(child, this);
          return child;
      }
      /**
       * Adds a new parent to this Branch, inserting it between this Branch and its
       * current parent (if any). This is a bit esoteric and generally not
       * recommended.
       * @param  {(Branch|Object)} [data={}] A Branch object, or the data to attach to one
       * @param  {Array} [siblings=[]] An array of Branches to be the children of the
       * new parent Branch (i.e. siblings of this Branch). They are detached from
       * wherever they were in the tree.
       * @return {Branch} The Branch on which this was called
       */
      addParent(data, siblings) {
          if (!siblings)
              siblings = [];
          let c = data instanceof Branch ? data : new Branch(data ?? {});
          detach(c);
          let oldParent = this.parent;
          if (oldParent) {
              attach(c, oldParent, this);
          }
          else if (c._store !== this._store) {
              // Move the new parent into this tree's Store rather than the reverse.
              move(c._store, c._index, this._store);
          }
          attach(this, c);
          siblings.forEach(sib => attach(sib, c));
          return this;
      }
      /**
       * Returns an array of Branches from this Branch to the root.
       * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_ancestors)
       * @type {Array} An array of Branches
       */
      ancestors() {
          return this.getAncestors(true);
      }
      /**
       * Returns a deep clone of the Branch on which it is called. Note that this does
       * not clone all descendants, rather than providing references to the existing
       * descendant Branches.
       * @return {Branch} A clone of the Branch on which it is called.
       */
      clone() {
          return copyTree(this);
      }
      /**
       * All descendant Branches with near-zero length are excised
       * @return {Branch} The Branch on which this method was called.
       */
      consolidate() {
          // Collect first: excising while traversing would shift the arrays being
          // traversed and skip Branches.
          let branches = [];
          this.eachAfter(branch => branches.push(branch));
          branches.forEach(branch => {
              if (branch === this || branch.isRoot() || branch.length >= 0.0005)
                  return;
              branch.parent.id = joinIds(branch.parent.id, branch.id);
              branch.excise();
          });
          return this.fixDistances();
      }
      /**
       * Returns a clone of the Branch on which it is called. Note that this also
       * clones all descendants, rather than providing references to the existing
       * descendant Branches. (For a shallow clone, see [Branch.clone](#clone).
       * Finally, the cloned Branch will become the root of the cloned tree, having a
       * parent of `null`.
       * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_copy)
       * @return {Branch} A clone of the Branch on which it is called.
       */
      copy() {
          return copyTree(this);
      }
      /**
       * Sets the value of each Branch to the number of leaves in its subtree (1
       * for a leaf), as d3-hierarchy's count does.
       * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_count)
       * @return {Branch} The Branch on which it was called
       */
      count() {
          let store = this._store;
          for (let i of store.postorder(this._index)) {
              let sum = 0;
              for (let c = store.firstChild[i]; c !== NONE; c = store.nextSibling[c]) {
                  sum += store.value[c];
              }
              store.value[i] = store.firstChild[i] === NONE ? 1 : sum;
          }
          return this;
      }
      /**
       * Returns an array pf descendants, starting with this Branch.
       * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_descendants)
       * @type {Array} An Array of Branches, starting with this one.
       */
      descendants() {
          return this.getDescendants(true);
      }
      /**
       * Returns the depth of a given child, relative to the Branch on which it is
       * called.
       * @param  {(Branch|String)} descendant A descendant Branch (or `id` string
       * thereof)
       * @return {Number} The sum of the lengths of all Branches between the Branch on
       * which it is called and `descendant`. Throws an error if `descendant` is not a
       * descendant of this Branch.
       */
      depthOf(descendant) {
          let distance = 0;
          let target = typeof descendant == "string"
              ? this.getDescendant(descendant)
              : descendant;
          if (typeof target == "undefined")
              throw Error("Cannot compute depth of undefined descendant!");
          let current = target;
          while (current != this) {
              distance += current.length;
              current = current.parent;
          }
          return distance;
      }
      /**
       * Computes the patristic distance between `descendantA` and `descendantB`.
       * @param  {Branch} descendantA The Branch from which you wish to compute
       * distance
       * @param  {Branch} descendantB The Branch to which you wish to compute distance
       * @return {number} The patristic distance between the given descendants.
       */
      distanceBetween(descendantA, descendantB) {
          let [, a, b] = distancesToMRCA(descendantA, descendantB);
          return a + b;
      }
      /**
       * Computes the patristic distance between `cousin` and the Branch on which
       * this method is called.
       * @param  {Branch} cousin The Branch to which you wish to compute distance
       * @return {number} The patristic distance between `cousin` and the Branch on
       * this method is called.
       */
      distanceTo(cousin) {
          let [, a, b] = distancesToMRCA(this, cousin);
          return a + b;
      }
      /**
       * Visits each Branch descended from the Branch on which it is called in
       * [Breadth First Search](https://en.wikipedia.org/wiki/Breadth-first_search)
       * order and returns the Branch on which it was called.
       * @param  {Function} callback The function to be run on each Branch
       * @return {Branch} The Branch on which it was called.
       */
      each(callback) {
          let branch = this, next = [branch], current;
          while (next.length) {
              current = next.reverse();
              next = [];
              while ((branch = current.pop())) {
                  callback(branch);
                  branch.eachChild(child => next.push(child));
              }
          }
          return this;
      }
      /**
       * Visits each Branch descended from the Branch on which it is called in
       * [post-traversal order](https://en.wikipedia.org/wiki/Tree_traversal#Post-order)
       * and returns the Branch on which it was called.
       * @param  {Function} callback Function to run on each Branch
       * @return {Branch} The Branch on which it was called
       */
      eachAfter(callback) {
          walk(this, null, callback);
          return this;
      }
      /**
       * Visits each Branch descended from the Branch on which it is called in
       * [pre-traversal order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order)
       * and returns the Branch on which it was called.
       * @param  {Function} callback [description]
       * @return {[type]}            [description]
       */
      eachBefore(callback) {
          walk(this, callback, null);
          return this;
      }
      /**
       * Runs a function on each child of the Branch on which it is called.
       * @param  {Function} callback The function to run on each child.
       * @return {Branch} The Branch on which it was called.
       */
      eachChild(callback) {
          (this.children ?? []).forEach(callback);
          return this;
      }
      /**
       * Excises the Branch on which it is called and updates its parent and children.
       * Excising a root Branch with a single child makes that child the new root.
       * @return {Branch} The parent of the excised Branch, or the new root if the
       * excised Branch was the root.
       */
      excise() {
          let children = this.children ?? [];
          if (this.isRoot()) {
              if (children.length > 1) {
                  throw new Error("Cannot excise a root Branch with multiple children.");
              }
              let child = children[0];
              if (!child)
                  throw new Error("Cannot excise a root Branch with no children.");
              child.length += this.length;
              detach(child);
              return child;
          }
          let parent = this.parent;
          // Put the children in this Branch's place among its siblings.
          children.forEach(child => {
              child.length += this.length;
              attach(child, parent, this);
          });
          detach(this);
          parent.representing++;
          return parent;
      }
      /**
       * Sets the distance values (height and depth) for each Branch, and sets each
       * Branch's value to the number of Branches in its subtree (see
       * [Branch.count](#count)).
       * @return {Branch} The Branch on which it is called.
       */
      fixDistances() {
          let store = this._store;
          let { parent, depth, height, value, firstChild, nextSibling } = store;
          depth[this.getRoot()._index] = 0;
          for (let i of store.preorder(this._index)) {
              if (parent[i] >= 0)
                  depth[i] = depth[parent[i]] + 1;
          }
          for (let i of store.postorder(this._index)) {
              let h = 0, v = 1;
              for (let c = firstChild[i]; c !== NONE; c = nextSibling[c]) {
                  if (height[c] + 1 > h)
                      h = height[c] + 1;
                  v += value[c];
              }
              height[i] = h;
              value[i] = v;
          }
          return this;
      }
      /**
       * Repairs incorrect links by recurively confirming that children reference
       * their parents, and correcting those references if they do not.
       *
       * If you need to call this, something has messed up the state of your tree
       * and you should be concerned about that. Just FYI. ¯\\_(ツ)_/¯
       * @param  {Boolean} nonrecursive Should this just fix the children of the
       * Branch on which it is called, or all descendants?
       * @return {Branch} The Branch on which it was called.
       */
      fixParenthood(nonrecursive) {
          // Parent and child links are stored together and can't disagree.
          return this;
      }
      /**
       * Reverses the order of (all of) the descendants of the Branch.
       * @return {Branch} The Branch on which this was called.
       */
      flip() {
          return this.each(c => c.rotate());
      }
      /**
       * Returns an Array of all the ancestors of the Branch on which it is called.
       * Note that this does not include itself. For all ancestors and itself, see
       * [Branch.ancestors](#ancestors)
       * @param {Boolean} includeSelf Should the Branch on which this is called be
       * included in the results?
       * @return {Array} Every Ancestor of the Branch on which it was called.
       */
      getAncestors(includeSelf) {
          let ancestors = includeSelf ? [this] : [];
          for (let current = this.parent; current; current = current.parent) {
              ancestors.push(current);
          }
          return ancestors;
      }
      /**
       * Given an `childID`, returns the child with that id (or `undefined` if no such
       * child is present).
       * @param  {(String|Number)} childID the ID of the child to return. (Trees
       * built by [parseMatrix](#parseMatrix) without labels have numeric ids.)
       * @return {(Branch|undefined)} The desired child Branch, or `undefined` if the
       * child doesn't exist.
       */
      getChild(childID) {
          return this.children?.find(c => c.id === childID);
      }
      /**
       * Given an id string, returns the descendant Branch with that ID, or
       * `undefined` if it doesn't exist.
       * @param  {String} id The id string of the Branch to find
       * @return {(Branch|undefined)} The descendant Branch, or `undefined` if it
       * doesn't exist
       */
      getDescendant(id) {
          let store = this._store;
          let found = store.treeIndex(this._index).find(this._index, id, false);
          return found === NONE ? undefined : store.view(found);
      }
      /**
       * Returns an array of all Branches which are descendants of this Branch
       * @param {Boolean} [includeSelf] Is this not the Branch on which the user
       * called the function? This is used internally and should be ignored.
       * @return {Array} An array of all Branches descended from this Branch
       */
      getDescendants(includeSelf) {
          let store = this._store;
          let index = store.treeIndex(this._index);
          let start = index.position[this._index], end = start + index.size[this._index];
          let descendants = [];
          for (let k = includeSelf ? start : start + 1; k < end; k++) {
              descendants.push(store.view(index.order[k]));
          }
          return descendants;
      }
      /**
       * Returns an array of all leaves which are descendants of this Branch.
       * Alias of [getLeaves](#getLeaves) for people whose strong suit isn't spelling.
       * @return {Array} An array of all leaves descended from this Branch
       */
      getLeafs() {
          return this.getLeaves();
      }
      /**
       * Returns an array of all leaves which are descendants of this Branch
       * See also: [getLeafs](#getLeafs)
       * @return {Array} An array of all leaves descended from this Branch
       */
      getLeaves() {
          let store = this._store;
          let index = store.treeIndex(this._index);
          let start = index.position[this._index], end = start + index.size[this._index];
          let leaves = [];
          for (let k = start; k < end; k++) {
              let i = index.order[k];
              if (store.firstChild[i] === NONE)
                  leaves.push(store.view(i));
          }
          return leaves;
      }
      /**
       * Traverses the tree upward until it finds the Most Recent Common Ancestor
       * (i.e. the first Branch for which both the Branch on which it was called and
       * `cousin` are descendants). A Branch counts as its own descendant here, so
       * the MRCA of a Branch and one of its ancestors is that ancestor.
       * @return {Branch} The Most Recent Common Ancestor of both the Branch on
       * which it was called and the `cousin`.
       */
      getMRCA(cousin) {
          return this._store.view(climbToMRCA(this, cousin));
      }
      /**
       * Traverses the tree upward until it finds the root Branch, and returns the
       * root.
       * @return {Branch} The root Branch of the tree
       */
      getRoot() {
          let store = this._store;
          let i = this._index;
          while (store.parent[i] >= 0)
              i = store.parent[i];
          return store.view(i);
      }
      /**
       * Determines if a given Branch (or ID) is a child of this Branch
       * @param  {(Branch|String)} child The Branch (or the id thereof) to check for
       * @return {Boolean}
       */
      hasChild(child) {
          if (child instanceof Branch) {
              return child.parent === this;
          }
          else if (typeof child === "string") {
              return (this.children ?? []).some(c => c.id === child);
          }
          throw Error(`Unknown type of child (${typeof child}) passed to Branch.hasChild!`);
      }
      /**
       * Checks to see if `descendant` is a descendant of the Branch on which this
       * method is called.
       * @param  {(Branch|String)} descendant Either the descendant Branch or its'
       * `id`.
       * @return {Boolean} True if `descendant` is descended from the Branch from
       * which this is called, otherwise false.
       */
      hasDescendant(descendant) {
          if (descendant instanceof Branch) {
              return descendant.isDescendantOf(this);
          }
          else if (typeof descendant === "string") {
              let index = this._store.treeIndex(this._index);
              return index.find(this._index, descendant, true) !== NONE;
          }
          throw Error("Unknown type of descendant passed to Branch.hasDescendant!");
      }
      /**
       * Checks to see if a Branch has a descendant leaf.
       * @return {Boolean} True if leaf is both a leaf and a descendant of the
       * Branch on which this method is called, False otherwise.
       */
      hasLeaf(leaf) {
          if (leaf instanceof Branch) {
              // A leaf's only leaf is itself.
              return leaf.isLeaf() && (leaf === this || leaf.isDescendantOf(this));
          }
          else if (typeof leaf === "string") {
              if (this.isLeaf())
                  return this.id === leaf;
              let store = this._store;
              let index = store.treeIndex(this._index);
              let isLeaf = (i) => store.firstChild[i] === NONE;
              return index.find(this._index, leaf, true, isLeaf) !== NONE;
          }
          throw Error("Unknown type of leaf passed to Branch.hasLeaf.");
      }
      /**
       * Swaps the branch on which it is called with its parent. This method is
       * probably only useful as an internal component of [Branch.reroot](#reroot).
       * @return {Branch} The Branch object on which it was called.
       */
      invert() {
          let oldParent = this.parent;
          if (oldParent) {
              let temp = oldParent.length;
              oldParent.length = this.length;
              this.length = temp;
              let grandparent = oldParent.parent;
              if (grandparent)
                  attach(this, grandparent, oldParent);
              else
                  detach(this);
              attach(oldParent, this);
          }
          else {
              throw Error("Cannot invert root node!");
          }
          return this;
      }
      /**
       * Returns whether the Branch on which it is called is a child of a given parent
       * (or parent ID).
       * @param  {(Branch|String)} parent A Branch (or ID thereof) to test for
       * paternity of this Branch.
       * @return {Boolean} True is `parent` is the parent of this Branch, false
       * otherwise.
       */
      isChildOf(parent) {
          if (parent instanceof Branch)
              return this.parent === parent;
          if (typeof parent === "string")
              return this.parent.id === parent;
          throw Error("Unknown parent type passed to Branch.isChildOf");
      }
      /**
       * Tests whether this and each descendant Branch holds correct links to both
       * its parent and its children.
       * @return {Boolean} True if consistent, otherwise false
       */
      isConsistent() {
          // Every child's parent link is checked against the list it's in, though
          // the two are kept together and can't disagree.
          let store = this._store;
          for (let i of store.preorder(this._index)) {
              for (let c = store.firstChild[i]; c !== NONE; c = store.nextSibling[c]) {
                  if (store.parent[c] !== i)
                      return false;
              }
          }
          return true;
      }
      /**
       * Returns whether a given Branch is an ancestor of the Branch on which this
       * method is called.
       * @param  {Branch} ancestor The Branch to check for ancestorhood
       * @return {Boolean} If this Branch is descended from `ancestor`
       */
      isDescendantOf(ancestor) {
          if (!ancestor)
              return false;
          let store = this._store;
          if (ancestor instanceof Branch) {
              if (ancestor._store !== store || ancestor === this)
                  return false;
              return store.treeIndex(this._index).contains(ancestor._index, this._index);
          }
          let parent = store.parent;
          for (let i = parent[this._index]; i >= 0; i = parent[i]) {
              if (store.ids[i] === ancestor)
                  return true;
          }
          return false;
      }
      /**
       * Returns a boolean indicating if this Branch is a leaf (i.e. has no
       * children).
       * @return {Boolean} True is this Branch is a leaf, otherwise false.
       */
      isLeaf() {
          return this._store.firstChild[this._index] === NONE;
      }
      /**
       * Returns a boolean indicating whether or not this Branch is olate.
       *
       * ...Just kidding!
       *
       * Isolates a Branch and its subtree (i.e. removes everything above it, making
       * it the root Branch). Similar to [Branch.remove](#remove), only it returns
       * the Branch on which it is called.
       * @return {Branch} The Branch object on which it was called.
       */
      isolate() {
          if (this.isRoot()) {
              throw new TypeError("Cannot isolate a root Branch.");
          }
          detach(this);
          return this;
      }
      /**
       * Returns a boolean indicating if this Branch is the root of a tree (i.e. has
       * no parents).
       * @return {Boolean} True if this Branch is the root, otherwise false.
       */
      isRoot() {
          return this._store.parent[this._index] < 0;
      }
      /**
       * Returns the array of leaf nodes in traversal order; leaves are nodes with no
       * children. Alias of [Branch.getLeaves](#getLeaves) `cuz spelling is hard.
       * @type {Array} An Array of Branches which are descended from this Branch and
       * have no children.
       */
      leafs() {
          return this.getLeaves();
      }
      /**
       * Returns the array of leaf nodes in traversal order; leaves are nodes with no
       * children. Alias of [Branch.getLeaves](#getLeaves).
       * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_leaves)
       * @type {Array} An Array of Branches which are descended from this Branch and
       * have no children.
       */
      leaves() {
          return this.getLeaves();
      }
      /**
       * Returns an Array of links, which are plain javascript objects containing a
       * `source` attribute (which is a reference to the parent Branch) and a `target`
       * attribute (which is a reference to the child Branch).
       * [d3-hierarchy compatibility method](https://github.com/d3/d3-hierarchy#node_links)
       * @return {Array} An array of plain Javascript objects
       */
      links() {
          let links = [];
          this.each(d => {
              if (d.isRoot())
                  return;
              links.push({
                  source: d.parent,
                  target: d
              });
          });
          return links;
      }
      /**
       * Normalizes this and all descendant Branches `value` attributes to between
       * `newmin` and `newmax`. Note that normalize can function as its own inverse
       * when passed an original range. For example:
       * @example tree.normalize().normalize(1, tree.getDescendants().length + 1);
       * @param  {Number} newmin The desired minimum value.
       * @param  {Number} newmax The desired maximum value.
       * @return {Branch} The Branch on which it was called.
       */
      normalize(newmin, newmax) {
          if (typeof newmax !== "number")
              newmax = 1;
          if (typeof newmin !== "number")
              newmin = 0;
          let min = Infinity, max = -Infinity;
          this.each(d => {
              if (d.value < min)
                  min = d.value;
              if (d.value > max)
                  max = d.value;
          });
          let ratio = (newmax - newmin) / (max - min);
          return this.each(d => (d.value = (d.value - min) * ratio + newmin));
      }
      /**
       * Gets the path from this Branch to `target`. If this Branch and `target` are
       * the same, returns an array containing only the Branch on which it is called.
       * @param  {Branch} target A Branch object
       * @return {Array} An ordered Array of Branches following the path between this
       * Branch and `target`
       */
      path(target) {
          let mrca = this.getMRCA(target);
          let branches = [];
          for (let current = this; current !== mrca; current = current.parent) {
              branches.push(current);
          }
          branches.push(mrca);
          let down = [];
          for (let current = target; current !== mrca; current = current.parent) {
              down.push(current);
          }
          for (let i = down.length - 1; i >= 0; i--)
              branches.push(down[i]);
          return branches;
      }
      /**
       * Removes a Branch and its subtree from the tree. Similar to
       * [Branch.isolate](#isolate), only it returns the root Branch of the tree
       * from which this Branch is removed.
       * @param {Boolean} pruneAncestors - If true, removes ancestors with no remaining children as well
       * @return {Branch} The root of the remaining tree.
       */
      remove(pruneAncestors) {
          let root = this.getRoot();
          let parent = this.parent;
          this.isolate();
          if (pruneAncestors) {
              parent?.removeIfNoChildren();
          }
          return root;
      }
      /**
       * Removes the branch if it has no children. Then recursively removes all
       * ancestors with no children.
       *
       * @param {Boolean} nonrecursive - If true, does not remove ancestors with no children
       * @return {Branch} The root of the modified tree.
       */
      removeIfNoChildren(nonrecursive) {
          let root = this.getRoot();
          let parent = this.parent;
          if (this.isLeaf() && parent) {
              this.remove();
              if (!nonrecursive) {
                  parent.removeIfNoChildren();
              }
          }
          return root;
      }
      /**
       * Removes a Branch and its subtree from the tree, and replaces it. The
       * replacement is detached from wherever it was, and the replaced Branch
       * becomes the root of its own tree.
       * @param {Branch} replacement - The branch to replace the branch on which the
       * method is called.
       * @return {Branch} The root of the modified tree.
       */
      replace(replacement) {
          let parent = this.parent;
          if (!parent)
              throw new Error("Cannot replace a root Branch.");
          let root = this.getRoot();
          attach(replacement, parent, this);
          detach(this);
          return root;
      }
      /**
       * Reroots a tree on this Branch. Use with caution, this returns the new root,
       * which should typically supplant the existing root Branch object, but does
       * not replace that root automatically.
       * @example
       * tree = tree.children[0].children[0].reroot();
       * @return {Branch} The new root Branch, which is the Branch on which this was
       * called
       */
      reroot() {
          let current = this;
          let toInvert = [];
          while (!current.isRoot()) {
              toInvert.push(current);
              current = current.parent;
          }
          toInvert.reverse().forEach(c => c.invert());
          return this.fixDistances();
      }
      /**
       * Reverses the order of the children of the branch on which it is called.
       * @return {Branch} The Branch on which this was called.
       */
      rotate(recursive) {
          let store = this._store;
          store.reorder(this._index, store.children(this._index).reverse());
          return this;
      }
      /**
       * Set the length of a Branch
       * @param  {number} length The new length to assign to the Branch
       * @return {Branch} The Branch object on which this was called
       */
      setLength(length) {
          this.length = length;
          return this;
      }
      /**
       * Sets the parent of the Branch on which it is called.
       * @param  {Branch} parent The Branch to set as parent
       * @return {Branch} The Branch on which this method was called.
       */
      setParent(parent) {
          if (!(parent instanceof Branch) && parent !== null)
              throw Error("Cannot set parent to non-Branch object!");
          this.parent = parent;
          return this;
      }
      /**
       * Collapses each descendant Branch with exactly one child into a single
       * continuous branch. The Branch on which it is called is left in place.
       * @return {Branch} The Branch on which this method was called.
       */
      simplify() {
          this.eachAfter(branch => {
              // Excising this Branch would detach it from the tree we return.
              if (branch === this)
                  return;
              let children = branch.children;
              if (children && children.length == 1) {
                  let child = children[0];
                  child.id = joinIds(branch.id, child.id);
                  branch.excise();
              }
          });
          return this.fixDistances();
      }
      /**
       * Sorts the Tree from the branch on which it is called downward.
       * @param  {Function} [comparator] A Function taking two Branches and returning
       * a numberic value. For details, see [MDN Array.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Description)
       * @return {Branch} The Branch on which it was called
       */
      sort(comparator) {
          if (!comparator)
              comparator = (a, b) => a.value - b.value;
          let compare = comparator;
          return this.eachBefore(d => {
              let children = d.children;
              if (!children)
                  return;
              children.sort(compare);
              d._store.reorder(d._index, children.map(c => c._index));
          });
      }
      /**
       * Determines whether this Branch is likelier to be a source of `cousin`, or
       * if `cousin` is a source of this Branch.
       * @param  {Branch} cousin The other Branch to test
       * @return {Boolean} True if this might be the source of cousin, otherwise
       * false.
       */
      sources(cousin) {
          let [, a, b] = distancesToMRCA(this, cousin);
          return a < b;
      }
      /**
       * Computes the value of each Branch according to some valuator function
       * @param  {Function} value A Function taking a Branch and returning a
       * (numeric?) value.
       * @return {Branch} The Branch on which it was called.
       */
      sum(value) {
          if (!value)
              value = d => d.value;
          return this.eachAfter(d => (d.value =
              value(d) + (d.children ?? []).reduce((a, c) => a + c.value, 0)));
      }
      /**
       * Determines whether this Branch is likelier to be a target of `cousin`, or
       * if `cousin` is a target of this Branch.
       * @param  {Branch} cousin The other Branch to test
       * @return {Boolean} True if this might be the target of cousin, otherwise
       * false.
       */
      targets(cousin) {
          return cousin.sources(this);
      }
      /**
       * toJSON is an alias for [toObject](#toObject), enabling the safe use of
       * `JSON.stringify` on Branch objects (in spite of their circular references).
       * @type {Function}
       * @returns {Object} A serializable Object
       */
      toJSON() {
          return this.toObject();
      }
      /**
       * Computes a matrix of all patristic distances between all leaves which are
       * descendants of the Branch on which this method is called.
       * @return {Object} An Object containing a matrix (an Array of Arrays) and
       * Array of `id`s corresponding to the rows (and columns) of the matrix.
       */
      toMatrix() {
          let store = this._store;
          let { firstChild, nextSibling, length } = store;
          let order = store.postorder(this._index);
          let leafs = [];
          for (let i of order)
              if (firstChild[i] === NONE)
                  leafs.push(i);
          let n = leafs.length;
          let matrix = new Array(n);
          for (let i = 0; i < n; i++)
              matrix[i] = new Array(n).fill(0);
          let nextLeaf = 0;
          // In post-order, each Branch's children's lists are the last ones on the
          // stack. A list holds the indices of a subtree's leaves and their distances
          // to the subtree's root. Each pair of leaves is visited once, at its MRCA,
          // so this is O(n^2) in the number of leaves.
          let indexStack = [], distanceStack = [];
          for (let branch of order) {
              if (firstChild[branch] === NONE) {
                  // Leaves come in the same order as getLeaves lists them.
                  indexStack.push([nextLeaf++]);
                  distanceStack.push([0]);
                  continue;
              }
              let k = 0;
              for (let c = firstChild[branch]; c !== NONE; c = nextSibling[c])
                  k++;
              let first = indexStack.length - k;
              // Every internal Branch has a first child, which sets these.
              let indices, distances;
              let c = 0;
              for (let child = firstChild[branch]; child !== NONE; child = nextSibling[child], c++) {
                  let childLength = length[child];
                  let childIndices = indexStack[first + c], childDistances = distanceStack[first + c];
                  // Sum each leaf's lengths upward, in the order depthOf sums them.
                  for (let y = 0; y < childDistances.length; y++)
                      childDistances[y] += childLength;
                  // Extend the first child's list rather than copying it.
                  if (c === 0) {
                      indices = childIndices;
                      distances = childDistances;
                      continue;
                  }
                  for (let x = 0; x < indices.length; x++) {
                      let i = indices[x], di = distances[x], row = matrix[i];
                      for (let y = 0; y < childIndices.length; y++) {
                          let j = childIndices[y], distance = di + childDistances[y];
                          row[j] = distance;
                          matrix[j][i] = distance;
                      }
                  }
                  for (let y = 0; y < childIndices.length; y++) {
                      indices.push(childIndices[y]);
                      distances.push(childDistances[y]);
                  }
              }
              indexStack.length = first;
              distanceStack.length = first;
              indexStack.push(indices);
              distanceStack.push(distances);
          }
          return {
              matrix: matrix,
              ids: leafs.map(i => store.ids[i])
          };
      }
      /**
       * Returns the Newick representation of this Branch and its descendants.
       * Labels containing whitespace, punctuation, brackets or quotes are written
       * in single quotes, with any single quotes in them doubled. A Branch's
       * `data.nhx` annotations, if any, are written after its length as an NHX
       * comment.
       * @param  {Boolean} [nonterminus=falsy] Is this not the terminus of the
       * Newick Tree? This should be falsy when called by a user (i.e. you). It's
       * used internally to decide whether or not in include a semicolon in the
       * returned string.
       * @return {String} The [Newick](https://en.wikipedia.org/wiki/Newick_format)
       * representation of the Branch.
       */
      toNewick(nonterminus) {
          let store = this._store;
          let { firstChild, lastChild, prevSibling } = store;
          let parts = [];
          // The stack holds slots still to write (as numbers), and strings to write
          // as they are.
          let stack = [this._index];
          while (stack.length) {
              let item = stack.pop();
              if (typeof item === "string") {
                  parts.push(item);
              }
              else if (firstChild[item] === NONE) {
                  parts.push(newickLabel(store, item));
              }
              else {
                  parts.push("(");
                  stack.push(")" + newickLabel(store, item));
                  for (let c = lastChild[item]; c !== NONE; c = prevSibling[c]) {
                      stack.push(c);
                      if (c !== firstChild[item])
                          stack.push(",");
                  }
              }
          }
          if (!nonterminus)
              parts.push(";");
          return parts.join("");
      }
      /**
       * Returns a simple Javascript object version of this Branch and its
       * descendants. This is useful in cases where you want to serialize the tree
       * (e.g. `JSON.stringify(tree)`) but can't because the tree contains circular
       * references (for simplicity, elegance, and performance reasons, each Branch
       * tracks both its children and its parent).
       * @return {Object} A serializable bare Javascript Object representing this
       * Branch and its descendants.
       */
      toObject() {
          let store = this._store;
          let { firstChild, lastChild, prevSibling } = store;
          let output;
          // Pairs of a slot and the children array its object belongs in.
          let stack = [[this._index, null]];
          while (stack.length) {
              let [i, siblings] = stack.pop();
              let object = {
                  id: store.ids[i],
                  length: store.length[i]
              };
              if (siblings)
                  siblings.push(object);
              else
                  output = object;
              if (firstChild[i] !== NONE) {
                  let objects = (object.children = []);
                  for (let c = lastChild[i]; c !== NONE; c = prevSibling[c]) {
                      stack.push([c, objects]);
                  }
              }
          }
          return output;
      }
      /**
       * Returns a valid JSON-string version of this Branch and its descendants.
       * @param {Function} replacer A replacer function to [pass to `JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Parameters).
       * @param {(Number|String)} space A string or number of spaces to use for
       * indenting the output. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Parameters
       * for additional details.
       * @return {Object} A valid JSON string representing this Branch and its
       * descendants.
       */
      toString(replacer, width) {
          if (!replacer)
              replacer = null;
          if (!width)
              width = 0;
          // JSON.stringify's overloads take each kind of replacer separately.
          return JSON.stringify(this, replacer, width);
      }
  }
  // Copies the ids, lengths and structure of a subtree into a new Store, and
  // returns the new root with depth, height and value computed afresh.
  function copyTree(root) {
      let from = root._store;
      let order = from.preorder(root._index);
      let to = new Store(order.length);
      let slots = new Map();
      for (let i of order) {
          let j = to.add(from.ids[i], from.length[i]);
          slots.set(i, j);
          if (i !== root._index)
              to.link(j, slots.get(from.parent[i]), NONE);
      }
      return to.view(0).fixDistances();
  }
  // Combines the ids of two merged Branches, ignoring empty ones.
  function joinIds(a, b) {
      if (a === "")
          return b;
      if (b === "")
          return a;
      return a + "+" + b;
  }
  // Finds the MRCA of two Branches along with each one's distance to it.
  // Returns [mrca, distanceFromA, distanceFromB]. Lengths are summed from each
  // Branch upward, as depthOf sums them.
  function distancesToMRCA(a, b) {
      let mrca = climbToMRCA(a, b);
      let { parent, length } = a._store;
      let distanceA = 0, distanceB = 0;
      for (let i = a._index; i !== mrca; i = parent[i])
          distanceA += length[i];
      for (let i = b._index; i !== mrca; i = parent[i])
          distanceB += length[i];
      return [a._store.view(mrca), distanceA, distanceB];
  }
  // Finds the slot of the MRCA of two Branches, climbing only from each up to
  // it: first the deeper one to the other's level, then both together.
  function climbToMRCA(a, b) {
      let store = a._store;
      if (b._store !== store) {
          throw Error("Branch and cousin do not appear to share a common ancestor!");
      }
      let index = store.treeIndex(a._index);
      if (index.position[b._index] < 0) {
          throw Error("Branch and cousin do not appear to share a common ancestor!");
      }
      let { level } = index;
      let parent = store.parent;
      let i = a._index, j = b._index;
      while (level[i] > level[j])
          i = parent[i];
      while (level[j] > level[i])
          j = parent[j];
      while (i !== j) {
          i = parent[i];
          j = parent[j];
      }
      return i;
  }
  // Depth-first traversal with an explicit stack, so that deep trees can't
  // overflow the call stack. Calls `before` on entering each Branch and `after`
  // on leaving it. Each Branch's children are read after `before` is called on
  // it, so callbacks can edit the tree as they could with a recursive traversal.
  function walk(root, before, after) {
      let nodes = [root], arrays = [], indices = [];
      if (before)
          before(root);
      arrays.push(root.children ?? []);
      indices.push(0);
      while (nodes.length) {
          let top = nodes.length - 1, i = indices[top], array = arrays[top];
          if (i < array.length) {
              indices[top] = i + 1;
              let child = array[i];
              if (before)
                  before(child);
              nodes.push(child);
              arrays.push(child.children ?? []);
              indices.push(0);
          }
          else {
              let node = nodes.pop();
              arrays.pop();
              indices.pop();
              if (after)
                  after(node);
          }
      }
  }
  // A Branch's id and (if it has one) length, as written in Newick.
  function newickLabel(store, i) {
      let label = quoteLabel("" + store.ids[i]);
      if (store.length[i])
          label += ":" + numberToString(store.length[i]);
      let nhx = store.data[i]?.nhx;
      if (nhx) {
          let fields = Object.entries(nhx).map(([key, value]) => key + "=" + value);
          if (fields.length)
              label += "[&&NHX:" + fields.join(":") + "]";
      }
      return label;
  }
  // Characters that can't appear in an unquoted Newick label: whitespace,
  // punctuation, brackets and quotes.
  const NEEDS_QUOTES = /[\s(),:;[\]'"]/;
  // Quotes a label in single quotes (doubling any inside it) if it needs them.
  function quoteLabel(label) {
      if (!NEEDS_QUOTES.test(label))
          return label;
      return "'" + label.replace(/'/g, "''") + "'";
  }
  // Returns a string representation of a number that doesn't use scientific
  // notation. Works on the digits of JavaScript's own (shortest round-trip)
  // representation, so it introduces no floating point artifacts.
  function numberToString(num) {
      let str = String(num);
      let match = str.match(/^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/);
      if (!match)
          return str;
      let [, sign, whole, fraction = "", exponent] = match;
      let e = Number(exponent);
      if (e < 0)
          return sign + "0." + "0".repeat(-e - 1) + whole + fraction;
      return sign + whole + fraction + "0".repeat(e - fraction.length);
  }
  /**
   * Parses a hierarchical JSON string (or Object) as a Branch object.
   * @param  {(String|Object)} json A json string (or Javascript Object)
   * representing hierarchical data.
   * @param  {String} [idLabel="id"] The key used in the objects of `json` to
   * indicate their identifiers.
   * @param  {String} [lengthLabel='length'] The key used in the objects of `json`
   * to indicate their length.
   * @param  {String} [childrenLabel=`children`] The key used in the objects of
   * `json` to indicate their children.
   * @return {Branch} The Branch representing the root of the hierarchy
   * represented by `json`.
   */
  function parseJSON(json, idLabel, lengthLabel, childrenLabel) {
      if (!idLabel)
          idLabel = "id";
      if (!lengthLabel)
          lengthLabel = "length";
      if (!childrenLabel)
          childrenLabel = "children";
      if (typeof json === "string")
          json = JSON.parse(json);
      let store = new Store();
      let stack = [[json, NONE]];
      while (stack.length) {
          let [node, parent] = stack.pop();
          let i = store.add(node[idLabel] ?? "", node[lengthLabel] ?? 0);
          if (parent !== NONE)
              store.link(i, parent, NONE);
          let children = node[childrenLabel];
          if (children instanceof Array) {
              for (let k = children.length - 1; k >= 0; k--) {
                  if (k in children)
                      stack.push([children[k], i]);
              }
          }
      }
      return store.view(0).fixDistances();
  }
  /**
   * Builds a tree from a matrix of distances and returns its root Branch.
   *
   * By default this is neighbor joining, with RapidNJ's search, adapted from
   * Maciej Korzepa's [neighbor-joining](https://github.com/biosustain/neighbor-joining),
   * which is released for modification under the [MIT License](https://opensource.org/licenses/MIT).
   * The `method` option chooses another algorithm:
   * - `"bionj"`: BIONJ (Gascuel 1997), which joins the same way but computes
   *   the new node's distances to reduce their variance, and is usually more
   *   accurate than neighbor joining when distances are noisy.
   * - `"upgma"`: UPGMA, which builds a rooted tree with every leaf the same
   *   distance from the root (assuming a molecular clock).
   *
   * Neighbor joining and BIONJ trees are unrooted at heart; they're rooted
   * where the last two nodes are joined.
   * @param  {Array} matrix An array of `n` arrays of length `n`. Only the lower
   * triangle is read, and the diagonal is taken to be zero.
   * @param  {Array} labels An array of `n` strings, each corresponding to the
   * values in `matrix`.
   * @param  {Object} [options] See ParseMatrixOptions: `method` picks the
   * algorithm, and `{ float32: true }` stores distances in half the memory, at
   * single precision.
   * @return {Branch} A Branch object representing the root Branch of the tree
   * inferred from `matrix`.
   */
  function parseMatrix(matrix, labels, options) {
      let N = matrix.length;
      if (!labels)
          labels = [...Array(N).keys()];
      let method = options?.method ?? "nj";
      let float32 = options?.float32 ?? false;
      if (N === 0)
          throw new Error("parseMatrix needs at least one taxon.");
      if (method === "upgma")
          return upgma(matrix, labels, float32);
      if (method !== "nj" && method !== "bionj") {
          throw new Error(`Unknown parseMatrix method "${method}"; use "nj", "bionj" or "upgma".`);
      }
      if (N === 1) {
          let store = new Store(1);
          store.add(labels[0], 0);
          return store.view(0);
      }
      let nj = new NeighborJoining(matrix, float32, method === "bionj");
      // currIndexToLabel maps each row to the label of the taxon or joined node
      // it holds; labels from N up are joined nodes, in the order they were made.
      let currIndexToLabel = new Int32Array(N);
      for (let i = 0; i < N; i++)
          currIndexToLabel[i] = i;
      // The tree is built in one Store; labelToNode maps labels to its slots.
      let store = new Store(2 * N);
      let labelToNode = new Int32Array(2 * N);
      let nextIndex = N;
      function setUpNode(labelIndex, distance) {
          let node;
          if (labelIndex < N) {
              node = store.add(labels[labelIndex], distance);
              labelToNode[labelIndex] = node;
          }
          else {
              node = labelToNode[labelIndex];
              store.length[node] = distance;
          }
          return node;
      }
      function join(node1, node2) {
          let node = store.add("", 0);
          store.link(node1, node, NONE);
          store.link(node2, node, NONE);
          return node;
      }
      let minI, minJ, d1, d2;
      while (nj.cN > 2) {
          [minI, minJ] = nj.search();
          let dIJ = nj.distance(minI, minJ);
          d1 =
              0.5 * dIJ +
                  (nj.rowSums[minI] - nj.rowSums[minJ]) / (2 * nj.cN - 4);
          d2 = dIJ - d1;
          let node1 = setUpNode(currIndexToLabel[minI], d1);
          let node2 = setUpNode(currIndexToLabel[minJ], d2);
          nj.join(minI, minJ, d1, d2);
          labelToNode[nextIndex] = join(node1, node2);
          currIndexToLabel[minI] = -1;
          currIndexToLabel[minJ] = nextIndex++;
      }
      // Join the last two rows (in index order) at the root.
      [minI, minJ] = nj.remaining();
      d1 = d2 = nj.distance(minI, minJ) / 2;
      let node1 = setUpNode(currIndexToLabel[minI], d1);
      let node2 = setUpNode(currIndexToLabel[minJ], d2);
      return store.view(join(node1, node2)).fixDistances();
  }
  /**
   * @private
   * The distance matrix and search structures of a neighbor-joining run, after
   * RapidNJ (Simonsen, Mailund & Pedersen, 2008): each row keeps its distances
   * sorted, so the search for the pair to join can stop scanning a row once
   * no later entry can beat the best pair found so far.
   *
   * When two rows are joined, the first is removed and the second is reused for
   * the new node. Sorted rows aren't updated for the new node's column (only its
   * own row is re-sorted), so other rows hold stale values for it; every pair
   * is still found with its current distance in the row of whichever of its two
   * nodes was made last.
   */
  class NeighborJoining {
      constructor(matrix, float32, bionj) {
          this.rowSumMax = 0;
          let N = (this.N = this.cN = matrix.length);
          let Floats = float32 ? Float32Array : Float64Array;
          this.rowStart = new Float64Array(N);
          for (let i = 0; i < N; i++)
              this.rowStart[i] = (i * (i - 1)) / 2;
          // Distances given as strings (e.g. read from a CSV file) become numbers.
          let D = (this.D = new Floats((N * (N - 1)) / 2));
          for (let i = 0; i < N; i++) {
              let row = matrix[i], start = this.rowStart[i];
              for (let j = 0; j < i; j++)
                  D[start + j] = Number(row[j]);
          }
          // BIONJ starts with the variances equal to the distances.
          this.V = bionj ? D.slice() : null;
          this.removed = new Uint8Array(N);
          this.newRow = new Float64Array(N);
          this.rowChange = new Float64Array(N);
          this.sorter = new ArgSorter(N);
          this.sortedValues = new Array(N);
          this.sortedColumns = new Array(N);
          this.sortedLength = new Int32Array(N);
          for (let i = 0; i < N; i++) {
              this.sortedValues[i] = new Floats(N - 1);
              this.sortedColumns[i] = new Int32Array(N - 1);
              this.sortRow(i);
          }
          this.rowSums = new Float64Array(N);
          for (let i = 0; i < N; i++) {
              let sum = 0;
              for (let j = 0; j < N; j++)
                  if (j !== i)
                      sum += this.distance(i, j);
              this.rowSums[i] = sum;
              if (sum > this.rowSumMax)
                  this.rowSumMax = sum;
          }
      }
      /** The distance between rows i and j. */
      distance(i, j) {
          if (i > j)
              return this.D[this.rowStart[i] + j];
          if (j > i)
              return this.D[this.rowStart[j] + i];
          return 0;
      }
      /** The first two rows (in index order) that haven't been joined. */
      remaining() {
          let found = [];
          for (let i = 0; found.length < 2; i++)
              if (!this.removed[i])
                  found.push(i);
          return [found[0], found[1]];
      }
      /** Sorts row r's distances to the other rows not yet joined. */
      sortRow(r) {
          let { removed, sorter } = this, keys = sorter.keys, columns = sorter.items, m = 0;
          for (let k = 0; k < this.N; k++) {
              if (removed[k] || k === r)
                  continue;
              columns[m] = k;
              keys[m++] = this.distance(r, k);
          }
          sorter.sort(m);
          this.sortedValues[r].set(keys.subarray(0, m));
          this.sortedColumns[r].set(columns.subarray(0, m));
          this.sortedLength[r] = m;
      }
      /** Finds the pair of rows that minimizes the neighbor-joining criterion. */
      search() {
          let qMin = Infinity, n2 = this.cN - 2, { removed, rowSums, sortedValues, sortedColumns, sortedLength } = this, uMax = this.rowSumMax, q, minI = -1, minJ = -1, c2;
          // Initial guess for qMin: each row's nearest neighbor.
          for (let r = 0; r < this.N; r++) {
              if (removed[r] || sortedLength[r] === 0)
                  continue;
              c2 = sortedColumns[r][0];
              if (removed[c2])
                  continue;
              q = this.distance(r, c2) * n2 - rowSums[r] - rowSums[c2];
              if (q < qMin) {
                  qMin = q;
                  minI = r;
                  minJ = c2;
              }
          }
          for (let r = 0; r < this.N; r++) {
              if (removed[r])
                  continue;
              let values = sortedValues[r], columns = sortedColumns[r], length = sortedLength[r], rowSum = rowSums[r];
              for (let c = 0; c < length; c++) {
                  c2 = columns[c];
                  if (removed[c2])
                      continue;
                  if (values[c] * n2 - rowSum - uMax > qMin)
                      break;
                  q = this.distance(r, c2) * n2 - rowSum - rowSums[c2];
                  if (q < qMin) {
                      qMin = q;
                      minI = r;
                      minJ = c2;
                  }
              }
          }
          return [minI, minJ];
      }
      /**
       * Joins rows i and j: removes row i and reuses row j for the new node,
       * whose branches to i and j have lengths d1 and d2.
       */
      join(joinedIndex1, joinedIndex2, d1, d2) {
          if (this.V) {
              this.joinBIONJ(joinedIndex1, joinedIndex2, d1, d2, this.V);
              return;
          }
          let { D, rowStart, removed, rowSums, newRow, rowChange } = this, n = this.N, sum = 0, aux, newMax = 0;
          let aux2 = this.distance(joinedIndex1, joinedIndex2);
          removed[joinedIndex1] = 1;
          for (let i = 0; i < n; i++) {
              if (removed[i])
                  continue;
              aux = this.distance(joinedIndex1, i) + this.distance(joinedIndex2, i);
              newRow[i] = 0.5 * (aux - aux2);
              sum += newRow[i];
              rowChange[i] = -0.5 * (aux + aux2);
          }
          for (let i = 0; i < n; i++) {
              if (removed[i])
                  continue;
              if (i !== joinedIndex2) {
                  if (i > joinedIndex2)
                      D[rowStart[i] + joinedIndex2] = newRow[i];
                  else
                      D[rowStart[joinedIndex2] + i] = newRow[i];
              }
              // This includes row joinedIndex2 itself, whose sum is replaced below;
              // the original implementation counted this interim value towards the
              // maximum, and the search's results depend on that bound.
              rowSums[i] += rowChange[i];
              if (rowSums[i] > newMax)
                  newMax = rowSums[i];
          }
          rowSums[joinedIndex1] = 0;
          rowSums[joinedIndex2] = sum;
          if (sum > newMax)
              newMax = sum;
          this.rowSumMax = newMax;
          this.sortRow(joinedIndex2);
          this.sortedLength[joinedIndex1] = 0;
          this.cN--;
      }
      /**
       * BIONJ's join (Gascuel 1997). The new node's distance to each row k is
       * lambda * (D[i][k] - d1) + (1 - lambda) * (D[j][k] - d2), where lambda
       * (clamped to [0, 1]) minimizes the variance of those distances; the
       * variances V are updated alongside. With lambda = 1/2 this is neighbor
       * joining's join.
       */
      joinBIONJ(i, j, d1, d2, V) {
          let { D, rowStart, removed, rowSums, newRow, rowChange } = this, n = this.N, r = this.cN;
          let variance = (a, b) => a > b ? V[rowStart[a] + b] : V[rowStart[b] + a];
          let vij = variance(i, j);
          let lambda = 0.5;
          if (vij !== 0) {
              let sum = 0;
              for (let k = 0; k < n; k++) {
                  if (removed[k] || k === i || k === j)
                      continue;
                  sum += variance(j, k) - variance(i, k);
              }
              lambda = Math.min(1, Math.max(0, 0.5 + sum / (2 * (r - 2) * vij)));
          }
          let newVariance = new Float64Array(n), sum = 0, newMax = 0;
          removed[i] = 1;
          for (let k = 0; k < n; k++) {
              if (removed[k] || k === j)
                  continue;
              let dik = this.distance(i, k), djk = this.distance(j, k);
              newRow[k] = lambda * (dik - d1) + (1 - lambda) * (djk - d2);
              newVariance[k] =
                  lambda * variance(i, k) +
                      (1 - lambda) * variance(j, k) -
                      lambda * (1 - lambda) * vij;
              sum += newRow[k];
              rowChange[k] = newRow[k] - dik - djk;
          }
          for (let k = 0; k < n; k++) {
              if (removed[k] || k === j)
                  continue;
              let at = k > j ? rowStart[k] + j : rowStart[j] + k;
              D[at] = newRow[k];
              V[at] = newVariance[k];
              rowSums[k] += rowChange[k];
              if (rowSums[k] > newMax)
                  newMax = rowSums[k];
          }
          rowSums[i] = 0;
          rowSums[j] = sum;
          if (sum > newMax)
              newMax = sum;
          this.rowSumMax = newMax;
          this.sortRow(j);
          this.sortedLength[i] = 0;
          this.cN--;
      }
  }
  /**
   * Builds a tree by UPGMA: repeatedly merges the two closest clusters into a
   * node at half their distance (so every leaf ends up equally far from the
   * root), and takes the merged cluster's distance to each other cluster to be
   * the size-weighted mean of its parts'. Each row remembers its nearest
   * neighbor, so finding the closest pair is O(n) per merge.
   */
  function upgma(matrix, labels, float32) {
      let N = matrix.length;
      let rowStart = new Float64Array(N);
      for (let i = 0; i < N; i++)
          rowStart[i] = (i * (i - 1)) / 2;
      let D = new (float32 ? Float32Array : Float64Array)((N * (N - 1)) / 2);
      for (let i = 0; i < N; i++) {
          let row = matrix[i];
          for (let j = 0; j < i; j++)
              D[rowStart[i] + j] = Number(row[j]);
      }
      let at = (a, b) => (a > b ? rowStart[a] + b : rowStart[b] + a);
      let store = new Store(2 * N);
      let node = new Int32Array(N), size = new Int32Array(N).fill(1), height = new Float64Array(N), removed = new Uint8Array(N), nearest = new Int32Array(N), nearestDistance = new Float64Array(N);
      for (let i = 0; i < N; i++)
          node[i] = store.add(labels[i], 0);
      // Finds row i's nearest other row (the lowest-numbered, on ties).
      function findNearest(i) {
          let best = Infinity, bestRow = -1;
          for (let k = 0; k < N; k++) {
              if (removed[k] || k === i)
                  continue;
              let d = D[at(i, k)];
              if (d < best) {
                  best = d;
                  bestRow = k;
              }
          }
          nearest[i] = bestRow;
          nearestDistance[i] = best;
      }
      for (let i = 0; i < N; i++)
          findNearest(i);
      for (let left = N; left > 1; left--) {
          // The closest pair, taking the lowest-numbered row on ties.
          let i = -1;
          for (let k = 0; k < N; k++) {
              if (removed[k])
                  continue;
              if (i === -1 || nearestDistance[k] < nearestDistance[i])
                  i = k;
          }
          let a = Math.min(i, nearest[i]), b = Math.max(i, nearest[i]);
          let h = D[at(a, b)] / 2;
          store.length[node[a]] = h - height[a];
          store.length[node[b]] = h - height[b];
          let parent = store.add("", 0);
          store.link(node[a], parent, NONE);
          store.link(node[b], parent, NONE);
          // Row a becomes the merged cluster; row b goes.
          for (let k = 0; k < N; k++) {
              if (removed[k] || k === a || k === b)
                  continue;
              D[at(a, k)] =
                  (size[a] * D[at(a, k)] + size[b] * D[at(b, k)]) / (size[a] + size[b]);
          }
          removed[b] = 1;
          size[a] += size[b];
          height[a] = h;
          node[a] = parent;
          findNearest(a);
          for (let k = 0; k < N; k++) {
              if (removed[k] || k === a)
                  continue;
              if (nearest[k] === a || nearest[k] === b) {
                  findNearest(k);
              }
              else {
                  let d = D[at(a, k)];
                  if (d < nearestDistance[k] || (d === nearestDistance[k] && a < nearest[k])) {
                      nearest[k] = a;
                      nearestDistance[k] = d;
                  }
              }
          }
      }
      // Each join keeps the lower-numbered row, so row 0 holds the root.
      return store.view(node[0]).fixDistances();
  }
  /**
   * @private
   * Sorts items (column indices) by their keys (distances), stably: items with
   * equal keys stay in the order given. A bottom-up merge sort on typed arrays,
   * which avoids Array.prototype.sort's comparator calls.
   */
  class ArgSorter {
      constructor(capacity) {
          this.keys = new Float64Array(capacity);
          this.items = new Int32Array(capacity);
          this.keyBuffer = new Float64Array(capacity);
          this.itemBuffer = new Int32Array(capacity);
      }
      /** Sorts the first n keys and items in place. */
      sort(n) {
          let keys = this.keys, items = this.items;
          // Insertion sort runs of 16.
          const RUN = 16;
          for (let start = 0; start < n; start += RUN) {
              let end = Math.min(start + RUN, n);
              for (let i = start + 1; i < end; i++) {
                  let key = keys[i], item = items[i], j = i - 1;
                  while (j >= start && keys[j] > key) {
                      keys[j + 1] = keys[j];
                      items[j + 1] = items[j];
                      j--;
                  }
                  keys[j + 1] = key;
                  items[j + 1] = item;
              }
          }
          // Merge runs, alternating between the arrays and the buffers.
          let fromKeys = keys, fromItems = items, toKeys = this.keyBuffer, toItems = this.itemBuffer;
          for (let width = RUN; width < n; width *= 2) {
              for (let left = 0; left < n; left += 2 * width) {
                  let middle = Math.min(left + width, n), right = Math.min(left + 2 * width, n), i = left, j = middle, k = left;
                  while (i < middle && j < right) {
                      // Take from the right only when strictly smaller, for stability.
                      if (fromKeys[j] < fromKeys[i]) {
                          toKeys[k] = fromKeys[j];
                          toItems[k++] = fromItems[j++];
                      }
                      else {
                          toKeys[k] = fromKeys[i];
                          toItems[k++] = fromItems[i++];
                      }
                  }
                  while (i < middle) {
                      toKeys[k] = fromKeys[i];
                      toItems[k++] = fromItems[i++];
                  }
                  while (j < right) {
                      toKeys[k] = fromKeys[j];
                      toItems[k++] = fromItems[j++];
                  }
              }
              [fromKeys, toKeys] = [toKeys, fromKeys];
              [fromItems, toItems] = [toItems, fromItems];
          }
          if (fromKeys !== keys) {
              keys.set(fromKeys.subarray(0, n));
              items.set(fromItems.subarray(0, n));
          }
      }
  }
  /**
   * Parses a Newick String and returns a Branch object representing the root
   * of the output Tree.
   *
   * Labels may be quoted with single or double quotes, which lets them contain
   * spaces and punctuation; a quote is escaped by doubling it (`'O''Brien'`).
   * Unquoted labels keep spaces inside them (and underscores as they are), and
   * whitespace around punctuation is ignored. Comments in square brackets are
   * skipped, except NHX annotations (`[&&NHX:key=value:...]`), which are read
   * into the `data.nhx` of the Branch they follow (and written back by
   * toNewick). Parsing stops at the first `;`, which may be left out.
   * @param  {string} newick A Newick String
   * @return {Branch} A Branch representing the root of the output tree
   * @throws {SyntaxError} If the parentheses don't balance, a quoted label or
   * comment isn't closed, or a comma appears outside parentheses.
   */
  function parseNewick(newick) {
      let store = new Store(), ancestors = [], current = store.add("", 0), n = newick.length, i = 0;
      function fail(message, at) {
          throw new SyntaxError(`Invalid Newick: ${message} at position ${at}.`);
      }
      // Skips whitespace and [comments], reading NHX annotations
      // ([&&NHX:key=value:...]) into the data of the Branch they follow.
      function skip() {
          while (i < n) {
              let c = newick.charCodeAt(i);
              if (c === 91 /* [ */) {
                  let close = newick.indexOf("]", i + 1);
                  if (close === -1)
                      fail("unterminated comment", i);
                  if (newick.startsWith("&&NHX", i + 1)) {
                      readNHX(newick.slice(i + 6, close));
                  }
                  i = close + 1;
              }
              else if (c <= 32) {
                  i++;
              }
              else {
                  return;
              }
          }
      }
      function readNHX(fields) {
          var _a;
          let data = ((_a = store.data)[current] ?? (_a[current] = {}));
          let nhx = (data.nhx ?? (data.nhx = {}));
          for (let field of fields.split(":")) {
              if (!field)
                  continue;
              let equals = field.indexOf("=");
              if (equals === -1)
                  nhx[field] = "";
              else
                  nhx[field.slice(0, equals)] = field.slice(equals + 1);
          }
      }
      // Reads an unquoted label or length, up to the next punctuation or comment,
      // without surrounding whitespace.
      function bare() {
          let start = i;
          while (i < n) {
              let c = newick.charCodeAt(i);
              if (c === 40 /* ( */ ||
                  c === 41 /* ) */ ||
                  c === 44 /* , */ ||
                  c === 58 /* : */ ||
                  c === 59 /* ; */ ||
                  c === 91 /* [ */) {
                  break;
              }
              i++;
          }
          return newick.slice(start, i).trim();
      }
      // Reads a label in quotes, where a doubled quote stands for one quote.
      function quoted(quote) {
          let start = i, label = "";
          i++;
          for (;;) {
              let close = newick.indexOf(quote, i);
              if (close === -1)
                  fail("unterminated quoted label", start);
              label += newick.slice(i, close);
              i = close + 1;
              if (newick[i] !== quote)
                  return label;
              label += quote;
              i++;
          }
      }
      scan: for (;;) {
          skip();
          if (i >= n)
              break;
          let c = newick[i];
          switch (c) {
              case "(": {
                  let child = store.add("", 0);
                  store.link(child, current, NONE);
                  ancestors.push(current);
                  current = child;
                  i++;
                  break;
              }
              case ",": {
                  if (!ancestors.length)
                      fail("',' outside parentheses", i);
                  let child = store.add("", 0);
                  store.link(child, ancestors[ancestors.length - 1], NONE);
                  current = child;
                  i++;
                  break;
              }
              case ")":
                  if (!ancestors.length)
                      fail("')' without a matching '('", i);
                  current = ancestors.pop();
                  i++;
                  break;
              case ":":
                  i++;
                  skip();
                  store.length[current] = parseFloat(bare());
                  break;
              case ";":
                  break scan;
              case "'":
              case '"':
                  store.ids[current] = quoted(c);
                  break;
              default:
                  store.ids[current] = bare();
          }
      }
      if (ancestors.length)
          fail("missing ')'", n);
      return store.view(0).fixDistances();
  }

  var patristic = /*#__PURE__*/Object.freeze({
      __proto__: null,
      Branch: Branch,
      parseJSON: parseJSON,
      parseMatrix: parseMatrix,
      parseNewick: parseNewick,
      version: version
  });

  var patristic$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Branch: Branch,
    default: patristic,
    parseJSON: parseJSON,
    parseMatrix: parseMatrix,
    parseNewick: parseNewick,
    version: version
  });

  const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  /**
   * Returns the indices (among all numbers in the path) of arc flags, i.e. the
   * large-arc-flag and sweep-flag arguments of each `A`/`a` command. These must
   * be 0 or 1, so they cannot be linearly interpolated.
   */
  function arcFlagIndices(path) {
      const flags = new Set();
      const token = /([A-Za-z])|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
      let command = "";
      let argIndex = 0;
      let numIndex = 0;
      let m;
      while ((m = token.exec(path))) {
          if (m[1]) {
              command = m[1].toUpperCase();
              argIndex = 0;
          }
          else {
              if (command === "A") {
                  const k = argIndex % 7;
                  if (k === 3 || k === 4)
                      flags.add(numIndex);
              }
              argIndex++;
              numIndex++;
          }
      }
      return flags;
  }
  /**
   * Interpolates between two SVG path strings with the same command structure,
   * keeping arc flags valid (0 or 1). d3's default string interpolation tweens
   * every number, including arc flags, producing invalid path data such as
   * `A45,45 0 0 0.5 …` mid-transition.
   *
   * If the paths have different structures (e.g. switching between straight,
   * square and smooth branches), both are resampled into polylines with the
   * same number of points and those are tweened instead. Where the DOM can't
   * measure paths (no `getPointAtLength`), the interpolator jumps to the target.
   */
  function interpolatePath(a, b) {
      const template = b.replace(NUMBER, "#");
      if (a.replace(NUMBER, "#") !== template)
          return resampledInterpolator(a, b);
      const from = (a.match(NUMBER) || []).map(Number);
      const to = (b.match(NUMBER) || []).map(Number);
      const flags = arcFlagIndices(b);
      return (t) => {
          if (t >= 1)
              return b;
          let i = 0;
          return template.replace(/#/g, () => {
              const v = from[i] + (to[i] - from[i]) * t;
              return String(flags.has(i++) ? Math.round(v) : v);
          });
      };
  }
  const SAMPLES = 32;
  let scratch = null;
  /**
   * Samples `SAMPLES + 1` evenly spaced points along a path, or returns null if
   * the environment can't measure SVG paths.
   */
  function samplePath(d) {
      if (typeof document === "undefined" || !document.body)
          return null;
      if (!scratch || !scratch.isConnected) {
          // Some browsers can't measure paths that aren't in the document, so keep
          // the scratch path in an invisible, zero-size SVG.
          const ns = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(ns, "svg");
          svg.setAttribute("aria-hidden", "true");
          svg.setAttribute("width", "0");
          svg.setAttribute("height", "0");
          svg.style.position = "absolute";
          svg.style.visibility = "hidden";
          scratch = document.createElementNS(ns, "path");
          svg.appendChild(scratch);
          document.body.appendChild(svg);
      }
      if (typeof scratch.getTotalLength !== "function" || typeof scratch.getPointAtLength !== "function")
          return null;
      scratch.setAttribute("d", d);
      let length;
      try {
          length = scratch.getTotalLength();
      }
      catch {
          return null;
      }
      if (!isFinite(length))
          return null;
      const points = [];
      for (let i = 0; i <= SAMPLES; i++) {
          const p = scratch.getPointAtLength((length * i) / SAMPLES);
          points.push([p.x, p.y]);
      }
      return points;
  }
  function resampledInterpolator(a, b) {
      const from = samplePath(a);
      const to = from && samplePath(b);
      if (!from || !to)
          return () => b;
      return (t) => {
          if (t >= 1)
              return b;
          if (t <= 0)
              return a;
          return "M" + from
              .map(([x, y], i) => `${x + (to[i][0] - x) * t},${y + (to[i][1] - y) * t}`)
              .join("L");
      };
  }

  // Branch and node label geometry. For the circular and radial layouts, angles
  // follow d3's convention (0 at 12 o'clock, increasing clockwise), so these
  // agree with d3.linkRadial / d3.pointRadial.
  const radToDeg$1 = 180 / Math.PI;
  /** Converts a polar position (angle, radius) to SVG [x, y]. */
  function circularPoint(angle, radius) {
      radius = +radius;
      angle -= Math.PI / 2;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
  }
  /** Rotation (degrees) that keeps text along direction (dx, dy) upright. */
  function uprightRotation(dx, dy) {
      if (dx === 0 && dy === 0)
          return 0;
      if (dx === 0)
          return 90;
      return Math.atan(dy / dx) * radToDeg$1;
  }
  /**
   * Branch label for a smooth link in a horizontal or vertical layout
   * (d3.linkHorizontal / d3.linkVertical), given its ends in screen coordinates.
   * These curves are symmetric, so their midpoint is the chord's midpoint, but
   * their tangent there has twice the chord's slope across the depth axis.
   * @param horizontal - true for d3.linkHorizontal (depth runs along x).
   */
  function smoothLinkLabel(x0, y0, x1, y1, horizontal) {
      const dx = x1 - x0, dy = y1 - y0;
      const rotation = horizontal ? uprightRotation(dx, 2 * dy) : uprightRotation(2 * dx, dy);
      return `translate(${(x0 + x1) / 2}, ${(y0 + y1) / 2}) rotate(${rotation})`;
  }
  /**
   * Branch label for a smooth radial link (d3.linkRadial, a cubic Bézier with
   * control points at the mid radius): placed at the curve's midpoint and
   * aligned with its tangent there.
   */
  function smoothRadialLinkLabel(sourceAngle, sourceRadius, targetAngle, targetRadius) {
      const midRadius = (sourceRadius + targetRadius) / 2;
      const p0 = circularPoint(sourceAngle, sourceRadius);
      const p1 = circularPoint(sourceAngle, midRadius);
      const p2 = circularPoint(targetAngle, midRadius);
      const p3 = circularPoint(targetAngle, targetRadius);
      const x = (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8;
      const y = (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8;
      const rotation = uprightRotation(p3[0] + p2[0] - p1[0] - p0[0], p3[1] + p2[1] - p1[1] - p0[1]);
      return `translate(${x}, ${y}) rotate(${rotation})`;
  }
  /** Branch label for a straight link drawn as a chord from source to target. */
  function chordLinkLabel(sourceAngle, sourceRadius, targetAngle, targetRadius) {
      const s = circularPoint(sourceAngle, sourceRadius);
      const t = circularPoint(targetAngle, targetRadius);
      return `translate(${(s[0] + t[0]) / 2}, ${(s[1] + t[1]) / 2}) rotate(${uprightRotation(t[0] - s[0], t[1] - s[1])})`;
  }
  /**
   * Branch label for an elbow link (an arc at the source radius, then a radial
   * line out to the target): placed at the middle of the radial line.
   */
  function elbowLinkLabel(sourceRadius, targetAngle, targetRadius) {
      const u = circularPoint(targetAngle, (sourceRadius + targetRadius) / 2);
      return `translate(${u[0]}, ${u[1]}) rotate(${((targetAngle * radToDeg$1) % 180) - 90})`;
  }
  /**
   * Whether a node label at this angle is on the left half of the circle, where
   * it is flipped (anchored at its end) so it reads outward and stays upright.
   * The 6 o'clock position (angle π) counts as the left half: its rotation is
   * -90°, so only an end anchor points the text away from the center.
   */
  function isLeftHalf(angle) {
      return angle % (2 * Math.PI) >= Math.PI;
  }

  // Earlier builds bundled patristic's UMD build, which defined a global
  // `patristic`. Keep providing it for pages that relied on that.
  if (typeof globalThis !== "undefined" && !globalThis.patristic) {
      globalThis.patristic = patristic$1;
  }
  class TidyTree {
      /**
       * This class function creates a TidyTree object.
       * @param data A valid newick string or patristic.Branch object
       * @param options A Javascript object containing options to set up the tree
       * @param events Event handlers
       */
      constructor(data, options, events) {
          this.layout = "vertical";
          this.type = "tree";
          this.mode = "smooth";
          this.colorOptions = { nodeColorMode: "none" };
          this.leafNodes = true;
          this.leafLabels = false;
          this.equidistantLeaves = false;
          this.branchNodes = false;
          this.branchLabels = false;
          this.branchDistances = false;
          this.hStretch = 1;
          this.vStretch = 1;
          this.rotation = 0;
          this.ruler = true;
          this.interactive = true;
          this.animation = 500;
          this.margin = [50, 50, 50, 50];
          this.nodeSize = 3;
          this.nodeLabelSize = 12;
          this.branchLabelSize = 10;
          this.branchWidth = 2;
          this.fontFamily = "'Inter', sans-serif";
          this.nodeShape = "circle";
          this.virtualize = false;
          this.virtualizationThreshold = 1000;
          this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
          this.width = 0;
          this.height = 0;
          this.scalar = 0;
          this.transform = identity;
          /** True once destroy() has been called; queued redraws are skipped. */
          this._destroyed = false;
          /** Pending requestAnimationFrame ids for queued redraws. */
          this._pendingFrames = new Set();
          this.collapsedNodes = new Set();
          this.annotations = new Map();
          this.temporalAnnotations = new Map();
          this.showTemporalAnnotations = true;
          this.events = {
              draw: [],
              showtooltip: [],
              hidetooltip: [],
              contextmenu: [],
              search: [],
              select: []
          };
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
          if (!options)
              options = {};
          // Handle parent: convert string selector to d3 Selection before assignment
          const parentValue = options.parent;
          if (typeof parentValue === 'string') {
              options.parent = select(parentValue);
          }
          Object.assign(this, defaults, options);
          if (events) {
              Object.keys(events).forEach(e => {
                  const key = e;
                  const value = events[key];
                  if (Array.isArray(value)) {
                      this.events[key].push(...value);
                  }
                  else if (typeof value === 'function') {
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
          if (this.parent)
              this.draw(this.parent);
          if (typeof data === "string") {
              this.setTree(data);
          }
          else {
              this.setData(data);
          }
          if (this.parent)
              this.recenter();
      }
      /**
       * Update the TidyTree's underlying data structure
       * There are two contexts in which you should call this:
       * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
       * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
       * @param data A patristic.Branch object
       * @return the TidyTree object
       */
      setData(data) {
          if (!data)
              throw Error("Invalid Data");
          this.data = data;
          this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
          this.hierarchy = hierarchy(this.data, (d) => d.children)
              .eachBefore((d) => {
              d.value =
                  (d.parent ? d.parent.value : 0) + (d.data.length ? Math.abs(d.data.length) : 0);
              if (d.value < this.range[0])
                  this.range[0] = d.value;
              if (d.value > this.range[1])
                  this.range[1] = d.value;
          })
              .each((d) => (d.value /= this.range[1]));
          if (this.parent)
              return this.redraw();
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
      setTree(newick) {
          if (!newick)
              throw Error("Invalid Newick String");
          return this.setData(parseNewick(newick));
      }
      /**
       * Returns the CSS selector for the node glyph element based on the current nodeShape.
       * @return The selector string ("circle", "rect", or "polygon").
       */
      _nodeGlyphSelector() {
          const shape = this.nodeShape || "circle";
          return shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";
      }
      /**
       * Private method to calculate how much vertical space to leave for the ruler
       */
      _rulerOffset() {
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
      draw(selector) {
          if (!selector && !this.parent) {
              throw Error("No valid target for drawing given! Where should the tree go?");
          }
          let parent;
          if (typeof selector === 'string') {
              parent = select(selector);
              if (parent.empty()) {
                  throw Error(`Invalid selector: ${selector}`);
              }
              this.parent = parent;
          }
          else {
              parent = selector;
              this.parent = selector;
          }
          this.width =
              parseFloat(parent.style("width")) - this.margin[1] - this.margin[3];
          this.height =
              parseFloat(parent.style("height")) - this.margin[0] - this.margin[2] - this._rulerOffset();
          tree();
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
          this.zoom = zoom().on("zoom", (e) => {
              const transform = e.transform;
              this.transform = transform;
              g.attr("transform", `translate(${transform.x},${transform.y}) scale(${transform.k}) rotate(${this.rotation},${this.layout === "circular" ? 0 : this.width / 2},${this.layout === "circular" ? 0 : this.height / 2})`);
              updateRuler.call(this, transform);
              // When virtualization is active, re-render on zoom to show/hide nodes based on viewport
              if (this.virtualize) {
                  this.redraw();
              }
          });
          if (this.interactive) {
              svg.call(this.zoom);
          }
          else {
              svg.on('.zoom', null);
          }
          g.append("g").attr("class", "tidytree-links");
          g.append("g").attr("class", "tidytree-nodes");
          if (this.events.draw.length)
              this.events.draw.forEach(c => c());
          return this;
      }
      /**
       * Set the TidyTree's layout
       * @param newLayout The new layout
       * @return The TidyTree Object
       */
      setLayout(newLayout) {
          if (!TidyTree.validLayouts.includes(newLayout)) {
              throw Error(`
        Cannot set TidyTree to layout: ${newLayout}\n
        Valid layouts are: ${TidyTree.validLayouts.join(', ')}
      `);
          }
          this.layout = newLayout;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the TidyTree's colorOptions
       * @param newColorOptions The new colorOptions
       * @return The TidyTree Object
       */
      setColorOptions(newColorOptions) {
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
          }
          else if (newColorOptions.nodeColorMode === 'heatmap' || newColorOptions.nodeColorMode === 'gradient') {
              // Heatmap/gradient modes don't require a predicate or nodeList
              if (!newColorOptions.heatmapStart)
                  newColorOptions.heatmapStart = "#2c3e50";
              if (!newColorOptions.heatmapEnd)
                  newColorOptions.heatmapEnd = "#e67e22";
          }
          else {
              // nodeColorMode === 'none'
              if (newColorOptions.branchColorMode !== 'none') {
                  throw Error('branchColorMode must be "none" for nodeColorMode "none"');
              }
          }
          this.colorOptions = newColorOptions;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the TidyTree's mode
       * @param newMode The new mode
       * @return the TidyTree object
       */
      setMode(newMode) {
          if (!TidyTree.validModes.includes(newMode)) {
              throw Error(`
        Cannot set TidyTree to mode: ${newMode},\n
        Valid modes are: ${TidyTree.validModes.join(', ')}
      `);
          }
          this.mode = newMode;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the TidyTree's type
       * @param newType The new type
       * @return the TidyTree object
       */
      setType(newType) {
          if (!TidyTree.validTypes.includes(newType)) {
              throw Error(`
        Cannot set TidyTree to type: ${newType},\n
        Valid types are: ${TidyTree.validTypes.join(', ')}
      `);
          }
          this.type = newType;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the TidyTree's rotation
       * @param degrees The new number of degrees by which to rotate the tree
       * @return the TidyTree object
       */
      setRotation(degrees) {
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
      setHStretch(proportion) {
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
      setVStretch(proportion) {
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
      setAnimation(time) {
          this.animation = time;
          return this;
      }
      /**
       * Shows or hides the Branch Nodes
       * @param show Should Branch nodes be shown?
       * @return the TidyTree object
       */
      setBranchNodes(show) {
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
      eachBranchNode(styler) {
          if (!this.parent)
              throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
          this.parent
              .select("svg")
              .selectAll(`g.tidytree-node-internal ${this._nodeGlyphSelector()}`)
              .each(function (d) { styler(this, d); });
          return this;
      }
      /**
       * Set the TidyTree's branchLabels
       * @param show Should the TidyTree show branchLabels?
       * @return the TidyTree Object
       */
      setBranchLabels(show) {
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
      eachBranchLabel(styler) {
          if (!this.parent) {
              throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
          }
          this.parent
              .select("svg")
              .selectAll("g.tidytree-node-internal text")
              .each(function (d) { styler(this, d); });
          return this;
      }
      /**
       * Shows or hides the TidyTree's branch labels
       * @param show Should the TidyTree show branch distances?
       * @return The TidyTree Object
       */
      setBranchDistances(show) {
          this.branchDistances = show ? true : false;
          if (this.parent) {
              //i.e. has already been drawn
              const links = this.parent
                  .select("svg g.tidytree-links")
                  .selectAll("g.tidytree-link")
                  .selectAll("text");
              links.attr("transform", (d) => labelTransformers[this.type][this.mode][this.layout](d));
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
      eachBranchDistance(styler) {
          if (!this.parent)
              throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
          this.parent
              .select("svg g.tidytree-links")
              .selectAll("g.tidytree-link")
              .selectAll("text")
              .each(function (d) { styler(this, d); });
          return this;
      }
      /**
       * Shows or Hides the Leaf Nodes
       * @param show Should leaf nodes be visible?
       * @return The TidyTree Object
       */
      setLeafNodes(show) {
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
      eachLeafNode(styler) {
          if (!this.parent) {
              throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
          }
          this.parent
              .select("svg")
              .selectAll(`g.tidytree-node-leaf ${this._nodeGlyphSelector()}`)
              .each(function (d) {
              styler(this, d);
          });
          return this;
      }
      /**
       * Set the TidyTree's leaves to be equidistant
       */
      setEquidistantLeaves(isEquidistant) {
          this.equidistantLeaves = isEquidistant ? true : false;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Shows or Hides the TidyTree's Leaf Labels
       * @param show Should the TidyTree show leafLabels?
       * @return the TidyTree Object
       */
      setLeafLabels(show) {
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
      eachLeafLabel(styler) {
          if (!this.parent) {
              throw Error("Tree has not been rendered yet! Can't style Nodes that don't exist!");
          }
          this.parent
              .select("svg")
              .selectAll("g.tidytree-node-leaf text")
              .each(function (d) { styler(this, d); });
          return this;
      }
      /**
       * Shows or hides the TidyTree's branch labels
       * @param show Should the TidyTree show branchLabels?
       * @return The TidyTree Object
       */
      setRuler(show) {
          this.ruler = show ? true : false;
          if (this.parent) {
              //i.e. has already been drawn
              if (show) {
                  this.parent
                      .select("g.tidytree-ruler")
                      .transition()
                      .duration(this.animation)
                      .attr("opacity", 1);
              }
              else {
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
      setTooltipFormatter(formatter) {
          this.tooltipFormatter = formatter;
          return this;
      }
      /**
       * Collapse or expand a subtree rooted at the given node GUID.
       * If the node is already collapsed, it will be expanded; otherwise it will be collapsed.
       * @param nodeGuid The GUID of the node whose subtree to collapse/expand.
       * @return The TidyTree object.
       */
      collapseNode(nodeGuid) {
          if (this.collapsedNodes.has(nodeGuid)) {
              this.collapsedNodes.delete(nodeGuid);
          }
          else {
              this.collapsedNodes.add(nodeGuid);
          }
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Check whether a node is currently collapsed.
       * @param nodeGuid The GUID of the node to check.
       * @return True if the node is collapsed, false otherwise.
       */
      isNodeCollapsed(nodeGuid) {
          return this.collapsedNodes.has(nodeGuid);
      }
      /**
       * Returns an array of all descendant GUIDs (including the node itself) for a given node GUID.
       * @param nodeGuid The GUID of the root node.
       * @return Array of descendant GUIDs.
       */
      getDescendantGUIDs(nodeGuid) {
          const result = [];
          let found = false;
          this.hierarchy?.eachBefore((d) => {
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
      _getFilteredHierarchy() {
          if (this.collapsedNodes.size === 0) {
              return this.hierarchy;
          }
          // Collect all GUIDs to exclude (collapsed nodes + their descendants)
          const excluded = new Set();
          this.collapsedNodes.forEach(guid => {
              this.getDescendantGUIDs(guid).forEach(g => excluded.add(g));
          });
          // Build a filtered hierarchy by walking the original and skipping excluded nodes
          const root = this.hierarchy;
          let filteredRoot = null;
          const nodeMap = new Map();
          // First pass: create filtered nodes for non-excluded nodes
          root.eachBefore((d) => {
              if (excluded.has(d.data._guid))
                  return;
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
          root.eachBefore((d) => {
              if (excluded.has(d.data._guid))
                  return;
              const copy = nodeMap.get(d.data._guid);
              if (d.parent && !excluded.has(d.parent.data._guid)) {
                  const parentCopy = nodeMap.get(d.parent.data._guid);
                  copy.parent = parentCopy;
                  parentCopy.children.push(copy);
              }
              else {
                  // This is a new root (its parent was collapsed)
                  copy.parent = null;
                  if (!filteredRoot)
                      filteredRoot = copy;
              }
          });
          // If no nodes remain, return a minimal hierarchy
          if (!filteredRoot) {
              filteredRoot = { data: root.data, children: [], parent: null, depth: 0, height: 0, value: 0, weight: 0, x: 0, y: 0 };
          }
          // Convert to d3 hierarchy
          return hierarchy(filteredRoot, (d) => d.children);
      }
      /**
       * Returns a filtered hierarchy containing only nodes within the visible viewport.
       * Used for virtualization of large trees (1000+ nodes).
       * @param hierarchy The full filtered hierarchy
       * @return A d3 hierarchy with only visible nodes
       */
      _getVisibleHierarchy(hierarchy$1) {
          const width = this.width;
          const height = this.height;
          this.margin;
          // Compute the visible bounds based on current zoom transform
          const k = this.transform.k;
          const x = -this.transform.x / k;
          const y = -this.transform.y / k;
          const viewWidth = width / k;
          const viewHeight = height / k;
          // Collect visible node GUIDs
          const visibleGuids = new Set();
          const visibleNodes = [];
          hierarchy$1.eachBefore((d) => {
              const nodeX = d.x;
              const nodeY = d.y;
              // Check if node is within the visible viewport (with some padding)
              const padding = 50;
              if (nodeX >= x - padding &&
                  nodeX <= x + viewWidth + padding &&
                  nodeY >= y - padding &&
                  nodeY <= y + viewHeight + padding) {
                  visibleGuids.add(d.data._guid);
                  visibleNodes.push(d);
              }
          });
          // Always include root and ancestors of visible nodes so the tree structure is preserved
          const ancestorsGuids = new Set();
          visibleNodes.forEach(d => {
              let ancestor = d.parent;
              while (ancestor) {
                  ancestorsGuids.add(ancestor.data._guid);
                  ancestor = ancestor.parent;
              }
          });
          // Build a new hierarchy with only visible nodes + their ancestors
          const root = hierarchy$1;
          let visibleRoot = null;
          const nodeMap = new Map();
          // First pass: create copies for visible nodes and their ancestors
          root.eachBefore((d) => {
              if (!visibleGuids.has(d.data._guid) && !ancestorsGuids.has(d.data._guid))
                  return;
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
          root.eachBefore((d) => {
              if (!visibleGuids.has(d.data._guid) && !ancestorsGuids.has(d.data._guid))
                  return;
              const copy = nodeMap.get(d.data._guid);
              if (d.parent && (visibleGuids.has(d.parent.data._guid) || ancestorsGuids.has(d.parent.data._guid))) {
                  const parentCopy = nodeMap.get(d.parent.data._guid);
                  copy.parent = parentCopy;
                  parentCopy.children.push(copy);
              }
              else {
                  copy.parent = null;
                  if (!visibleRoot)
                      visibleRoot = copy;
              }
          });
          // If no nodes remain, return a minimal hierarchy
          if (!visibleRoot) {
              visibleRoot = { data: root.data, children: [], parent: null, depth: 0, height: 0, value: 0, weight: 0, x: 0, y: 0 };
          }
          // Convert to d3 hierarchy
          return hierarchy(visibleRoot, (d) => d.children);
      }
      /**
       * Add or update an annotation (metadata) for a specific node.
       * @param nodeGuid The GUID of the node to annotate.
       * @param data The annotation data to store.
       * @return The TidyTree object.
       */
      addAnnotation(nodeGuid, data) {
          this.annotations.set(nodeGuid, data);
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Retrieve the annotation data for a specific node.
       * @param nodeGuid The GUID of the node.
       * @return The annotation data, or undefined if none exists.
       */
      getAnnotation(nodeGuid) {
          return this.annotations.get(nodeGuid);
      }
      /**
       * Remove the annotation for a specific node.
       * @param nodeGuid The GUID of the node.
       * @return The TidyTree object.
       */
      removeAnnotation(nodeGuid) {
          this.annotations.delete(nodeGuid);
          if (this.parent)
              return this.redraw();
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
      addTemporalAnnotation(guid, start, end, label, color) {
          this.temporalAnnotations.set(guid, { guid, start, end, label, color });
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Retrieve the temporal annotation for a specific node.
       * @param guid The GUID of the node.
       * @return The temporal annotation data, or undefined if none exists.
       */
      getTemporalAnnotation(guid) {
          return this.temporalAnnotations.get(guid);
      }
      /**
       * Remove the temporal annotation for a specific node.
       * @param guid The GUID of the node.
       * @return The TidyTree object.
       */
      removeTemporalAnnotation(guid) {
          this.temporalAnnotations.delete(guid);
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set whether temporal annotations are visible.
       * @param show Whether to show temporal annotations.
       * @return The TidyTree object.
       */
      setShowTemporalAnnotations(show) {
          this.showTemporalAnnotations = show;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Retrieves the GUIDs of the nodes in the TidyTree instance.
       *
       * @param leavesOnly - Whether to retrieve GUIDs only for leaf nodes.
       * @param predicate - A function that returns true if the node should be included
       * @return An array of GUIDs of the nodes.
       */
      getNodeGUIDs(leavesOnly, predicate) {
          const glyph = this._nodeGlyphSelector();
          const selector = leavesOnly
              ? `g.tidytree-node-leaf ${glyph}`
              : `g.tidytree-node-leaf ${glyph}, g.tidytree-node-internal ${glyph}`;
          const nodes = this.parent
              .select("svg")
              .selectAll(selector)
              .nodes();
          const nodeGUIDs = [];
          for (const node of nodes) {
              if (!predicate || predicate(node)) {
                  const datum = node.__data__;
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
      search(test) {
          if (!test)
              return undefined;
          const results = this.parent
              .select("svg g.tidytree-nodes")
              .selectAll("g.tidytree-node")
              .filter(test);
          if (this.events.search.length)
              this.events.search.forEach(c => c(results));
          return results;
      }
      /**
       * Attaches a new event listener
       * Please note that this is not yet functioning.
       * @param events A space-delimited list of event names
       * @param callback The function to run when one of the `events` occurs.
       * @return The TidyTree on which this method was called.
       */
      on(events, callback) {
          events.split(" ").forEach(event => this.events[event].push(callback));
          return this;
      }
      /**
       * Removes all event listeners from the given events
       * @param events A space-delimited list of event names
       * @return The TidyTree on which this method was called.
       */
      off(events) {
          events.split(" ").forEach(event => (this.events[event] = []));
          return this;
      }
      /**
       * Forces the tree to respond as though an `event` has occurred
       * @param events space-delimited list of names of events to trigger.
       * @param args Any arguments which should be passed to the event
       * handler(s).
       * @return The output of the callback run on `event`
       */
      trigger(events, ...args) {
          return events.split(" ").map(event => {
              if (this.events[event].length)
                  return this.events[event].map(handler => handler(args));
              return [];
          });
      }
      /**
       * Destroys the TidyTree
       * @return undefined
       */
      destroy() {
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
      _transition(selection, attrs, applyFn) {
          if (!this.animation || this.animation <= 0) {
              if (applyFn)
                  applyFn(selection);
              else if (attrs) {
                  Object.entries(attrs).forEach(([key, value]) => {
                      if (key.startsWith("style:")) {
                          selection.style(key.slice(6), String(value));
                      }
                      else {
                          selection.attr(key, value);
                      }
                  });
              }
              return selection;
          }
          const transition = selection.transition().duration(this.animation);
          if (applyFn)
              applyFn(transition);
          else if (attrs) {
              Object.entries(attrs).forEach(([key, value]) => {
                  if (key.startsWith("style:")) {
                      transition.style(key.slice(6), String(value));
                  }
                  else {
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
      redraw() {
          // eslint-disable-next-line @typescript-eslint/no-this-alias -- d3 .each(function) callbacks below rebind `this` to the DOM element
          const tree$1 = this;
          if (tree$1._destroyed)
              return tree$1;
          // Wrap the redraw in requestAnimationFrame for smoother rendering
          const frame = requestAnimationFrame(() => {
              tree$1._pendingFrames.delete(frame);
              // destroy() may have run after this frame was queued
              if (tree$1._destroyed || !tree$1.parent)
                  return;
              const parent = tree$1.parent;
              tree$1.width = (parseFloat(parent.style("width")) - tree$1.margin[1] - tree$1.margin[3]) * tree$1.hStretch;
              tree$1.height = (parseFloat(parent.style("height")) - tree$1.margin[0] - tree$1.margin[2] - tree$1._rulerOffset()) * tree$1.vStretch;
              tree$1.scalar =
                  tree$1.layout === "horizontal" ? tree$1.width :
                      tree$1.layout === "vertical" ? tree$1.height :
                          Math.min(tree$1.width, tree$1.height) / 2;
              tree$1.hierarchy?.each((d) => (d.weight = tree$1.scalar * d.value));
              // Build a filtered hierarchy that excludes collapsed subtrees
              const filteredHierarchy = tree$1._getFilteredHierarchy();
              // --- Virtualization: only render visible nodes for large trees ---
              let visibleHierarchy = filteredHierarchy;
              if (tree$1.virtualize && filteredHierarchy.descendants().length > tree$1.virtualizationThreshold) {
                  visibleHierarchy = tree$1._getVisibleHierarchy(filteredHierarchy);
              }
              const g = parent.select("svg g");
              const source = (tree$1.type === "tree" ? tree() : cluster()).size(tree$1.layout === "circular" ? [2 * Math.PI, Math.min(tree$1.height, tree$1.width) / 2] :
                  tree$1.layout === "radial" ? [2 * Math.PI, Math.min(tree$1.height, tree$1.width) / 2] :
                      tree$1.layout === "unrooted" ? [tree$1.width, tree$1.height] :
                          tree$1.layout === "horizontal" ? [tree$1.height, tree$1.width] :
                              [tree$1.width, tree$1.height]);
              if (tree$1.equidistantLeaves) {
                  if (tree$1.layout === "circular" || tree$1.layout === "radial") {
                      source.separation((a, b) => 1 / a.depth);
                  }
                  else {
                      source.separation((a, b) => 1);
                  }
              }
              else {
                  if (tree$1.layout === "circular" || tree$1.layout === "radial")
                      source.separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
              }
              //Note: You must render links prior to nodes in order to get correct placement!
              const links = g
                  .select("g.tidytree-links")
                  .selectAll("g.tidytree-link")
                  .data(source(visibleHierarchy).links(), (l) => l.source.data._guid + ':' + l.target.data._guid);
              links.join((enter) => {
                  const newLinks = enter.append("g").attr("class", "tidytree-link");
                  const linkTransformer = linkTransformers[tree$1.type][tree$1.mode][tree$1.layout];
                  newLinks
                      .append("path")
                      .attr("fill", "none")
                      .attr("stroke", (d) => findBranchColor(d, tree$1.colorOptions))
                      .attr("d", linkTransformer)
                      .transition()
                      .duration(tree$1.animation)
                      .attr("opacity", 1);
                  const labelTransformer = labelTransformers[tree$1.type][tree$1.mode][tree$1.layout];
                  newLinks
                      .append("text")
                      .attr("y", 2)
                      .attr("text-anchor", "middle")
                      .style("font-size", tree$1.branchLabelSize + "px")
                      .text(labeler)
                      .attr("transform", (d) => labelTransformer(d))
                      .transition()
                      .duration(tree$1.animation)
                      .style("opacity", tree$1.branchDistances ? 1 : 0);
              }, (update) => {
                  // Progressive transition: update attributes smoothly without fading out
                  const linkTransformer = linkTransformers[tree$1.type][tree$1.mode][tree$1.layout];
                  const paths = update.select("path");
                  if (!(tree$1.animation > 0)) {
                      paths
                          .attr("d", linkTransformer)
                          .attr("stroke", (d) => findBranchColor(d, tree$1.colorOptions))
                          .attr("opacity", 1);
                  }
                  else {
                      // Transition d (path), stroke, and opacity simultaneously over full animation duration
                      paths
                          .transition()
                          .duration(tree$1.animation)
                          // Not attr("d", …): d3's string interpolation would tween arc
                          // flags through invalid fractional values (see #80).
                          .attrTween("d", function (d) {
                          return interpolatePath(this.getAttribute("d") || "", linkTransformer(d));
                      })
                          .attr("stroke", (d) => findBranchColor(d, tree$1.colorOptions))
                          .attr("opacity", 1);
                  }
                  const labelTransformer = labelTransformers[tree$1.type][tree$1.mode][tree$1.layout];
                  const labels = update.select("text");
                  if (tree$1.animation) {
                      // One transition for transform, opacity and text: a second unnamed
                      // transition on the same element would interrupt this one (see #83).
                      labels
                          .transition()
                          .duration(tree$1.animation)
                          .attr("transform", (d) => labelTransformer(d))
                          .style("opacity", tree$1.branchDistances ? 1 : 0)
                          .text(labeler);
                  }
                  else {
                      labels.text(labeler).attr("transform", (d) => labelTransformer(d));
                      labels.style("opacity", tree$1.branchDistances ? 1 : 0);
                  }
              }, (exit) => exit
                  .transition()
                  .duration(tree$1.animation)
                  .remove());
              const nodes = g
                  .select("g.tidytree-nodes")
                  .selectAll("g.tidytree-node")
                  .data(visibleHierarchy.descendants(), (d) => d.data._guid);
              const t = tree$1;
              nodes.join((enter) => {
                  const nt = nodeTransformers[tree$1.type][tree$1.layout];
                  const newNodes = enter
                      .append("g")
                      .attr("class", "tidytree-node")
                      .classed("tidytree-node-internal", (d) => d.children)
                      .classed("tidytree-node-leaf", (d) => !d.children)
                      .attr("transform", (d) => nt(d));
                  const t = tree$1;
                  newNodes
                      .each(function (d) {
                      const node = select(this);
                      const shape = t.nodeShape || "circle";
                      const size = t.nodeSize || 3;
                      if (shape === "circle") {
                          node.append("circle")
                              .attr("r", size)
                              .attr("title", d.data.id);
                      }
                      else if (shape === "square") {
                          node.append("rect")
                              .attr("x", -size / 2)
                              .attr("y", -size / 2)
                              .attr("width", size)
                              .attr("height", size)
                              .attr("title", d.data.id);
                      }
                      else if (shape === "diamond") {
                          node.append("polygon")
                              .attr("points", `0,-${size / 2} ${size / 2},0 0,${size / 2} ${-size / 2},0`)
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
                              }
                              else if (t.layout === "vertical") {
                                  const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                                  bar
                                      .attr("x", -size / 2 - 8)
                                      .attr("y", ta.start * t.scalar - barHeight / 2)
                                      .attr("width", 6)
                                      .attr("height", barHeight);
                              }
                              else {
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
                      .style("opacity", (d) => (d.children && t.branchNodes) ||
                      (!d.children && t.leafNodes) ? 1 : 0)
                      .style("fill", (d) => findNodeColor(d, t.colorOptions))
                      .on("mouseenter focusin", (event, d) => {
                      const content = t.tooltipFormatter ? t.tooltipFormatter(d.data) : d.data.id;
                      t.trigger("showtooltip", d, event, content);
                  })
                      .on("mouseout focusout", (event, d) => t.trigger("hidetooltip", d, event))
                      .on("contextmenu", (event, d) => t.trigger("contextmenu", d, event))
                      .on("click", (event, d) => t.trigger("select", d, event));
                  const nodeLabels = newNodes
                      .append("text")
                      .text((d) => d.data.id)
                      .style("font-size", t.nodeLabelSize + "px")
                      .attr("y", 2)
                      .style("opacity", (d) => (d.children && t.branchLabels) ||
                      (!d.children && t.leafLabels) ? 1 : 0);
                  setNodeLabelPosition(nodeLabels, t.layout);
                  newNodes
                      .transition()
                      .duration(t.animation)
                      .attr("opacity", 1);
              }, (update) => {
                  // Progressive transition: update transform, fill, and label position smoothly
                  const nodeTransformer = nodeTransformers[t.type][t.layout];
                  const shape = t.nodeShape || "circle";
                  const glyphSelector = shape === "circle" ? "circle" : shape === "square" ? "rect" : "polygon";
                  if (!(t.animation > 0)) {
                      // No animation: directly set attributes
                      update.attr("transform", (d) => nodeTransformer(d));
                      update.select(glyphSelector)
                          .style("fill", (d) => findNodeColor(d, t.colorOptions))
                          .style("opacity", (d) => (d.children && t.branchNodes) ||
                          (!d.children && t.leafNodes) ? 1 : 0);
                      setNodeLabelPosition(update.select("text"), t.layout);
                      // Update annotation text
                      update.select("text.tidytree-node-annotation")
                          .text((d) => {
                          const ann = t.annotations.get(d.data._guid);
                          return ann ? JSON.stringify(ann) : "";
                      })
                          .style("opacity", (d) => (d.children && t.branchLabels) ||
                          (!d.children && t.leafLabels) ? 1 : 0);
                      setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
                      // Update temporal annotation bar
                      update.each(function (d) {
                          const node = select(this);
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
                                  }
                                  else if (t.layout === "vertical") {
                                      const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                                      bar
                                          .attr("x", -t.nodeSize / 2 - 8)
                                          .attr("y", ta.start * t.scalar - barHeight / 2)
                                          .attr("width", 6)
                                          .attr("height", barHeight);
                                  }
                                  else {
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
                  else {
                      // Animate transform and fill, ensure opacity is restored to 1
                      update
                          .transition()
                          .duration(t.animation)
                          .attr("transform", (d) => nodeTransformer(d))
                          .attr("opacity", 1);
                      const nodeGlyphs = update.select(glyphSelector);
                      nodeGlyphs
                          .transition()
                          .duration(t.animation)
                          .style("fill", (d) => findNodeColor(d, t.colorOptions))
                          .style("opacity", (d) => (d.children && t.branchNodes) ||
                          (!d.children && t.leafNodes) ? 1 : 0);
                      // Animate label rotation and offset alongside the node. Named so
                      // it doesn't interrupt (or get interrupted by) opacity transitions
                      // from setLeafLabels / setBranchLabels.
                      const nodeLabels = update.select("text");
                      setNodeLabelPosition(nodeLabels.transition("position").duration(t.animation), t.layout);
                      // Update annotation text
                      update.select("text.tidytree-node-annotation")
                          .text((d) => {
                          const ann = t.annotations.get(d.data._guid);
                          return ann ? JSON.stringify(ann) : "";
                      })
                          .style("opacity", (d) => (d.children && t.branchLabels) ||
                          (!d.children && t.leafLabels) ? 1 : 0);
                      setNodeLabelPosition(update.select("text.tidytree-node-annotation"), t.layout);
                      // Update temporal annotation bar
                      update.each(function (d) {
                          const node = select(this);
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
                                  }
                                  else if (t.layout === "vertical") {
                                      const barHeight = Math.abs(ta.end - ta.start) * t.scalar;
                                      bar
                                          .attr("x", -t.nodeSize / 2 - 8)
                                          .attr("y", ta.start * t.scalar - barHeight / 2)
                                          .attr("width", 6)
                                          .attr("height", barHeight);
                                  }
                                  else {
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
              }, (exit) => exit
                  .transition()
                  .duration(t.animation)
                  .remove());
              // Pass current zoom transform so the ruler respects zoom level
              updateRuler.call(t, t.transform || { k: 1 });
          });
          tree$1._pendingFrames.add(frame);
          return this;
      }
      /**
       * Set the TidyTree's interactivity
       * @param bool Whether the tree should be interactive
       * @return The TidyTree object
       */
      setInteractive(bool) {
          this.interactive = bool;
          const svg = this.parent.select("svg");
          if (this.interactive) {
              svg.call(this.zoom);
          }
          else {
              svg.on('.zoom', null);
          }
          return this;
      }
      /**
       * Set the branch node size.
       * @param size The size of branch nodes.
       * @return The TidyTree object.
       */
      setBranchNodeSize(size) {
          this.nodeSize = size;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the branch label size.
       * @param size The font size for branch labels.
       * @return The TidyTree object.
       */
      setBranchLabelSize(size) {
          this.branchLabelSize = size;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the branch distance size.
       * @param size The font size for branch distance labels.
       * @return The TidyTree object.
       */
      setBranchDistanceSize(size) {
          this.branchLabelSize = size;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the leaf node size.
       * @param size The size of leaf nodes.
       * @return The TidyTree object.
       */
      setLeafNodeSize(size) {
          this.nodeSize = size;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set the leaf label size.
       * @param size The font size for leaf labels.
       * @return The TidyTree object.
       */
      setLeafLabelSize(size) {
          this.nodeLabelSize = size;
          if (this.parent)
              return this.redraw();
          return this;
      }
      /**
       * Set whether tooltips are enabled.
       * @param enabled Whether tooltips should be shown.
       * @return The TidyTree object.
       */
      setTooltips(enabled) {
          // Tooltips are controlled via event listeners; this is a no-op for now
          // but kept for UI compatibility.
          return this;
      }
      /**
       * Set whether temporal annotations are visible.
       * @param show Whether to show temporal annotations.
       * @return The TidyTree object.
       */
      setShowTemporal(show) {
          return this.setShowTemporalAnnotations(show);
      }
      /**
       * Set the background color of the tree container.
       * @param color A CSS color string.
       * @return The TidyTree object.
       */
      setBackground(color) {
          if (this.parent) {
              this.parent.style("background-color", color);
          }
          return this;
      }
      /**
       * Recenters the tree in the center of the view
       * @return The TidyTree object
       */
      recenter() {
          const svg = this.parent.select("svg");
          let x = this.margin[3];
          let y = this.margin[0];
          if (this.layout === "circular") {
              x += parseFloat(svg.style("width")) / 2;
              y += parseFloat(svg.style("height")) / 2;
          }
          svg
              .transition()
              .duration(this.animation)
              .call(this.zoom.transform, identity.translate(x, y));
          return this;
      }
  }
  TidyTree.patristic = patristic$1;
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
      nodeShape: "circle",
      virtualize: false,
      virtualizationThreshold: 1000
  };
  TidyTree.validLayouts = ["horizontal", "vertical", "circular", "radial", "unrooted"];
  TidyTree.validTypes = ["tree", "weighted", "dendrogram"];
  TidyTree.validModes = ["smooth", "square", "straight"];
  TidyTree.validNodeColorModes = ["none", "predicate", "heatmap", "gradient"];
  TidyTree.validBranchColorModes = ["none", "predicate", "monophyletic", "heatmap", "gradient"];
  TidyTree.validNodeShapes = ["circle", "square", "diamond"];
  /**
   * Finds the color of a given node based on the color options provided.
   *
   * @param node - The node for which to find the color.
   * @param colorOptions - The color options object containing the color mode, leavesOnly, predicate, default color, and highlight color.
   * @return The color of the node.
   */
  function findNodeColor(node, colorOptions) {
      if (colorOptions.nodeColorMode === "none") {
          return colorOptions.defaultNodeColor ?? "#4682B4";
      }
      if (colorOptions.nodeColorMode === "predicate") {
          const guidList = colorOptions.nodeList?.map(n => n._guid);
          if (guidList && guidList.includes(node.data._guid)) {
              return colorOptions.highlightColor ?? "#feb640";
          }
          else {
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
  function interpolateColor(colorA, colorB, t) {
      t = Math.max(0, Math.min(1, t));
      const hexToRgb = (hex) => {
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
  function findBranchColor(link, colorOptions) {
      if (colorOptions.branchColorMode === "none") {
          return colorOptions.defaultBranchColor ?? "#cccccc";
      }
      if (colorOptions.branchColorMode === "predicate") {
          const source = link.source;
          const childLeafNodes = getAllLeaves(source);
          const guidList = colorOptions.nodeList?.map(node => node._guid);
          const allChildLeafNodesInNodeList = childLeafNodes.every((child) => guidList?.includes(child.data._guid));
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
  function getAllLeaves(node, includeSelf = false) {
      const leaves = [];
      if (includeSelf && node.height === 0) {
          leaves.push(node);
      }
      else {
          node.children?.forEach((child) => {
              leaves.push(...getAllLeaves(child, true));
          });
      }
      return leaves;
  }
  const radToDeg = 180 / Math.PI;
  const getX = (d) => d.x;
  const getY = (d) => d.y;
  const getLength = (d) => d.weight;
  const linkTransformers = {
      tree: {
          smooth: {
              horizontal: linkHorizontal()
                  .x(getY)
                  .y(getX),
              vertical: linkVertical()
                  .x(getX)
                  .y(getY),
              circular: linkRadial()
                  .angle(getX)
                  .radius(getY),
              radial: linkRadial()
                  .angle(getX)
                  .radius(getY),
              unrooted: linkHorizontal()
                  .x(getY)
                  .y(getX)
          },
          straight: {
              horizontal: (d) => `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
              vertical: (d) => `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
              circular: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.y, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.y;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
                      startRadius * x0 +
                      "," +
                      startRadius * y0 +
                      "L" +
                      endRadius * x1 +
                      "," +
                      endRadius * y1);
              },
              radial: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.y, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.y;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              unrooted: (d) => `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`
          },
          square: {
              horizontal: (d) => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
              vertical: (d) => `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
              circular: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.y, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.y;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              radial: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.y, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.y;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              unrooted: (d) => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`
          }
      },
      weighted: {
          smooth: {
              horizontal: linkHorizontal()
                  .x(getLength)
                  .y(getX),
              vertical: linkVertical()
                  .x(getX)
                  .y(getLength),
              circular: linkRadial()
                  .angle(getX)
                  .radius(getLength),
              radial: linkRadial()
                  .angle(getX)
                  .radius(getLength),
              unrooted: linkHorizontal()
                  .x(getLength)
                  .y(getX)
          },
          straight: {
              horizontal: (d) => `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`,
              vertical: (d) => `M${d.source.x} ${d.source.weight} L ${d.target.x} ${d.target.weight}`,
              circular: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.weight, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.weight;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
                      startRadius * x0 +
                      "," +
                      startRadius * y0 +
                      "L" +
                      endRadius * x1 +
                      "," +
                      endRadius * y1);
              },
              radial: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.weight, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.weight;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              unrooted: (d) => `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`
          },
          square: {
              horizontal: (d) => `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${d.target.weight}`,
              vertical: (d) => `M${d.source.x} ${d.source.weight} H ${d.target.x} V ${d.target.weight}`,
              circular: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.weight, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.weight;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              radial: (d) => {
                  const startAngle = d.source.x - Math.PI / 2, startRadius = d.source.weight, endAngle = d.target.x - Math.PI / 2, endRadius = d.target.weight;
                  const x0 = Math.cos(startAngle), y0 = Math.sin(startAngle), x1 = Math.cos(endAngle), y1 = Math.sin(endAngle);
                  return ("M" +
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
                      endRadius * y1);
              },
              unrooted: (d) => `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${d.target.weight}`
          }
      }
  };
  linkTransformers.dendrogram = linkTransformers.tree;
  /**
   * Sets the position and rotation of node labels based on layout.
   * @param selection - The text selection to position.
   * @param layout - The current layout ("vertical", "horizontal", "circular").
   */
  function setNodeLabelPosition(selection, layout) {
      const circular = layout !== "vertical" && layout !== "horizontal" && layout !== "unrooted";
      const anchor = (l) => (circular && isLeftHalf(l.x) ? "end" : "start");
      const x = (l) => (circular && isLeftHalf(l.x) ? -5 : 5);
      const transform = (l) => layout === "vertical" ? "rotate(90)" :
          circular ? `rotate(${(((l.x / Math.PI) * 180) % 180) - 90})` :
              "rotate(0)";
      if ("duration" in selection) {
          // text-anchor can't be tweened, so flip it halfway through, when the
          // label is mid-turn, rather than snapping at the start.
          selection
              .attr("transform", transform)
              .attr("x", x)
              .attrTween("text-anchor", function (l) {
              const from = this.getAttribute("text-anchor") || "start";
              const to = anchor(l);
              return (t) => (t < 0.5 ? from : to);
          });
      }
      else {
          selection
              .attr("text-anchor", anchor)
              .attr("x", x)
              .attr("transform", transform);
      }
  }
  const nodeTransformers = {
      tree: {
          horizontal: (d) => `translate(${d.y}, ${d.x})`,
          vertical: (d) => `translate(${d.x}, ${d.y})`,
          circular: (d) => `translate(${circularPoint(d.x, d.y)})`,
          radial: (d) => `translate(${circularPoint(d.x, d.y)})`,
          unrooted: (d) => `translate(${d.y}, ${d.x})`
      },
      weighted: {
          horizontal: (d) => `translate(${d.weight}, ${d.x})`,
          vertical: (d) => `translate(${d.x}, ${d.weight})`,
          circular: (d) => `translate(${circularPoint(d.x, d.weight)})`,
          radial: (d) => `translate(${circularPoint(d.x, d.weight)})`,
          unrooted: (d) => `translate(${d.weight}, ${d.x})`
      }
  };
  nodeTransformers.dendrogram = nodeTransformers.tree;
  const labelTransformers = {
      tree: {
          straight: {
              horizontal: (l) => `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
                l.target.x) /
                2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.y - l.source.y)) * radToDeg})`,
              vertical: (l) => `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.y +
                l.target.y) /
                2}) rotate(${Math.atan((l.source.y - l.target.y) / (l.source.x - l.target.x)) * radToDeg})`,
              circular: (l) => chordLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y),
              radial: (l) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
              unrooted: (l) => `translate(${(l.source.y + l.target.y) / 2}, ${(l.source.x +
                l.target.x) /
                2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.y - l.source.y)) * radToDeg})`
          },
          square: {
              horizontal: (l) => `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`,
              vertical: (l) => `translate(${l.target.x}, ${(l.source.y + l.target.y) / 2}) rotate(90)`,
              circular: (l) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
              radial: (l) => elbowLinkLabel(l.source.y, l.target.x, l.target.y),
              unrooted: (l) => `translate(${(l.source.y + l.target.y) / 2}, ${l.target.x})`
          }
      },
      weighted: {
          straight: {
              horizontal: (l) => `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
                l.target.x) /
                2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.weight - l.source.weight)) * radToDeg})`,
              vertical: (l) => `translate(${(l.source.x + l.target.x) / 2}, ${(l.source.weight +
                l.target.weight) /
                2}) rotate(${Math.atan((l.source.weight - l.target.weight) / (l.source.x - l.target.x)) * radToDeg})`,
              circular: (l) => chordLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight),
              radial: (l) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
              unrooted: (l) => `translate(${(l.source.weight + l.target.weight) / 2}, ${(l.source.x +
                l.target.x) /
                2}) rotate(${Math.atan((l.target.x - l.source.x) / (l.target.weight - l.source.weight)) * radToDeg})`
          },
          square: {
              horizontal: (l) => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `,
              vertical: (l) => `
        translate(${l.target.x}, ${(l.source.weight + l.target.weight) / 2})
        rotate(90)
      `,
              circular: (l) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
              radial: (l) => elbowLinkLabel(l.source.weight, l.target.x, l.target.weight),
              unrooted: (l) => `
        translate(${(l.source.weight + l.target.weight) / 2}, ${l.target.x})
      `
          }
      }
  };
  // Smooth links are Bézier curves (d3.linkHorizontal / linkVertical /
  // linkRadial), so their labels follow the curve rather than the chord.
  labelTransformers.tree.smooth = {
      horizontal: (l) => smoothLinkLabel(l.source.y, l.source.x, l.target.y, l.target.x, true),
      vertical: (l) => smoothLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y, false),
      unrooted: (l) => smoothLinkLabel(l.source.y, l.source.x, l.target.y, l.target.x, true),
      circular: (l) => smoothRadialLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y),
      radial: (l) => smoothRadialLinkLabel(l.source.x, l.source.y, l.target.x, l.target.y)
  };
  labelTransformers.weighted.smooth = {
      horizontal: (l) => smoothLinkLabel(l.source.weight, l.source.x, l.target.weight, l.target.x, true),
      vertical: (l) => smoothLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight, false),
      unrooted: (l) => smoothLinkLabel(l.source.weight, l.source.x, l.target.weight, l.target.x, true),
      circular: (l) => smoothRadialLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight),
      radial: (l) => smoothRadialLinkLabel(l.source.x, l.source.weight, l.target.x, l.target.weight)
  };
  labelTransformers.dendrogram = labelTransformers.tree;
  function labeler(d) {
      // Show actual branch length; leaves without an explicit length show "—"
      const length = d.target.data.length;
      return length != null && length > 0 ? length.toFixed(3) : "\u2014";
  }
  /**
   * Updates the ruler display based on the current zoom transform.
   * @param transform - The current zoom transform.
   */
  function updateRuler(transform) {
      if (!transform)
          transform = { k: 1 };
      const height = parseFloat(this.parent.style("height")) - this.margin[2] - 15;
      const ruler = this.parent.select("g.tidytree-ruler");
      const bg = ruler.select("rect");
      if (this.ruler) {
          if (this.layout == "horizontal") {
              ruler.attr("transform", `translate(${this.margin[3]}, ${height})`);
              bg
                  .attr("width", `calc(100% - ${this.margin[1] + this.margin[3] - 15}px)`)
                  .attr("height", "25px")
                  .attr("x", -5);
          }
          else {
              ruler.attr("transform", `translate(${this.margin[3] - 10}, ${this.margin[0]})`);
              bg
                  .attr("height", `calc(100% - ${this.margin[0] + this.margin[2] - 15}px)`)
                  .attr("width", "25px")
                  .attr("x", -25);
          }
          const axisFn = this.layout == "horizontal" ? axisBottom : axisLeft;
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
                  .call(axis.scale(linear([0, this.hierarchy.height / transform.k], [0, this.scalar])));
          }
          else if (this.type === "weighted" && this.layout !== "circular") {
              ruler
                  .attr("opacity", 1)
                  .call(axis.scale(linear([this.range[0], this.range[1] / transform.k], [0, this.scalar])));
          }
          else {
              ruler
                  .transition()
                  .duration(this.animation)
                  .attr("opacity", 0);
          }
      }
      else {
          ruler
              .transition()
              .duration(this.animation)
              .attr("opacity", 0);
      }
  }

  return TidyTree;

})();
