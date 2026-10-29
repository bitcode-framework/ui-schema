import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateAccessibilityPolicy, resolvePolicyConfig } from '../../src/block-catalog/policies/index.ts';
import { POLICY_DIAGNOSTIC_CODES } from '../../src/block-catalog/policies/index.ts';
import type { BlockCatalogEntry } from '../../src/block-catalog/types.ts';

const cfg = resolvePolicyConfig();

function baseEntry(overrides: Partial<BlockCatalogEntry> = {}): BlockCatalogEntry {
  return {
    id: 'test.entry',
    version: '1.0.0',
    schemaVersion: '0.1.0',
    labelKey: 'block.test.title',
    fallbackLabel: 'Test',
    category: 'content',
    channels: ['website'],
    capabilities: [],
    renderStrategy: 'schema',
    readiness: 'candidate',
    ...overrides,
  };
}

function hasCode(result: { diagnostics: { code: string }[] }, code: string): boolean {
  return result.diagnostics.some((d) => d.code === code);
}

// --- a11y evidence presence/shape ---

test('a11y: Ready entry without a11y evidence is flagged (error)', () => {
  const e = baseEntry({ readiness: 'ready' });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.A11Y_EVIDENCE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('a11y: Candidate entry without a11y evidence but a11y capability is flagged (warning)', () => {
  const e = baseEntry({ readiness: 'candidate', capabilities: ['a11y'] });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.A11Y_EVIDENCE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

test('a11y: entry with testReference passes evidence check', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['a11y'],
    a11yEvidence: { testReference: 'src/block.test.ts', wcagLevel: 'AA' },
  });
  const r = validateAccessibilityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.A11Y_EVIDENCE_MISSING));
});

test('a11y: empty-string evidence reference is treated as missing', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['a11y'],
    a11yEvidence: { contract: '   ', wcagLevel: 'AA' },
  });
  const r = validateAccessibilityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.A11Y_EVIDENCE_MISSING));
});

// --- Label presence ---

test('a11y: schemaPreset field without label or name is flagged', () => {
  const e = baseEntry({
    schemaPreset: {
      type: 'form',
      fields: [{ placeholder: 'no-label' }],
    } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find(
    (x) => x.code === POLICY_DIAGNOSTIC_CODES.LABEL_MISSING && x.fieldPath?.includes('fields[0]'),
  );
  assert.ok(d);
});

test('a11y: schemaPreset field with name passes label check', () => {
  const e = baseEntry({
    schemaPreset: {
      type: 'form',
      fields: [{ name: 'email', placeholder: 'Email' }],
    } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find(
    (x) => x.code === POLICY_DIAGNOSTIC_CODES.LABEL_MISSING && x.fieldPath?.includes('fields[0]'),
  );
  assert.ok(!d);
});

// --- WCAG level ---

test('a11y: Ready entry without AA/AAA wcagLevel is warned', () => {
  const e = baseEntry({
    readiness: 'ready',
    a11yEvidence: { contract: 'contract.md' },
  });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.WCAG_LEVEL_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

test('a11y: Ready entry with AA wcagLevel passes WCAG check', () => {
  const e = baseEntry({
    readiness: 'ready',
    a11yEvidence: { contract: 'contract.md', wcagLevel: 'AA' },
  });
  const r = validateAccessibilityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.WCAG_LEVEL_MISSING));
});

// --- Focus management ---

test('a11y: action-source entry without focus documentation is warned', () => {
  const e = baseEntry({ capabilities: ['action-source'] });
  const r = validateAccessibilityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.FOCUS_MANAGEMENT_EXPECTED);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

test('a11y: builder entry with focus note passes', () => {
  const e = baseEntry({
    capabilities: ['builder'],
    adaptivePolicy: { notes: 'Focus trap managed inside the dialog.' },
  });
  const r = validateAccessibilityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.FOCUS_MANAGEMENT_EXPECTED));
});
