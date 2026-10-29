// Matrix parity test — candidate seed must match the frozen matrix baseline
// (sprints/package-ui-elementor/block-catalog-candidate-matrix.json v0.1.0)
// exactly on: id set, category, decision, matrixStatus, priorityBatch.
//
// Loads JSON via fs.readFileSync + JSON.parse (NOT resolveJsonModule) so the
// test works under node:test without tsconfig JSON resolution.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ALL_CANDIDATE_ENTRIES } from '../../src/block-catalog/categories/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ui-schema/test/block-catalog -> repo root has sprints/package-ui-elementor
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const MATRIX_PATH = resolve(
  REPO_ROOT,
  'sprints',
  'package-ui-elementor',
  'block-catalog-candidate-matrix.json',
);

interface MatrixCandidate {
  id: string;
  category: string;
  decision: string;
  status: string;
  priorityBatch: string;
  renderStrategy: string;
}

interface MatrixFile {
  schemaVersion: string;
  status: string;
  candidates: MatrixCandidate[];
}

const matrix: MatrixFile = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));

test('matrix-parity: matrix baseline is accepted-baseline v0.1.0', () => {
  assert.equal(matrix.schemaVersion, '0.1.0');
  assert.equal(matrix.status, 'accepted-baseline');
});

test('matrix-parity: candidate count matches matrix (48)', () => {
  assert.equal(matrix.candidates.length, 48, 'matrix must have 48 candidates');
  assert.equal(
    ALL_CANDIDATE_ENTRIES.length,
    48,
    'seed must have exactly 48 entries',
  );
});

test('matrix-parity: id set matches exactly', () => {
  const matrixIds = new Set(matrix.candidates.map((c) => c.id));
  const seedIds = new Set(ALL_CANDIDATE_ENTRIES.map((e) => e.id));
  const missingInSeed = [...matrixIds].filter((id) => !seedIds.has(id));
  const extraInSeed = [...seedIds].filter((id) => !matrixIds.has(id));
  assert.deepEqual(missingInSeed, [], 'seed is missing matrix ids');
  assert.deepEqual(extraInSeed, [], 'seed has ids not in matrix');
});

test('matrix-parity: category matches per id', () => {
  const matrixById = new Map(matrix.candidates.map((c) => [c.id, c]));
  const mismatches: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const m = matrixById.get(entry.id);
    if (!m) continue;
    if (m.category !== entry.category) {
      mismatches.push(`${entry.id}: matrix=${m.category} seed=${entry.category}`);
    }
  }
  assert.deepEqual(mismatches, [], 'category mismatches');
});

test('matrix-parity: decision matches per id', () => {
  const matrixById = new Map(matrix.candidates.map((c) => [c.id, c]));
  const mismatches: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const m = matrixById.get(entry.id);
    if (!m) continue;
    if (m.decision !== entry.decision) {
      mismatches.push(`${entry.id}: matrix=${m.decision} seed=${entry.decision}`);
    }
  }
  assert.deepEqual(mismatches, [], 'decision mismatches');
});

test('matrix-parity: matrixStatus matches per id', () => {
  const matrixById = new Map(matrix.candidates.map((c) => [c.id, c]));
  const mismatches: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const m = matrixById.get(entry.id);
    if (!m) continue;
    if (m.status !== entry.matrixStatus) {
      mismatches.push(`${entry.id}: matrix=${m.status} seed=${entry.matrixStatus}`);
    }
  }
  assert.deepEqual(mismatches, [], 'matrixStatus mismatches');
});

test('matrix-parity: priorityBatch matches per id', () => {
  const matrixById = new Map(matrix.candidates.map((c) => [c.id, c]));
  const mismatches: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const m = matrixById.get(entry.id);
    if (!m) continue;
    if (m.priorityBatch !== entry.priorityBatch) {
      mismatches.push(
        `${entry.id}: matrix=${m.priorityBatch} seed=${entry.priorityBatch}`,
      );
    }
  }
  assert.deepEqual(mismatches, [], 'priorityBatch mismatches');
});

test('matrix-parity: renderStrategy matches per id', () => {
  const matrixById = new Map(matrix.candidates.map((c) => [c.id, c]));
  const mismatches: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const m = matrixById.get(entry.id);
    if (!m) continue;
    if (m.renderStrategy !== entry.renderStrategy) {
      mismatches.push(
        `${entry.id}: matrix=${m.renderStrategy} seed=${entry.renderStrategy}`,
      );
    }
  }
  assert.deepEqual(mismatches, [], 'renderStrategy mismatches');
});
