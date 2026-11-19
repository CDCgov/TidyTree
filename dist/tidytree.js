var TidyTree = (function () {
    'use strict';

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

    // d3 (v7) is expected as a global, e.g. loaded from a <script> tag.

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
        interactive: true, // enable/disable pan and zoom
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
      return this.setData(parseNewick(newick));
    };

    /**
     * The bundled copy of patristic, used to parse and manipulate trees.
     * @type {Object}
     */
    TidyTree.patristic = patristic$1;

    // Earlier builds bundled patristic's UMD build, which defined a global
    // `patristic`. Keep providing it for pages that relied on that.
    if (typeof globalThis !== "undefined" && !globalThis.patristic) {
      globalThis.patristic = patristic$1;
    }

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

      d3.tree();

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

      this.zoom = d3.zoom().on("zoom", event => {
        let transform = (this.transform = event.transform);
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
        (node.children ?? []).forEach(child => {
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
            .on("mouseenter focusin", (e, d) => this.trigger("showtooltip", d, e))
            .on("mouseout focusout", (e, d) => this.trigger("hidetooltip", d, e))
            .on("contextmenu", (e, d) => this.trigger("contextmenu", d, e))
            .on("click", (e, d) => this.trigger("select", d, e))
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
        let orient = this.layout == "horizontal" ? "bottom" : "left";
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
    };

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
        if (newColorOptions.leavesOnly === undefined) {
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
        .selectAll(leavesOnly ?
          "g.tidytree-node-leaf circle" :
          "g.tidytree-node-leaf circle, g.tidytree-node-internal circle")
        .nodes();

      let nodeGUIDs = [];
      for (const node of nodeList) {
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
      delete this; //Go to work, GC!
    };

    return TidyTree;

})();
