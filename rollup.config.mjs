import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/main.ts',
  output: [
    {
      file: 'dist/tidytree.js',
      format: 'iife',
      name: 'TidyTree'
    },
    {
      file: 'dist/tidytree.min.js',
      format: 'iife',
      name: 'TidyTree',
      plugins: [terser()]
    }
  ],
  plugins: [
    resolve(),
    typescript()
  ]
};
