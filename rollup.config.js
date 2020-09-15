import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/tidytree.js',
    format: 'iife',
    globals: {
      'patristic': 'patristic'
    },
    name: 'TidyTree'
  },
  plugins: [
    resolve()
  ]
};
