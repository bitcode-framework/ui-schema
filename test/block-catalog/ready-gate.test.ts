// ============================================================================
// @bitcode/ui-schema — Ready Gate regression test (ADR-017 §4)
//
// Future-proof contract: "Every Ready catalog entry must pass strict shape
// validation (zero error diagnostics)." Today there are zero Ready fixtures,
// so the contract holds vacuously. The moment a Ready entry is introduced,
// the test enforces that it carries every Ready-required field.
//
// This test deliberately does NOT assert "Ready count == 0 forever". When a
// real Ready promotion lands (after P4 cross-package gates exist), the test
// must keep passing — that is the regression value.
//
// Scope guard: the P1 shape validator explicitly emits
// BLOCK_READY_GATE_INCOMPLETE for any Ready entry, reminding that shape alone
// never confers Ready status. Cross-package gates (web/Flutter source+export,
// demos, RuntimeContext, a11y, full test gate) are enforced by the P4 catalog
// validator. This test exercises only the shape subset that exists today.
// ============================================================================

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  BLOCK_DIAGNOSTIC_CODES,
  candidateFixtures,
  validateBlockCatalogEntry,
} from '../../src/block-catalog/index.ts';
import type { BlockCatalogEntry } from '../../src/block-catalog/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal base entry that satisfies every Ready-required field except those a
 * given test wants to omit. Fields are populated so that the ONLY failing
 * diagnostic is the one under test, making assertions precise.
 */
function readyBaseEntry(overrides: Partial<BlockCatalogEntry> = {}): BlockCatalogEntry {
  const base: BlockCatalogEntry = {
    id: 'test.ready',
    version: '0.1.0',
    schemaVersion: '0.1.0',
    labelKey: 'block.test.ready.title',
    fallbackLabel: 'Test Ready',
    category: 'content',
    subcategory: 'test',
    channels: ['website'],
    capabilities: ['static'],
    renderStrategy: 'schema',
    schemaPreset: { type: 'section', title: 'Test', sections: [] },
    requiredComponents: [{ key: 'BcSection', platforms: ['web', 'flutter'] }],
    requiredFunctions: [],
    requiredAdapters: [],
    adaptivePolicy: { breakpoints: ['md'], platformMorph: ['material', 'cupertino'] },
    securityPolicy: { richTextSanitize: 'n/a' },
    cachePolicy: { strategy: 'none' },
    offlinePolicy: { support: 'unsupported' },
    migration: { toVersion: '0.1.0' },
    readiness: 'ready',
    a11yEvidence: { contract: 'semantic landmark + heading order', testReference: 'test/...' },
    tests: { schema: 'test/...', web: 'test/...', flutter: 'test/...' },
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Contract 1: every Ready entry passes strict shape validation
// ---------------------------------------------------------------------------

test('Ready gate: every Ready fixture passes strict shape validation', () => {
  const readyEntries = candidateFixtures.filter((e) => e.readiness === 'ready');
  // Vacuously true today: no Candidate fixture is Ready. Documented for clarity.
  for (const entry of readyEntries) {
    const result = validateBlockCatalogEntry(entry);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    assert.equal(
      errors.length,
      0,
      `Ready entry '${entry.id}' has shape errors: ${JSON.stringify(errors)}`,
    );
  }
});

test('Ready gate: a complete Ready entry shape-validates (only the P4 reminder is info)', () => {
  const entry = readyBaseEntry();
  const result = validateBlockCatalogEntry(entry);
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  assert.equal(errors.length, 0, `Complete Ready entry should have 0 errors: ${JSON.stringify(errors)}`);
  // The shape validator MUST remind that shape alone is not Ready.
  const reminder = result.diagnostics.find(
    (d) => d.code === BLOCK_DIAGNOSTIC_CODES.READY_GATE_INCOMPLETE,
  );
  assert.ok(reminder, 'Shape validator must emit BLOCK_READY_GATE_INCOMPLETE for Ready entries');
  assert.equal(reminder!.severity, 'info');
});

// ---------------------------------------------------------------------------
// Contract 2: shape validator rejects Ready entries missing required fields
// ---------------------------------------------------------------------------

test('Ready gate: missing requiredComponents is rejected', () => {
  const entry = readyBaseEntry({ requiredComponents: undefined });
  const result = validateBlockCatalogEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some(
      (d) =>
        d.code === BLOCK_DIAGNOSTIC_CODES.READY_REQUIRED_FIELD_MISSING &&
        d.fieldPath === 'requiredComponents',
    ),
    'Expected READY_REQUIRED_FIELD_MISSING for requiredComponents',
  );
});

test('Ready gate: missing a11yEvidence is rejected', () => {
  const entry = readyBaseEntry({ a11yEvidence: undefined });
  const result = validateBlockCatalogEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some(
      (d) =>
        d.code === BLOCK_DIAGNOSTIC_CODES.READY_REQUIRED_FIELD_MISSING &&
        d.fieldPath === 'a11yEvidence',
    ),
    'Expected READY_REQUIRED_FIELD_MISSING for a11yEvidence',
  );
});

test('Ready gate: missing tests reference is rejected', () => {
  const entry = readyBaseEntry({ tests: undefined });
  const result = validateBlockCatalogEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some(
      (d) =>
        d.code === BLOCK_DIAGNOSTIC_CODES.READY_REQUIRED_FIELD_MISSING &&
        d.fieldPath === 'tests',
    ),
    'Expected READY_REQUIRED_FIELD_MISSING for tests',
  );
});

test('Ready gate: schema-strategy entry without schemaPreset is rejected', () => {
  const entry = readyBaseEntry({ schemaPreset: undefined });
  const result = validateBlockCatalogEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === BLOCK_DIAGNOSTIC_CODES.SCHEMA_PRESET_MISSING),
    'Expected SCHEMA_PRESET_MISSING for schema-strategy Ready entry',
  );
});

test('Ready gate: component-strategy entry without componentKey is rejected', () => {
  const entry = readyBaseEntry({
    renderStrategy: 'component',
    schemaPreset: undefined,
    componentKey: undefined,
  });
  const result = validateBlockCatalogEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === BLOCK_DIAGNOSTIC_CODES.COMPONENT_KEY_MISSING),
    'Expected COMPONENT_KEY_MISSING for component-strategy Ready entry',
  );
});

// ---------------------------------------------------------------------------
// Contract 3: Candidate entries are NOT treated as Ready (lenient validation)
// ---------------------------------------------------------------------------

test('Ready gate: Candidate fixtures do not claim Ready status', () => {
  for (const entry of candidateFixtures) {
    assert.notEqual(
      entry.readiness,
      'ready',
      `Fixture '${entry.id}' unexpectedly claims readiness 'ready' — no premature promotion allowed`,
    );
  }
});
