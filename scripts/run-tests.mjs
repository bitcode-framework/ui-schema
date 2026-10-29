// run-tests.mjs
//
// Run source-level tests (*.test.ts) under src/ and test/ via Node's native
// test runner. Mirrors packages/ui/scripts/run-source-tests.mjs convention.
import { spawnSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

function walkTestFiles(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walkTestFiles(full, out);
    } else if (entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const testFiles = [
  ...walkTestFiles(join(ROOT, 'src')),
  ...walkTestFiles(join(ROOT, 'test')),
];

if (testFiles.length === 0) {
  console.error('No source test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=spec', ...testFiles],
  { stdio: 'inherit', cwd: ROOT },
);

const status = result.status === null ? 0 : result.status;
process.exit(status);
