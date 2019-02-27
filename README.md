# TidyTree

*Phylogenetic trees, powered by d3*

This repository was created for use by CDC programs to collaborate on public health surveillance related projects in support of the CDC Surveillance Strategy.  Github is not hosted by the CDC, but is used by CDC and its partners to share information and collaborate on software.

TidyTree is both [a full-featured web application](https://CDCgov.github.io/TidyTree/demo/index.html) for users, along with the underlying library for developers.

## Launch the Application

[Launch TidyTree](https://CDCgov.github.io/TidyTree/demo/index.html)

It's designed to replicate much of the functionality of [FigTree](http://tree.bio.ed.ac.uk/software/figtree/), though it's by no means a perfect replacement. It does, however, run entirely in-browser.

## Developer Quick Start

First import the library:

```HTML
<script src="https://unpkg.com/tidytree@0.2.8/dist/tidytree.min.js"></script>
```

Then stick this in an HTML `script` tag:

```javascript
let newick = '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);';
let tree = new TidyTree(newick, {parent: 'body'});
```

[And Voila!](https://codepen.io/AABoyles/pen/PVvOOx) Your `body` will be populated by a phylogenetic tree.

## Developer Documentation

[...is available here.](https://CDCgov.github.io/TidyTree/docs/)

## Shoutouts

tidytree is based on [this gist](https://gist.github.com/Andrew-Reid/c7ae41a98b8cbb38f1febf13deb9d294) ([See in action](https://bl.ocks.org/Andrew-Reid/c7ae41a98b8cbb38f1febf13deb9d294)), which "mostly just duplicates the cannonical[sic] d3.tree and d3.cluster bl.ocks by Mike Bostock."

## Why?

[MicrobeTrace](https://github.com/CDCgov/MicrobeTrace) needed a Phylogenetic Tree renderer that enabled rerooting and distance scaling. Additionally, there were a bunch of nice-to-haves, like Unrooted and Circular views, Zooming, Colorable and Selectable nodes... You get the idea.

As for the viewer, well, we needed a platform to rapidly prototype features for the library. The product of that is a single-page web application that leverages literally all of the features of the library. If you're a dork like me, you can see this in the coding of the [index.html file](https://github.com/CDCgov/TidyTree/blob/master/demo/index.html). Notice how all of the select widgets are programmatically populated--that's so we could implement new features (e.g. layouts) without having to update the Demo HTML. After that, all we had to do was keep the UI clean.

## Public Domain
This repository constitutes a work of the United States Government and is not
subject to domestic copyright protection under 17 USC § 105. This repository is
in the public domain within the United States, and copyright and related rights
in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
All contributions to this repository will be released under the CC0 dedication.
By submitting a pull request you are agreeing to comply with this waiver of
copyright interest.

## License
The repository utilizes code licensed under the terms of the Apache Software
License and therefore is licensed under ASL v2 or later.

This source code in this repository is free: you can redistribute it and/or
modify it under the terms of the Apache Software License version 2, or (at your
option) any later version.

This source code in this repository is distributed in the hope that it will be
useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the Apache Software
License for more details.

You should have received a copy of the Apache Software License along with this
program. If not, see http://www.apache.org/licenses/LICENSE-2.0.html

The source code forked from other open source projects will inherit its license.

## Privacy
This repository contains only non-sensitive, publicly available data and
information. All material and community participation is covered by the
Surveillance Platform [Disclaimer](https://github.com/CDCgov/template/blob/master/DISCLAIMER.md)
and [Code of Conduct](https://github.com/CDCgov/template/blob/master/code-of-conduct.md).
For more information about CDC's privacy policy, please visit [http://www.cdc.gov/privacy.html](http://www.cdc.gov/privacy.html).

## Contributing
Anyone is encouraged to contribute to the repository by [forking](https://help.github.com/articles/fork-a-repo)
and submitting a pull request. (If you are new to GitHub, you might start with a
[basic tutorial](https://help.github.com/articles/set-up-git).) By contributing
to this project, you grant a world-wide, royalty-free, perpetual, irrevocable,
non-exclusive, transferable license to all users under the terms of the
[Apache Software License v2](http://www.apache.org/licenses/LICENSE-2.0.html) or
later.

All comments, messages, pull requests, and other submissions received through
CDC including this GitHub page are subject to the [Presidential Records Act](http://www.archives.gov/about/laws/presidential-records.html)
and may be archived. Learn more at [http://www.cdc.gov/other/privacy.html](http://www.cdc.gov/other/privacy.html).

## Records
This repository is not a source of government records, but is a copy to increase
collaboration and collaborative potential. All government records will be
published through the [CDC web site](http://www.cdc.gov).

## Notices
Please refer to [CDC's Template Repository](https://github.com/CDCgov/template)
for more information about [contributing to this repository](https://github.com/CDCgov/template/blob/master/CONTRIBUTING.md),
[public domain notices and disclaimers](https://github.com/CDCgov/template/blob/master/DISCLAIMER.md),
and [code of conduct](https://github.com/CDCgov/template/blob/master/code-of-conduct.md).
