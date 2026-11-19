// commit-and-tag-version updater: keeps the demo's cache-busting
// `tidytree.js?v=X.Y.Z` query string in sync with package.json.
const pattern = /tidytree\.js\?v=([0-9A-Za-z.+-]+)/;

module.exports.readVersion = contents => {
  const match = contents.match(pattern);
  if (!match) throw new Error('tidytree.js?v= not found in app/index.html');
  return match[1];
};

module.exports.writeVersion = (contents, version) =>
  contents.replace(pattern, `tidytree.js?v=${version}`);
