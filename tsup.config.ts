import { defineConfig } from 'tsup';

const browserIIFE = {
  globalName: 'Obfious',
  target: 'es2020' as const,
  treeshake: true,
  noExternal: ['@noble/curves', '@noble/hashes'] as string[],
  platform: 'browser' as const,
  outDir: 'dist',
};

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    treeshake: true,
    platform: 'browser',
    noExternal: ['@noble/curves', '@noble/hashes'],
    outExtension: () => ({ js: '.mjs' }),
  },
  {
    entry: { 'obfious.umd': 'src/index.ts' },
    format: ['iife'],
    ...browserIIFE,
    minify: false,
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'obfious.min': 'src/index.ts' },
    format: ['iife'],
    ...browserIIFE,
    minify: true,
    outExtension: () => ({ js: '.js' }),
  },
]);
