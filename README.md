# DTree3

Yet another d3-powered Phylogenetic tree renderer.

# Why?

[MicrobeTrace](https://github.com/CDCgov/MicrobeTrace) needed a Phylogenetic Tree renderer that enabled rerooting and distance scaling.

Additionally, there were a bunch of nice-to-haves, like Unrooted and Circular views, Zooming, Colorable and Selectable nodes...

Of all the available phylogenetic tree libraries, [Phylotree](https://github.com/veg.phylotree.js) came closest, but it didn't quite cut it for us.

This is based on a re-implementation of Jason Davies’ [Phylogenetic Tree of Life](https://www.jasondavies.com/tree-of-life/), with faded gray lines to connect the leaf nodes of the tree to their corresponding labels inspired by [a figure from *Nature*](http://www.nature.com/nature/journal/v462/n7276/fig_tab/nature08656_F1.html).
