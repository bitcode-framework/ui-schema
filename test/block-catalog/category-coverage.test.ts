// Category coverage test — all 8 ADR-017 categories are represented and the
// per-category counts match the matrix baseline distribution.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ALL_CANDIDATE_ENTRIES,
  getCandidatesByCategory,
} from '../../src/block-catalog/categories/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const matrix = JSON.parse(
  readFileSync(
    resolve(
      REPO_ROOT,
      'sprints',
      'package-ui-elementor',
      'block-catalog-candidate-matrix.json',
    ),
    'utf8',
  ),
);

const ALL_CATEGORIES = [
  'content',
  'data',
  'interaction',
  'commerce',
  'workflow',
  'builder',
  'analytics',
  'navigation',
] as const;

test('category-coverage: all 8 ADR-017 categories present in seed', () => {
  const seedCats = new Set(ALL_CANDIDATE_ENTRIES.map((e) => e.category));
  for (const c of ALL_CATEGORIES) {
    assert.ok(seedCats.has(c), `seed missing category ${c}`);
  }
});

test('category-coverage: seed category counts match matrix', () => {
  const matrixCounts: Record<string, number> = {};
  for (const c of matrix.candidates) {
    matrixCounts[c.category] = (matrixCounts[c.category] ?? 0) + 1;
  }
  const seedCounts: Record<string, number> = {};
  for (const e of ALL_CANDIDATE_ENTRIES) {
    seedCounts[e.category] = (seedCounts[e.category] ?? 0) + 1;
  }
  assert.deepEqual(seedCounts, matrixCounts, 'category count mismatch vs matrix');
});

test('category-coverage: getCandidatesByCategory returns correct subset', () => {
  for (const c of ALL_CATEGORIES) {
    const subset = getCandidatesByCategory(c);
    const expected = ALL_CANDIDATE_ENTRIES.filter((e) => e.category === c);
    assert.equal(subset.length, expected.length, `count for ${c}`);
  }
});
