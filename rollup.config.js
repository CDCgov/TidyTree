import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/tidytree.js',
    format: 'iife',
    name: 'TidyTree'
  },
  plugins: [
    resolve(),
    typescript()
  ]
};
