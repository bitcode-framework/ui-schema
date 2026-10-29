// Categories shape test — every candidate entry passes the shape validator
// with zero `error` diagnostics. ADR-017 §8, plan §7.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateCandidateCatalogEntry } from '../../src/block-catalog/index.ts';
import { ALL_CANDIDATE_ENTRIES } from '../../src/block-catalog/categories/index.ts';

test('categories-shape: ALL_CANDIDATE_ENTRIES is non-empty', () => {
  assert.ok(ALL_CANDIDATE_ENTRIES.length > 0, 'expected candidate entries');
});

test('categories-shape: every entry validates with zero error diagnostics', () => {
  const failures: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    const result = validateCandidateCatalogEntry(entry);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      failures.push(
        `${entry.id}: ${errors
          .map((e) => `${e.code}(${e.fieldPath ?? '?'}): ${e.message}`)
          .join('; ')}`,
      );
    }
  }
  assert.equal(failures.length, 0, `Shape validation failures:\n${failures.join('\n')}`);
});

test('categories-shape: every entry is readiness candidate (no Ready promotion)', () => {
  const promoted = ALL_CANDIDATE_ENTRIES.filter((e) => e.readiness !== 'candidate');
  assert.deepEqual(
    promoted.map((e) => e.id),
    [],
    'no entry may be promoted to Ready in this scope',
  );
});

test('categories-shape: every entry declares a cache policy', () => {
  const missing = ALL_CANDIDATE_ENTRIES.filter((e) => !e.cachePolicy);
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
    'cachePolicy must be declared even if strategy none',
  );
});

test('categories-shape: every entry declares an offline policy', () => {
  const missing = ALL_CANDIDATE_ENTRIES.filter((e) => !e.offlinePolicy);
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
    'offlinePolicy must be declared even if unsupported',
  );
});

test('categories-shape: every entry declares migration metadata', () => {
  const missing = ALL_CANDIDATE_ENTRIES.filter((e) => !e.migration);
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
    'migration metadata must be present for versioning',
  );
});

test('categories-shape: every entry declares a security policy', () => {
  const missing = ALL_CANDIDATE_ENTRIES.filter((e) => !e.securityPolicy);
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
    'securityPolicy must be declared for all entries',
  );
});

test('categories-shape: every entry has fallbackLabel (English)', () => {
  const missing = ALL_CANDIDATE_ENTRIES.filter(
    (e) => typeof e.fallbackLabel !== 'string' || e.fallbackLabel.length === 0,
  );
  assert.deepEqual(missing.map((e) => e.id), []);
});
