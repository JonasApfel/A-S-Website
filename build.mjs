// Baut die JavaScript-Dateien: npm run build
import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'js',
  minify: true,
  target: ['es2020'],
  chunkNames: '[name]-[hash]',
  legalComments: 'linked',
  logLevel: 'info',
});
