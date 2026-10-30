// Bundles @bitcode/ui-schema into a browser-ready ESM file for the demo at
// https://bitcode-framework.github.io/ui-schema/
//
// The package is TypeScript-only (no build step), so esbuild transpiles the
// sources directly.

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

mkdirSync(resolve(root, 'demo'), { recursive: true });

await esbuild.build({
  entryPoints: [resolve(root, 'src', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outfile: resolve(root, 'demo', 'ui-schema.js')
});

console.log('demo bundle written to demo/ui-schema.js');
