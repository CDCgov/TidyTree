import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/tidytree.js',
    format: 'iife',
    globals: {
      'd3': 'd3'
    },
    name: 'TidyTree'
  },
  plugins: [
    resolve()
  ]
};
