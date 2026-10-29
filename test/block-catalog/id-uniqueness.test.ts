// ID uniqueness test — all candidate ids are unique; assertUniqueIds passes.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ALL_CANDIDATE_ENTRIES,
  assertUniqueIds,
  CANDIDATE_COUNT,
} from '../../src/block-catalog/categories/index.ts';

test('id-uniqueness: assertUniqueIds does not throw for the seed', () => {
  assert.doesNotThrow(() => assertUniqueIds());
});

test('id-uniqueness: assertUniqueIds throws on duplicate', () => {
  const [first, second] = ALL_CANDIDATE_ENTRIES;
  assert.throws(
    () => assertUniqueIds([first, second, first]),
    /Duplicate Block Catalog candidate ids/,
  );
});

test('id-uniqueness: id count equals candidate count', () => {
  const ids = ALL_CANDIDATE_ENTRIES.map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, 'ids must be unique');
  assert.equal(ids.length, CANDIDATE_COUNT, 'CANDIDATE_COUNT matches array length');
});

test('id-uniqueness: all ids match namespace.name slug pattern', () => {
  const pattern = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;
  const bad = ALL_CANDIDATE_ENTRIES.filter((e) => !pattern.test(e.id));
  assert.deepEqual(
    bad.map((e) => e.id),
    [],
    'all ids must be namespace.name slugs',
  );
});
