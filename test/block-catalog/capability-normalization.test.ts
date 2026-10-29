// Capability normalization test — no candidate carries the raw pre-ADR alias
// `action-trigger`; all such capabilities must be normalized to `action-source`.
// Also asserts every capability is canonical (no matrix-only descriptive hints
// leaked into the seed).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CANONICAL_BLOCK_CAPABILITIES } from '../../src/block-catalog/index.ts';
import { ALL_CANDIDATE_ENTRIES } from '../../src/block-catalog/categories/index.ts';

const CANONICAL_SET = new Set<string>(CANONICAL_BLOCK_CAPABILITIES);

test('capability-normalization: no entry carries raw action-trigger alias', () => {
  const offenders = ALL_CANDIDATE_ENTRIES.filter((e) =>
    (e.capabilities ?? []).includes('action-trigger' as never),
  );
  assert.deepEqual(
    offenders.map((e) => e.id),
    [],
    'action-trigger must be normalized to action-source',
  );
});

test('capability-normalization: all capabilities are canonical', () => {
  const offenders: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    for (const cap of entry.capabilities ?? []) {
      if (!CANONICAL_SET.has(cap)) {
        offenders.push(`${entry.id}: non-canonical capability '${cap}'`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'non-canonical capabilities leaked into seed');
});

test('capability-normalization: entries needing actions use action-source', () => {
  const actionEntries = ALL_CANDIDATE_ENTRIES.filter((e) =>
    (e.capabilities ?? []).includes('action-source'),
  );
  assert.ok(actionEntries.length > 0, 'expected at least one action-source entry');
  // spot-check a known action entry
  const form = ALL_CANDIDATE_ENTRIES.find((e) => e.id === 'interaction.form');
  assert.ok(form, 'interaction.form missing');
  assert.ok(
    (form!.capabilities ?? []).includes('action-source'),
    'interaction.form should carry action-source',
  );
});
