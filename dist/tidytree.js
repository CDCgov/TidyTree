var TidyTree = (function () {
  'use strict';

  (function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.patristic = {}));
  })(undefined, (function (exports) {
    /**
     * The [SemVer](https://semver.org/) version string of the patristic library
     * @type {String} A string specifying the current version of the Patristic Library.
     * If not given, the version of patristic you are using if less than or equal to 0.2.2.
     * @example
     * console.log(patristic.version);
     */
    const version = "0.5.7";

    /**
     * A class for representing Branches in trees.
     * It's written predominantly for phylogenetic trees (hence the
     * [Newick parser](#parseNewick),
     * [neighbor-joining implementation](#parseMatrix), etc.), but could
     * conceivably be useful for representing other types of trees as well.
     * @param {Object} [data] An object containing data you wish to assign to
     * this Branch object. In particular, intended to overwrite the default
     * attributes of a Branch, namely `id`, `parent`, `length`, and `children`.
     * @constructor
     */
    function Branch(data, children) {
      if (!data) data = {};
      if (!children) children = d => d.children;
      Object.assign(this, {
        _guid: guid(),
        id: data.id || "",
        data: data,
        depth: data.depth || 0,
        height: data.height || 0,
        length: data.length || 0,
        parent: data.parent || null,
        children: children(data) || [],
        value: data.value || 1,
        respresenting: 1
      });
    }

    function guid(){
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, a => {
        return (a ^ ((Math.random() * 16) >> (a / 4))).toString(16);
      });
    }

    /**
     * Adds a new child to this Branch
     * @param  {(Branch|Object)} [data={}] The new Branch, or data to attach to it.
     * @return {Branch} The (possibly new) child Branch
     */
    Branch.prototype.addChild = function(data) {
      let c;
      if (data instanceof Branch) {
        c = data;
        c.parent = this;
      } else {
        if (!data) data = {};
        c = new Branch(
          Object.assign(data, {
            parent: this
          })
        );
      }
      this.children.push(c);
      return c;
    };

    /**
     * Adds a new parent to this Branch. This is a bit esoteric and generally not
     * recommended.
     * @param  {(Branch|Object)} [data={}] A Branch object, or the data to attach to one
     * @param  {Array} [siblings=[]] An array of Branches to be the children of the new parent Branch (i.e. siblings of this Branch)
     * @return {Branch} The Branch on which this was called
     */
    Branch.prototype.addParent = function(data, siblings) {
      if (!siblings) siblings = [];
      let c;
      if (data instanceof Branch) {
        c = data;
      } else {
        if (!data) data = {};
        c = new Branch(Object.assign(data));
      }
      siblings.forEach(sib => sib.setParent(c));
      c.children = [this].concat(siblings);
      this.parent = c;
      return this;
    };

    /**
     * Returns an array of Branches from this Branch to the root.
     * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_ancestors)
     * @type {Array} An array of Branches
     */
    Branch.prototype.ancestors = function() {
      return this.getAncestors(true);
    };

    /**
     * Returns a deep clone of the Branch on which it is called. Note that this does
     * not clone all descendants, rather than providing references to the existing
     * descendant Branches.
     * @return {Branch} A clone of the Branch on which it is called.
     */
    Branch.prototype.clone = function() {
      return parseJSON(this.toObject());
    };

    /**
     * All descendant Branches with near-zero length are excised
     * @return {Branch} The Branch on which this method was called.
     */
    Branch.prototype.consolidate = function() {
      return this.eachAfter(branch => {
        if (branch.isRoot() || branch.length >= 0.0005) return;
        if(branch.parent.id == ""){
          branch.parent.id = branch.id;
        } else {
          branch.parent.id += '+'+branch.id;
        }
        branch.excise();
      }).fixDistances();
    };

    /**
     * Returns a clone of the Branch on which it is called. Note that this also
     * clones all descendants, rather than providing references to the existing
     * descendant Branches. (For a shallow clone, see [Branch.clone](#clone).
     * Finally, the cloned Branch will become the root of the cloned tree, having a
     * parent of `null`.
     * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_copy)
     * @return {Branch} A clone of the Branch on which it is called.
     */
    Branch.prototype.copy = function() {
      let newThis = parseJSON(JSON.stringify(this));
      newThis.parent = null;
      return newThis.fixDistances();
    };

    /**
     * Sets the values of all nodes to be equal to the number of their descendants.
     * @return {Branch} The Branch on which it was called
     */
    Branch.prototype.count = function() {
      return this.sum(() => 1);
    };

    /**
     * Returns an array pf descendants, starting with this Branch.
     * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_descendants)
     * @type {Array} An Array of Branches, starting with this one.
     */
    Branch.prototype.descendants = function() {
      return this.getDescendants(true);
    };

    /**
     * Returns the depth of a given child, relative to the Branch on which it is
     * called.
     * @param  {(Branch|String)} descendant A descendant Branch (or `id` string
     * thereof)
     * @return {Number} The sum of the lengths of all Branches between the Branch on
     * which it is called and `descendant`. Throws an error if `descendant` is not a
     * descendant of this Branch.
     */
    Branch.prototype.depthOf = function(descendant) {
      let distance = 0;
      if (typeof descendant == "string")
        descendant = this.getDescendant(descendant);
      if (typeof descendant == "undefined")
        throw Error("Cannot compute depth of undefined descendant!");
      let current = descendant;
      while (current != this) {
        distance += current.length;
        current = current.parent;
      }
      return distance;
    };

    /**
     * Computes the patristic distance between `descendantA` and `descendantB`.
     * @param  {Branch} descendantA The Branch from which you wish to compute
     * distance
     * @param  {Branch} descendantB The Branch to which you wish to compute distance
     * @return {number} The patristic distance between the given descendants.
     */
    Branch.prototype.distanceBetween = function(descendantA, descendantB) {
      let mrca = descendantA.getMRCA(descendantB);
      return mrca.depthOf(descendantA) + mrca.depthOf(descendantB);
    };

    /**
     * Computes the patristic distance between `cousin` and the Branch on which
     * this method is called.
     * @param  {Branch} cousin The Branch to which you wish to compute distance
     * @return {number} The patristic distance between `cousin` and the Branch on
     * this method is called.
     */
    Branch.prototype.distanceTo = function(cousin) {
      let mrca = this.getMRCA(cousin);
      return mrca.depthOf(this) + mrca.depthOf(cousin);
    };

    /**
     * Visits each Branch descended from the Branch on which it is called in
     * [Breadth First Search](https://en.wikipedia.org/wiki/Breadth-first_search)
     * order and returns the Branch on which it was called.
     * @param  {Function} callback The function to be run on each Branch
     * @return {Branch} The Branch on which it was called.
     */
    Branch.prototype.each = function(callback) {
      let branch = this,
        next = [branch],
        current;
      while (next.length) {
        current = next.reverse();
        next = [];
        while ((branch = current.pop())) {
          callback(branch);
          branch.eachChild(child => next.push(child));
        }
      }
      return this;
    };

    /**
     * Visits each Branch descended from the Branch on which it is called in
     * [post-traversal order](https://en.wikipedia.org/wiki/Tree_traversal#Post-order)
     * and returns the Branch on which it was called.
     * @param  {Function} callback Function to run on each Branch
     * @return {Branch} The Branch on which it was called
     */
    Branch.prototype.eachAfter = function(callback) {
      this.eachChild(child => child.eachAfter(callback));
      callback(this);
      return this;
    };

    /**
     * Visits each Branch descended from the Branch on which it is called in
     * [pre-traversal order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order)
     * and returns the Branch on which it was called.
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    Branch.prototype.eachBefore = function(callback) {
      callback(this);
      this.eachChild(child => child.eachBefore(callback));
      return this;
    };

    /**
     * Runs a function on each child of the Branch on which it is called.
     * @param  {Function} callback The function to run on each child.
     * @return {Branch} The Branch on which it was called.
     */
    Branch.prototype.eachChild = function(callback) {
      this.children.forEach(callback);
      return this;
    };

    /**
     * Excises the Branch on which it is called and updates its parent and children.
     * @return {Branch} The parent of the excised Branch.
     */
    Branch.prototype.excise = function() {
      if (this.isRoot() && this.children.length > 1) {
        throw new Error("Cannot excise a root Branch with multiple children.");
      }
      this.eachChild(child => {
        child.length += this.length;
        child.parent = this.parent;
        if (!this.isRoot()) this.parent.children.push(child);
      });
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent.representing++;
      return this.parent;
    };

    /**
     * Sets the distance values (height and depth) for each Branch
     * @return {Branch} The Branch on which it is called.
     */
    Branch.prototype.fixDistances = function() {
      let maxdepth = 0,
        root = this.getRoot();
      root.depth = 0;
      this.eachBefore(d => {
        if (d.isRoot()) return;
        d.depth = d.parent.depth + 1;
        if (d.depth > maxdepth) maxdepth = d.depth;
      }).eachAfter(d => {
        d.height = maxdepth - d.depth;
        d.value = d.value + d.children.reduce((a, c) => a + c.value, 0);
      });
      return this;
    };

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
    Branch.prototype.fixParenthood = function(nonrecursive) {
      this.children.forEach(child => {
        if (!child.parent) child.parent = this;
        if (child.parent !== this) child.parent = this;
        if (!nonrecursive && child.children.length > 0) {
          child.fixParenthood();
        }
      });
      return this;
    };

    /**
     * Reverses the order of (all of) the descendants of the Branch.
     * @return {Branch} The Branch on which this was called.
     */
    Branch.prototype.flip = function() {
      return this.each(c => c.rotate());
    };

    /**
     * Returns an Array of all the ancestors of the Branch on which it is called.
     * Note that this does not include itself. For all ancestors and itself, see
     * [Branch.ancestors](#ancestors)
     * @param {Boolean} includeSelf Should the Branch on which this is called be
     * included in the results?
     * @return {Array} Every Ancestor of the Branch on which it was called.
     */
    Branch.prototype.getAncestors = function(includeSelf) {
      let ancestors = includeSelf ? [this] : [];
      let current = this;
      while ((current = current.parent)) ancestors.push(current);
      return ancestors;
    };

    /**
     * Given an `childID`, returns the child with that id (or `undefined` if no such
     * child is present).
     * @param  {String} childID the ID of the child to return.
     * @return {(Branch|undefined)} The desired child Branch, or `undefined` if the
     * child doesn't exist.
     */
    Branch.prototype.getChild = function(childID) {
      if (!typeof childID == "string") throw Error("childID is not a String!");
      return this.children.find(c => c.id === childID);
    };

    /**
     * Given an id string, returns the descendant Branch with that ID, or
     * `undefined` if it doesn't exist.
     * @param  {String} id The id string of the Branch to find
     * @return {(Branch|undefined)} The descendant Branch, or `undefined` if it
     * doesn't exist
     */
    Branch.prototype.getDescendant = function(id) {
      if (this.id === id) return this;
      let children = this.children,
        n = children.length;
      if (children) {
        for (let i = 0; i < n; i++) {
          let descendant = children[i].getDescendant(id);
          if (descendant) return descendant;
        }
      }
    };

    /**
     * Returns an array of all Branches which are descendants of this Branch
     * @param {Boolean} [includeSelf] Is this not the Branch on which the user
     * called the function? This is used internally and should be ignored.
     * @return {Array} An array of all Branches descended from this Branch
     */
    Branch.prototype.getDescendants = function(includeSelf) {
      let descendants = includeSelf ? [this] : [];
      if (!this.isLeaf()) {
        this.children.forEach(child => {
          child.getDescendants(true).forEach(d => descendants.push(d));
        });
      }
      return descendants;
    };

    /**
     * Returns an array of all leaves which are descendants of this Branch.
     * Alias of [getLeaves](#getLeaves) for people whose strong suit isn't spelling.
     * @return {Array} An array of all leaves descended from this Branch
     */
    Branch.prototype.getLeafs = function() {
      return this.getLeaves();
    };

    /**
     * Returns an array of all leaves which are descendants of this Branch
     * See also: [getLeafs](#getLeafs)
     * @return {Array} An array of all leaves descended from this Branch
     */
    Branch.prototype.getLeaves = function() {
      if (this.isLeaf()) {
        return [this];
      } else {
        let descendants = [];
        this.children.forEach(child => {
          child.getLeaves().forEach(d => descendants.push(d));
        });
        return descendants;
      }
    };

    /**
     * Traverses the tree upward until it finds the Most Recent Common Ancestor
     * (i.e. the first Branch for which both the Branch on which it was called and
     * `cousin` are descendants).
     * @return {Branch} The Most Recent Common Ancestor of both the Branch on
     * which it was called and the `cousin`.
     */
    Branch.prototype.getMRCA = function(cousin) {
      let mrca = this;
      while (!mrca.hasDescendant(cousin)) {
        if (mrca.isRoot())
          throw Error(
            "Branch and cousin do not appear to share a common ancestor!"
          );
        mrca = mrca.parent;
      }
      return mrca;
    };

    /**
     * Traverses the tree upward until it finds the root Branch, and returns the
     * root.
     * @return {Branch} The root Branch of the tree
     */
    Branch.prototype.getRoot = function() {
      let branch = this;
      while (!branch.isRoot()) branch = branch.parent;
      return branch;
    };

    /**
     * Determines if a given Branch (or ID) is a child of this Branch
     * @param  {(Branch|String)} child The Branch (or the id thereof) to check for
     * @return {Boolean}
     */
    Branch.prototype.hasChild = function(child) {
      if (child instanceof Branch) {
        return this.children.includes(child);
      } else if (typeof child === "string") {
        return this.children.some(c => c.id === child);
      }
      throw Error(
        `Unknown type of child (${typeof child}) passed to Branch.hasChild!`
      );
    };

    /**
     * Checks to see if `descendant` is a descendant of the Branch on which this
     * method is called.
     * @param  {(Branch|String)} descendant Either the descendant Branch or its'
     * `id`.
     * @return {Boolean} True if `descendant` is descended from the Branch from
     * which this is called, otherwise false.
     */
    Branch.prototype.hasDescendant = function(descendant) {
      let descendants = this.getDescendants();
      if (descendant instanceof Branch) {
        return descendants.some(d => d === descendant);
      } else if (typeof descendant === "string") {
        return descendants.some(d => d.id === descendant);
      }
      throw Error("Unknown type of descendant passed to Branch.hasDescendant!");
    };

    /**
     * Checks to see if a Branch has a descendant leaf.
     * @return {Boolean} True if leaf is both a leaf and a descendant of the
     * Branch on which this method is called, False otherwise.
     */
    Branch.prototype.hasLeaf = function(leaf) {
      let leaves = this.getleaves();
      if (leaf instanceof Branch) {
        return leaves.includes(leaf);
      } else if (typeof leaf === "string") {
        return leaves.some(d => d.id === leaf);
      }
      throw Error("Unknown type of leaf passed to Branch.hasLeaf.");
    };

    /**
     * Swaps the branch on which it is called with its parent. This method is
     * probably only useful as an internal component of [Branch.reroot](#reroot).
     * @return {Branch} The Branch object on which it was called.
     */
    Branch.prototype.invert = function() {
      let oldParent = this.parent;
      if (oldParent) {
        let temp = this.parent.length;
        this.parent.length = this.length;
        this.length = temp;
        this.parent = oldParent.parent;
        this.children.push(oldParent);
        oldParent.parent = this;
        oldParent.children.splice(oldParent.children.indexOf(this), 1);
      } else {
        throw Error("Cannot invert root node!");
      }
      return this;
    };

    /**
     * Returns whether the Branch on which it is called is a child of a given parent
     * (or parent ID).
     * @param  {(Branch|String)} parent A Branch (or ID thereof) to test for
     * paternity of this Branch.
     * @return {Boolean} True is `parent` is the parent of this Branch, false
     * otherwise.
     */
    Branch.prototype.isChildOf = function(parent) {
      if (parent instanceof Branch) return this.parent === parent;
      if (typeof parent === "string") return this.parent.id === parent;
      throw Error("Unknown parent type passed to Branch.isChildOf");
    };

    /**
     * Tests whether this and each descendant Branch holds correct links to both
     * its parent and its children.
     * @return {Boolean} True if consistent, otherwise false
     */
    Branch.prototype.isConsistent = function() {
      if (!this.isRoot()) {
        if (!this.parent.children.includes(this)) return false;
      }
      if (!this.isLeaf()) {
        if (this.children.some(c => c.parent !== this)) return false;
        return this.children.every(c => c.isConsistent());
      }
      return true;
    };

    /**
     * Returns whether a given Branch is an ancestor of the Branch on which this
     * method is called. Uses recursive tree-climbing.
     * @param  {Branch} ancestor The Branch to check for ancestorhood
     * @return {Boolean} If this Branch is descended from `ancestor`
     */
    Branch.prototype.isDescendantOf = function(ancestor) {
      if (!ancestor || !this.parent) return false;
      if (this.parent === ancestor || this.parent.id === ancestor) return true;
      return this.parent.isDescendantOf(ancestor);
    };

    /**
     * Returns a boolean indicating if this Branch is a leaf (i.e. has no
     * children).
     * @return {Boolean} True is this Branch is a leaf, otherwise false.
     */
    Branch.prototype.isLeaf = function() {
      return this.children.length === 0;
    };

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
    Branch.prototype.isolate = function() {
      let index = this.parent.children.indexOf(this);
      this.parent.children.splice(index, 1);
      this.setParent(null);
      return this;
    };

    /**
     * Returns a boolean indicating if this Branch is the root of a tree (i.e. has
     * no parents).
     * @return {Boolean} True if this Branch is the root, otherwise false.
     */
    Branch.prototype.isRoot = function() {
      return this.parent === null;
    };

    /**
     * Returns the array of leaf nodes in traversal order; leaves are nodes with no
     * children. Alias of [Branch.getLeaves](#getLeaves) `cuz spelling is hard.
     * @type {Array} An Array of Branches which are descended from this Branch and
     * have no children.
     */
    Branch.prototype.leafs = function() {
      return this.getLeaves();
    };

    /**
     * Returns the array of leaf nodes in traversal order; leaves are nodes with no
     * children. Alias of [Branch.getLeaves](#getLeaves).
     * [d3-hierarchy compatibility method.](https://github.com/d3/d3-hierarchy#node_leaves)
     * @type {Array} An Array of Branches which are descended from this Branch and
     * have no children.
     */
    Branch.prototype.leaves = function() {
      return this.getLeaves();
    };

    /**
     * Returns an Array of links, which are plain javascript objects containing a
     * `source` attribute (which is a reference to the parent Branch) and a `target`
     * attribute (which is a reference to the child Branch).
     * [d3-hierarchy compatibility method](https://github.com/d3/d3-hierarchy#node_links)
     * @return {Array} An array of plain Javascript objects
     */
    Branch.prototype.links = function() {
      let links = [];
      this.each(d => {
        if (d.isRoot()) return;
        links.push({
          source: d.parent,
          target: d
        });
      });
      return links;
    };

    /**
     * Normalizes this and all descendant Branches `value` attributes to between
     * `newmin` and `newmax`. Note that normalize can function as its own inverse
     * when passed an original range. For example:
     * @example tree.normalize().normalize(1, tree.getDescendants().length + 1);
     * @param  {Number} newmin The desired minimum value.
     * @param  {Number} newmax The desired maximum value.
     * @return {Branch} The Branch on which it was called.
     */
    Branch.prototype.normalize = function(newmin, newmax) {
      if (typeof newmax !== "number") newmax = 1;
      if (typeof newmin !== "number") newmin = 0;
      let min = Infinity,
        max = -Infinity;
      this.each(d => {
        if (d.value < min) min = d.value;
        if (d.value > max) max = d.value;
      });
      let ratio = (newmax - newmin) / (max - min);
      return this.each(d => (d.value = (d.value - min) * ratio + newmin));
    };

    /**
     * Gets the path from this Branch to `target`. If this Branch and `target` are
     * the same, returns an array containing only the Branch on which it is called.
     * @param  {Branch} target A Branch object
     * @return {Array} An ordered Array of Branches following the path between this
     * Branch and `target`
     */
    Branch.prototype.path = function(target) {
      let current = this;
      let branches = [this];
      let mrca = this.getMRCA(target);
      while (current !== mrca) {
        current = current.parent;
        branches.push(current);
      }
      let k = branches.length;
      current = target;
      while (current !== mrca) {
        branches.splice(k, 0, current);
        current = current.parent;
      }
      return branches;
    };

    /**
     * Removes a Branch and its subtree from the tree. Similar to
     * [Branch.isolate](#isolate), only it returns the root Branch of the tree
     * from which this Branch is removed.
     * @param {Boolean} pruneAncestors - If true, removes ancestors with no remaining children as well
     * @return {Branch} The root of the remaining tree.
     */
    Branch.prototype.remove = function(pruneAncestors) {
      let root = this.getRoot();
      this.isolate();
      if (pruneAncestors) {
        this.parent?.removeIfNoChildren();
      }
      return root;
    };

    /**
     * Removes the branch if it has no children. Then recursively removes all
     * ancestors with no children.
     *
     * @param {Boolean} nonrecursive - If true, does not remove ancestors with no children
     * @return {Branch} The root of the modified tree.
     */
    Branch.prototype.removeIfNoChildren = function(nonrecursive) {
      let root = this.getRoot();

      if (this.children.length === 0) {
        this.remove();
        if (!nonrecursive) {
          this.parent.removeIfNoChildren();
        }
      }

      return root;
    };

    /**
     * Removes a Branch and its subtree from the tree, and replaces it.
     * @param {Branch} replacement - The branch to replace the branch on which the
     * method is called.
     * @return {Branch} The root of the modified tree.
     */
    Branch.prototype.replace = function(replacement) {
      let root = this.getRoot();
      this.parent;
      let index = this.parent.children.indexOf(this);
      this.parent.children.splice(index, 1, replacement);
      return root;
    };

    /**
     * Reroots a tree on this Branch. Use with caution, this returns the new root,
     * which should typically supplant the existing root Branch object, but does
     * not replace that root automatically.
     * @example
     * tree = tree.children[0].children[0].reroot();
     * @return {Branch} The new root Branch, which is the Branch on which this was
     * called
     */
    Branch.prototype.reroot = function() {
      let current = this;
      let toInvert = [];
      while (!current.isRoot()) {
        toInvert.push(current);
        current = current.parent;
      }
      toInvert.reverse().forEach(c => c.invert());
      return this.fixDistances();
    };

    /**
     * Reverses the order of the children of the branch on which it is called.
     * @return {Branch} The Branch on which this was called.
     */
    Branch.prototype.rotate = function(recursive) {
      if (!this.children) return this;
      this.children.reverse();
      return this;
    };

    /**
     * Set the length of a Branch
     * @param  {number} length The new length to assign to the Branch
     * @return {Branch} The Branch object on which this was called
     */
    Branch.prototype.setLength = function(length) {
      this.length = length;
      return this;
    };

    /**
     * Sets the parent of the Branch on which it is called.
     * @param  {Branch} parent The Branch to set as parent
     * @return {Branch} The Branch on which this method was called.
     */
    Branch.prototype.setParent = function(parent) {
      if (!parent instanceof Branch && parent !== null)
        throw Error("Cannot set parent to non-Branch object!");
      this.parent = parent;
      return this;
    };

    /**
     * Collapses each descendant Branch with exactly one child into a single
     * continuous branch.
     * @return {Branch} The Branch on which this method was called.
     */
    Branch.prototype.simplify = function() {
      this.eachAfter(branch => {
        if(branch.children.length == 1){
          let child = branch.children[0];
          if(child.id == ''){
            child.id = branch.id;
          } else {
            child.id = branch.id + "+" + child.id;
          }
          branch.excise();
        }
      });
      return this.fixDistances();
    };

    /**
     * Sorts the Tree from the branch on which it is called downward.
     * @param  {Function} [comparator] A Function taking two Branches and returning
     * a numberic value. For details, see [MDN Array.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Description)
     * @return {Branch} The Branch on which it was called
     */
    Branch.prototype.sort = function(comparator) {
      if (!comparator) comparator = (a, b) => a.value - b.value;
      return this.eachBefore(d => d.children.sort(comparator));
    };

    /**
     * Determines whether this Branch is likelier to be a source of `cousin`, or
     * if `cousin` is a source of this Branch.
     * @param  {Branch} cousin The other Branch to test
     * @return {Boolean} True if this might be the source of cousin, otherwise
     * false.
     */
    Branch.prototype.sources = function(cousin) {
      let mrca = this.getMRCA(cousin);
      return mrca.depthOf(this) < mrca.depthOf(cousin);
    };

    /**
     * Computes the value of each Branch according to some valuator function
     * @param  {Function} value A Function taking a Branch and returning a
     * (numeric?) value.
     * @return {Branch} The Branch on which it was called.
     */
    Branch.prototype.sum = function(value) {
      if (!value) value = d => d.value;
      return this.eachAfter(
        d => (d.value = value(d) + d.children.reduce((a, c) => a + c.value, 0))
      );
    };

    /**
     * Determines whether this Branch is likelier to be a target of `cousin`, or
     * if `cousin` is a target of this Branch.
     * @param  {Branch} cousin The other Branch to test
     * @return {Boolean} True if this might be the target of cousin, otherwise
     * false.
     */
    Branch.prototype.targets = function(cousin) {
      return cousin.sources(this);
    };

    /**
     * toJSON is an alias for [toObject](#toObject), enabling the safe use of
     * `JSON.stringify` on Branch objects (in spite of their circular references).
     * @type {Function}
     * @returns {Object} A serializable Object
     */
    Branch.prototype.toJSON = function() {
      return this.toObject();
    };

    /**
     * Computes a matrix of all patristic distances between all leaves which are
     * descendants of the Branch on which this method is called.
     * @return {Object} An Object containing a matrix (an Array of Arrays) and
     * Array of `id`s corresponding to the rows (and columns) of the matrix.
     */
    Branch.prototype.toMatrix = function() {
      let leafs = this.getLeaves();
      let n = leafs.length;
      let matrix = new Array(n);
      for (let i = 0; i < n; i++) {
        matrix[i] = new Array(n);
        matrix[i][i] = 0;
        for (let j = 0; j < i; j++) {
          let distance = leafs[i].distanceTo(leafs[j]);
          matrix[i][j] = distance;
          matrix[j][i] = distance;
        }
      }
      return {
        matrix: matrix,
        ids: leafs.map(d => d.id)
      };
    };

    /**
     * Returns the Newick representation of this Branch and its descendants.
     * @param  {Boolean} [nonterminus=falsy] Is this not the terminus of the
     * Newick Tree? This should be falsy when called by a user (i.e. you). It's
     * used internally to decide whether or not in include a semicolon in the
     * returned string.
     * @return {String} The [Newick](https://en.wikipedia.org/wiki/Newick_format)
     * representation of the Branch.
     */
    Branch.prototype.toNewick = function(nonterminus) {
      let out = "";
      if (!this.isLeaf()) {
        out +=
          "(" + this.children.map(child => child.toNewick(true)).join(",") + ")";
      }
      out += this.id;
      if (this.length) out += ":" + numberToString(this.length);
      if (!nonterminus) out += ";";
      return out;
    };

    //This function takes a number and returns a string representation that does
    //not use Scientific Notation.
    //It's adapted from [StackOverflow](https://stackoverflow.com/a/46545519/521121),
    //Which makes it available under the [CC BY-SA 3.0 License](https://creativecommons.org/licenses/by-sa/3.0/)
    function numberToString(num) {
      let numStr = String(num);
      if (Math.abs(num) < 1.0) {
        let e = parseInt(num.toString().split("e-")[1]);
        if (e) {
          let negative = num < 0;
          if (negative) num *= -1;
          num *= Math.pow(10, e - 1);
          numStr = "0." + new Array(e).join("0") + num.toString().substring(2);
          if (negative) numStr = "-" + numStr;
        }
      } else {
        let e = parseInt(num.toString().split("+")[1]);
        if (e > 20) {
          e -= 20;
          num /= Math.pow(10, e);
          numStr = num.toString() + new Array(e + 1).join("0");
        }
      }
      return numStr;
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
    Branch.prototype.toObject = function() {
      let output = {
        id: this.id,
        length: this.length
      };
      if (this.children.length > 0)
        output.children = this.children.map(c => c.toObject());
      return output;
    };

    /**
     * Returns a valid JSON-string version of this Branch and its descendants.
     * @param {Function} replacer A replacer function to [pass to `JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Parameters).
     * @param {(Number|String)} space A string or number of spaces to use for
     * indenting the output. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Parameters
     * for additional details.
     * @return {Object} A valid JSON string representing this Branch and its
     * descendants.
     */
    Branch.prototype.toString = function(replacer, width) {
      if (!replacer) replacer = null;
      if (!width) width = 0;
      return JSON.stringify(this, replacer, width);
    };

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
      if (!idLabel) idLabel = "id";
      if (!lengthLabel) lengthLabel = "length";
      if (!childrenLabel) childrenLabel = "children";
      if (typeof json === "string") json = JSON.parse(json);
      let root = new Branch({
        id: json[idLabel],
        length: json[lengthLabel]
      });
      if (json[childrenLabel] instanceof Array) {
        json[childrenLabel].forEach(child => {
          root.addChild(parseJSON(child));
        });
      }
      return root.fixDistances();
    }

    /**
     * Parses a matrix of distances and returns the root Branch of the output tree.
     * This is adapted from Maciej Korzepa's [neighbor-joining](https://github.com/biosustain/neighbor-joining),
     * which is released for modification under the [MIT License](https://opensource.org/licenses/MIT).
     * @param  {Array} matrix An array of `n` arrays of length `n`
     * @param  {Array} labels An array of `n` strings, each corresponding to the
     * values in `matrix`.
     * @return {Branch} A Branch object representing the root Branch of the tree
     * inferred by neighbor joining on `matrix`.
     */
    function parseMatrix(matrix, labels) {
      let that = {};
      let N = (that.N = matrix.length);
      if (!labels) labels = [...Array(N).keys()];
      that.cN = that.N;
      that.D = matrix;
      that.labels = labels;
      that.labelToTaxon = {};
      that.currIndexToLabel = new Array(N);
      that.rowChange = new Array(N);
      that.newRow = new Array(N);
      that.labelToNode = new Array(2 * N);
      that.nextIndex = N;
      that.I = new Array(that.N);
      that.S = new Array(that.N);
      for (let i = 0; i < that.N; i++) {
        let sortedRow = sortWithIndices(that.D[i], i);
        that.S[i] = sortedRow;
        that.I[i] = sortedRow.sortIndices;
      }
      that.removedIndices = new Set();
      that.indicesLeft = new Set();
      for (let i = 0; i < N; i++) {
        that.currIndexToLabel[i] = i;
        that.indicesLeft.add(i);
      }
      that.rowSumMax = 0;
      that.PNewick = "";
      let minI, minJ, d1, d2, l1, l2, node1, node2, node3;

      function setUpNode(labelIndex, distance) {
        let node;
        if (labelIndex < that.N) {
          node = new Branch({ id: that.labels[labelIndex], length: distance });
          that.labelToNode[labelIndex] = node;
        } else {
          node = that.labelToNode[labelIndex];
          node.setLength(distance);
        }
        return node;
      }

      that.rowSums = sumRows(that.D);
      for (let i = 0; i < that.cN; i++) {
        if (that.rowSums[i] > that.rowSumMax) that.rowSumMax = that.rowSums[i];
      }

      while (that.cN > 2) {
        //if (that.cN % 100 == 0 ) console.log(that.cN);
        ({ minI, minJ } = search(that));

        d1 =
          0.5 * that.D[minI][minJ] +
          (that.rowSums[minI] - that.rowSums[minJ]) / (2 * that.cN - 4);
        d2 = that.D[minI][minJ] - d1;

        l1 = that.currIndexToLabel[minI];
        l2 = that.currIndexToLabel[minJ];

        node1 = setUpNode(l1, d1);
        node2 = setUpNode(l2, d2);
        node3 = new Branch({ children: [node1, node2] });

        recalculateDistanceMatrix(that, minI, minJ);
        let sorted = sortWithIndices(that.D[minJ], minJ);
        that.S[minJ] = sorted;
        that.I[minJ] = sorted.sortIndices;
        that.S[minI] = that.I[minI] = [];
        that.cN--;

        that.labelToNode[that.nextIndex] = node3;
        that.currIndexToLabel[minI] = -1;
        that.currIndexToLabel[minJ] = that.nextIndex++;
      }

      let left = that.indicesLeft.values();
      minI = left.next().value;
      minJ = left.next().value;

      l1 = that.currIndexToLabel[minI];
      l2 = that.currIndexToLabel[minJ];
      d1 = d2 = that.D[minI][minJ] / 2;

      node1 = setUpNode(l1, d1);
      node2 = setUpNode(l2, d2);

      let tree = new Branch({ children: [node1, node2] });
      tree.fixParenthood();
      return tree.fixDistances();
    }

    function search(t) {
      let qMin = Infinity,
        D = t.D,
        cN = t.cN,
        n2 = cN - 2,
        S = t.S,
        I = t.I,
        rowSums = t.rowSums,
        removedColumns = t.removedIndices,
        uMax = t.rowSumMax,
        q,
        minI = -1,
        minJ = -1,
        c2;

      // initial guess for qMin
      for (let r = 0; r < t.N; r++) {
        if (removedColumns.has(r)) continue;
        c2 = I[r][0];
        if (removedColumns.has(c2)) continue;
        q = D[r][c2] * n2 - rowSums[r] - rowSums[c2];
        if (q < qMin) {
          qMin = q;
          minI = r;
          minJ = c2;
        }
      }

      for (let r = 0; r < t.N; r++) {
        if (removedColumns.has(r)) continue;
        for (let c = 0; c < S[r].length; c++) {
          c2 = I[r][c];
          if (removedColumns.has(c2)) continue;
          if (S[r][c] * n2 - rowSums[r] - uMax > qMin) break;
          q = D[r][c2] * n2 - rowSums[r] - rowSums[c2];
          if (q < qMin) {
            qMin = q;
            minI = r;
            minJ = c2;
          }
        }
      }

      return { minI, minJ };
    }

    function recalculateDistanceMatrix(t, joinedIndex1, joinedIndex2) {
      let D = t.D,
        n = D.length,
        sum = 0,
        aux,
        aux2,
        removedIndices = t.removedIndices,
        rowSums = t.rowSums,
        newRow = t.newRow,
        rowChange = t.rowChange,
        newMax = 0;

      removedIndices.add(joinedIndex1);
      for (let i = 0; i < n; i++) {
        if (removedIndices.has(i)) continue;
        aux = D[joinedIndex1][i] + D[joinedIndex2][i];
        aux2 = D[joinedIndex1][joinedIndex2];
        newRow[i] = 0.5 * (aux - aux2);
        sum += newRow[i];
        rowChange[i] = -0.5 * (aux + aux2);
      }
      for (let i = 0; i < n; i++) {
        D[joinedIndex1][i] = -1;
        D[i][joinedIndex1] = -1;
        if (removedIndices.has(i)) continue;
        D[joinedIndex2][i] = newRow[i];
        D[i][joinedIndex2] = newRow[i];
        rowSums[i] += rowChange[i];
        if (rowSums[i] > newMax) newMax = rowSums[i];
      }
      rowSums[joinedIndex1] = 0;
      rowSums[joinedIndex2] = sum;
      if (sum > newMax) newMax = sum;
      t.rowSumMax = newMax;
      t.indicesLeft.delete(joinedIndex1);
    }

    function sumRows(a) {
      let n = a.length,
        sums = new Array(n);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          let v = parseFloat(a[i][j]);
          if (typeof v !== "number") continue;
          sum += a[i][j];
        }
        sums[i] = sum;
      }
      return sums;
    }

    function sortWithIndices(toSort, skip) {
      if (typeof skip === "undefined") skip = -1;
      let n = toSort.length;
      let indexCopy = new Array(n);
      let valueCopy = new Array(n);
      let i2 = 0;
      for (let i = 0; i < n; i++) {
        if (toSort[i] === -1 || i === skip) continue;
        indexCopy[i2] = i;
        valueCopy[i2++] = toSort[i];
      }
      indexCopy.length = i2;
      valueCopy.length = i2;
      indexCopy.sort((a, b) => toSort[a] - toSort[b]);
      valueCopy.sortIndices = indexCopy;
      for (let j = 0; j < i2; j++) {
        valueCopy[j] = toSort[indexCopy[j]];
      }
      return valueCopy;
    }

    /**
     * Parses a Newick String and returns a Branch object representing the root
     * of the output Tree.
     * This is adapted Jason Davies' [newick.js](https://github.com/jasondavies/newick.js/blob/master/src/newick.js),
     * which is released for modification under [the MIT License](https://opensource.org/licenses/MIT).
     * @param  {string} newick A Newick String
     * @return {Branch} A Branch representing the root of the output tree
     */
    function parseNewick(newick) {
      let ancestors = [],
        tree = new Branch(),
        tokens = newick.split(/\s*(;|\(|\)|,|:)\s*/),
        n = tokens.length;
      for (let t = 0; t < n; t++) {
        let token = tokens[t];
        let c;
        switch (token) {
          case "(": // new Branchset
            c = tree.addChild();
            ancestors.push(tree);
            tree = c;
            break;
          case ",": // another Branch
            c = ancestors[ancestors.length - 1].addChild();
            tree = c;
            break;
          case ")": // optional name next
            tree = ancestors.pop();
            break;
          case ":": // optional length next
            break;
          default:
            let x = tokens[t - 1];
            if (x == ")" || x == "(" || x == ",") {
              tree.id = token;
            } else if (x == ":") {
              tree.length = parseFloat(token);
            }
        }
      }
      return tree.fixDistances();
    }

    exports.Branch = Branch;
    exports.parseJSON = parseJSON;
    exports.parseMatrix = parseMatrix;
    exports.parseNewick = parseNewick;
    exports.version = version;

  }));

  // import "d3";

  /**
   * This class function creates a TidyTree object.
   * @param {String} newick A valid newick string
   * @param {Object} options A Javascript object containing options to set up the tree
   */
  function TidyTree(data, options, events) {
    let defaults = {
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
      interactive: true, // enable/disable pan and zoom (initialization-time only)
      animation: 500,
      margin: [50, 50, 50, 50] //CSS order: top, right, bottom, left
    };
    if (!options) options = {};
    Object.assign(this, defaults, options, {
      events: {
        draw: [],
        showtooltip: [],
        hidetooltip: [],
        contextmenu: [],
        search: [],
        select: []
      }
    });

    if(events) Object.keys(events).forEach(e => this.events[e].push(events[e]));

    if (this.parent) this.draw(this.parent);

    if (data instanceof patristic.Branch) {
      this.setData(data);
    } else {
      this.setTree(data);
    }

    if (this.parent) this.recenter();
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
    if (!data) throw Error("Invalid Data");
    this.data = data;
    this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    this.hierarchy = d3
      .hierarchy(this.data, d => d.children)
      .eachBefore(d => {
        d.value =
          (d.parent ? d.parent.value : 0) + (d.data.length ? d.data.length : 0);
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
  TidyTree.validLayouts = ["horizontal", "vertical", "circular"];

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
  TidyTree.validNodeColorModes = ["none", "predicate"]; // later, highlight on hover, or maybe color by annotation on a node/ search

  /**
   * The available color modes for rendering branches.
   * @type {Array}
   */
  TidyTree.validBranchColorModes = ["none", "monophyletic"]; // later, toRoot? 

  /**
   * Private method to calculate how much vertical space to leave for the ruler
   */
  TidyTree.prototype._rulerOffset = function () {
    return this.ruler &&
      this.layout === "horizontal" &&
      (this.type === 'weighted' || this.type === 'tree')
      ? 25 : 0;
  };

  /**
   * Draws a Phylogenetic on the element referred to by selector
   * @param  {String} selector A CSS selector
   * @return {TidyTree}           the TidyTree object
   */
  TidyTree.prototype.draw = function (selector) {
    if (!selector && !this.parent) {
      throw Error("No valid target for drawing given! Where should the tree go?");
    }
    let parent = (this.parent = d3.select(selector ? selector : this.parent));

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

    this.zoom = d3.zoom().on("zoom", () => {
      let transform = (this.transform = d3.event.transform);
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

    // Note that there is no facility to switch interactive mode on and
    // off interactively via a toggle in the example app.
    // This would require providing a `setInteractive` function and other
    // issues to be solved. The approach here didn't seem to work :-(
    // https://stackoverflow.com/a/50464280/1909761
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
          .radius(getY)
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
        }
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
        }
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
          .radius(getLength)
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
        }
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
        }
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

  /**
   * Finds the color of a given node based on the color options provided.
   *
   * @param {Object} node - The node for which to find the color.
   * @param {Object} colorOptions - The color options object containing the color mode, leavesOnly, predicate, default color, and highlight color.
   * @return {string} The color of the node.
   */
  function findNodeColor(node, colorOptions) {
    if (colorOptions.nodeColorMode === "none") {
      // steelblue
      return colorOptions.defaultNodeColor ?? "#4682B4";
    }
   
    let guidList = colorOptions.nodeList?.map(node => node._guid);

    if (guidList && guidList.includes(node.data._guid)) {
      // yellowish
      return colorOptions.highlightColor ?? "#feb640";
    } else {
      // charcoal
      return colorOptions.defaultNodeColor ?? "#243127";
    }
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
      // light gray
      return colorOptions.defaultBranchColor ?? "#cccccc";
    }
    
    let source = link.source;
    let childLeafNodes = getAllLeaves(source);
    let guidList = colorOptions.nodeList?.map(node => node._guid);
    
    let allChildLeafNodesInNodeList = childLeafNodes.every(child =>
      guidList?.includes(child.data._guid)
    );
   
    if (allChildLeafNodesInNodeList) {
      // yellowish
      return colorOptions.highlightColor ?? "#feb640";
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
        }
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
        }
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
        }
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
        }
      }
    }
  };
  labelTransformers.tree.smooth = labelTransformers.tree.straight;
  labelTransformers.weighted.smooth = labelTransformers.weighted.straight;
  labelTransformers.dendrogram = labelTransformers.tree;

  function labeler(d) {
    if (!d.target.data.length) return "0.000";
    return d.target.data.length.toFixed(3);
  }

  /**
   * Redraws the links and relocates the nodes accordingly
   * @return {TidyTree} The TidyTree Object
   */
  TidyTree.prototype.redraw = function () {
    let parent = this.parent;

    this.width  = (parseFloat(parent.style("width" )) - this.margin[1] - this.margin[3]) * this.hStretch;
    this.height = (parseFloat(parent.style("height")) - this.margin[0] - this.margin[2] - this._rulerOffset()) * this.vStretch;

    this.scalar =
      this.layout === "horizontal" ? this.width :
      this.layout === "vertical" ? this.height :
      Math.min(this.width, this.height) / 2;

    this.hierarchy.each(d => (d.weight = this.scalar * d.value));

    let g = parent.select("svg g");

    let source = (this.type === "tree" ? d3.tree() : d3.cluster()).size(
      this.layout === "circular"   ? [2 * Math.PI, Math.min(this.height, this.width) / 2] :
      this.layout === "horizontal" ? [this.height, this.width] :
      [this.width, this.height]
    );

    if (this.equidistantLeaves) {
      if (this.layout === "circular") {
        source.separation((a,b) => 1 / a.depth);
      } else {
        source.separation((a,b) => 1);
      }
    } else {
      if (this.layout === "circular")
        source.separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
    }
    
    //Note: You must render links prior to nodes in order to get correct placement!
    let links = g
      .select("g.tidytree-links")
      .selectAll("g.tidytree-link")
      .data(source(this.hierarchy).links(), l => l.source.data._guid + ':' + l.target.data._guid);

    links.join(
      enter => {
        let newLinks = enter.append("g").attr("class", "tidytree-link");

        let linkTransformer = linkTransformers[this.type][this.mode][this.layout];
        newLinks
          .append("path")
          .attr("fill", "none")
          .attr("stroke", d => findBranchColor(d, this.colorOptions))
          .attr("d", linkTransformer)
          .transition()
          .duration(this.animation)
          .attr("opacity", 1);

        let labelTransformer = labelTransformers[this.type][this.mode][this.layout];
        newLinks
          .append("text")
          .attr("y", 2)
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .text(labeler)
          .attr("transform", labelTransformer)
          .transition()
          .duration(this.animation)
          .style("opacity", this.branchDistances ? 1 : 0);
      },
      update => {
        let linkTransformer = linkTransformers[this.type][this.mode][this.layout];
        let paths = update.select("path");
        if (!this.animation > 0) {
          paths
          .attr("d", linkTransformer)
          .attr("stroke", d => findBranchColor(d, this.colorOptions));
        } else {
          paths
            .transition()
            .duration(this.animation / 2)
            .attr("stroke", d => findBranchColor(d, this.colorOptions))
            .attr("opacity", 0)
            .end()
            .then(() => {
              paths
                .attr("d", linkTransformer)
                .transition()
                .duration(this.animation / 2)
                .attr("opacity", 1);
            });
        }

        let labelTransformer =
          labelTransformers[this.type][this.mode][this.layout];
        let labels = update.select("text");
        if (this.animation) {
          labels
            .transition()
            .duration(this.animation / 2)
            .style("opacity", 0)
            .end()
            .then(() => {
              labels.text(labeler).attr("transform", labelTransformer);
              if (this.branchDistances) {
              labels
                .transition()
                .duration(this.animation / 2)
                .style("opacity", this.branchDistances ? 1 : 0);
              }
            });
        } else {
          labels.text(labeler).attr("transform", labelTransformer);
        }
      },
      exit =>
        exit
          .transition()
          .duration(this.animation)
          .attr("opacity", 0)
          .remove()
    );

    let nodes = g
      .select("g.tidytree-nodes")
      .selectAll("g.tidytree-node")
      .data(this.hierarchy.descendants(), d => d.data._guid);
    nodes.join(
      enter => {
        let nt = nodeTransformers[this.type][this.layout];
        let newNodes = enter
          .append("g")
          .attr("class", "tidytree-node")
          .classed("tidytree-node-internal", d => d.children)
          .classed("tidytree-node-leaf", d => !d.children)
          .attr("transform", nt);

        newNodes
          .append("circle")
          .attr("title", d => d.data.id)
          .style("opacity", d =>
            (d.children && this.branchNodes) ||
            (!d.children && this.leafNodes) ? 1 : 0
          )
          .style("fill", d => findNodeColor(d, this.colorOptions))
          .on("mouseenter focusin", d => this.trigger("showtooltip", d))
          .on("mouseout focusout", d => this.trigger("hidetooltip", d))
          .on("contextmenu", d => this.trigger("contextmenu", d))
          .on("click", d => this.trigger("select", d))
          .attr("r", 2.5);

        let nodeLabels = newNodes
          .append("text")
          .text(d => d.data.id)
          .style("font-size", "12px")
          .attr("y", 2)
          .style("opacity", d =>
            ( d.children && this.branchLabels) ||
            (!d.children && this.leafLabels) ? 1 : 0
          );

        if (this.layout === "vertical") {
          nodeLabels
            .attr("text-anchor", "start")
            .attr("x", 5)
            .transition()
            .duration(this.animation)
            .attr("transform", "rotate(90)");
        } else if (this.layout === "horizontal") {
          nodeLabels
            .attr("text-anchor", "start")
            .attr("x", 5)
            .transition()
            .duration(this.animation)
            .attr("transform", "rotate(0)");
        } else {
          nodeLabels
            .transition()
            .duration(this.animation)
            .attr("transform", l => `rotate(${(((l.x / Math.PI) * 180) % 180) - 90})`)
            .attr("text-anchor", l => l.x % (2 * Math.PI) > Math.PI ? "end" : "start")
            .attr("x", l => (l.x % (2 * Math.PI) > Math.PI ? -5 : 5));
        }

        newNodes
          .transition()
          .duration(this.animation)
          .attr("opacity", 1);
      },
      update => {
        let nodeTransformer = nodeTransformers[this.type][this.layout];
        update
          .transition()
          .duration(this.animation)
          .attr("transform", nodeTransformer);

        let nodeGlyphs = update.select("circle");
        nodeGlyphs.style("fill", d => findNodeColor(d, this.colorOptions));      

        let nodeLabels = update.select("text");
        if (this.layout === "vertical") {
          nodeLabels
            .attr("text-anchor", "start")
            .attr("x", 5)
            .transition()
            .duration(this.animation)
            .attr("transform", "rotate(90)");
        } else if (this.layout === "horizontal") {
          nodeLabels
            .attr("text-anchor", "start")
            .attr("x", 5)
            .transition()
            .duration(this.animation)
            .attr("transform", "rotate(0)");
        } else {
          nodeLabels
            .transition()
            .duration(this.animation)
            .attr("transform", l => `rotate(${(((l.x / Math.PI) * 180) % 180) - 90})`)
            .attr("text-anchor", l => l.x % (2 * Math.PI) > Math.PI ? "end" : "start")
            .attr("x", l => (l.x % (2 * Math.PI) > Math.PI ? -5 : 5));
        }
      },
      exit =>
        exit
          .transition()
          .duration(this.animation)
          .attr("opacity", 0)
          .remove()
    );

    updateRuler.call(this);

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
    } else {
      // nodeColorMode === 'none'
      if (newColorOptions.branchColorMode !== 'none') {
        throw Error('branchColorMode must be "none" for nodeColorMode "none"');
      }
    }

    this.colorOptions = newColorOptions;
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
        .selectAll("g.tidytree-node-internal circle")
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
      .selectAll("g.tidytree-node-internal circle")
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
        .selectAll("g.tidytree-node-leaf circle")
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
      .selectAll("g.tidytree-node-leaf circle")
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
   * Retrieves the GUIDs of the nodes in the TidyTree instance.
   *
   * @param {boolean} leavesOnly - Whether to retrieve GUIDs only for leaf nodes.
   * @param {function} predicate - A function that returns true if the node should be included
   * @return {Array} An array of GUIDs of the nodes.
   */
  TidyTree.prototype.getNodeGUIDs = function (leavesOnly, predicate) {
    let nodeList = this.parent
      .select("svg")
      .selectAll("g.tidytree-node-leaf circle")
      ._groups[0];

    if (!leavesOnly) {
      nodeList = this.parent
        .select("svg")
        .selectAll("g.tidytree-node-leaf circle, g.tidytree-node-internal circle")
        ._groups[0];
    }

    let nodeGUIDs = [];
    for (const node of nodeList.values()) {
      if (!predicate || predicate(node)) {
        nodeGUIDs.push({ _guid: node.__data__.data._guid, id: node.__data__.data.id });
      }
    }

    return nodeGUIDs;
  };

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
  };

  return TidyTree;

}());
