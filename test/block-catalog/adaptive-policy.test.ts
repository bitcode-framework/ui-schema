import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateAdaptivePolicy, resolvePolicyConfig } from '../../src/block-catalog/policies/index.ts';
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

// --- Adaptive policy declared ---

test('adaptive: Ready entry without adaptivePolicy is flagged (error)', () => {
  const e = baseEntry({ readiness: 'ready' });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.ADAPTIVE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('adaptive: Candidate entry without adaptivePolicy is flagged (warning)', () => {
  const e = baseEntry({ readiness: 'candidate' });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.ADAPTIVE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

// --- Platform morph coverage ---

test('adaptive: mobile-targeting entry missing cupertino is flagged', () => {
  const e = baseEntry({
    capabilities: ['adapt'],
    adaptivePolicy: { platformMorph: ['material'] },
  });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.PLATFORM_MORPH_INCOMPLETE);
  assert.ok(d);
  assert.match(d!.message, /cupertino/);
});

test('adaptive: mobile-targeting entry with both families passes', () => {
  const e = baseEntry({
    capabilities: ['adapt'],
    adaptivePolicy: { platformMorph: ['cupertino', 'material'] },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.PLATFORM_MORPH_INCOMPLETE));
});

test('adaptive: platformMorph=inherit skips the morph check', () => {
  const e = baseEntry({
    capabilities: ['adapt'],
    adaptivePolicy: { platformMorph: 'inherit' },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.PLATFORM_MORPH_INCOMPLETE));
});

test('adaptive: portal channel triggers mobile-targeting morph requirement', () => {
  const e = baseEntry({
    channels: ['portal'],
    adaptivePolicy: { platformMorph: ['cupertino'] },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.PLATFORM_MORPH_INCOMPLETE));
});

// --- State coverage ---

test('adaptive: data-source entry missing state coverage is flagged', () => {
  const e = baseEntry({
    capabilities: ['data-source'],
    adaptivePolicy: { loadingState: true },
  });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.STATE_COVERAGE_MISSING);
  assert.ok(d);
  assert.match(d!.message, /emptyState/);
});

test('adaptive: data-source Ready entry missing state coverage is error', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['data-source'],
    adaptivePolicy: { loadingState: true },
  });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.STATE_COVERAGE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('adaptive: data-source entry with full state coverage passes', () => {
  const e = baseEntry({
    capabilities: ['data-source'],
    adaptivePolicy: {
      loadingState: true,
      emptyState: true,
      errorState: true,
      disabledState: true,
    },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.STATE_COVERAGE_MISSING));
});

// --- Breakpoints ---

test('adaptive: responsive capability without breakpoints is flagged', () => {
  const e = baseEntry({
    capabilities: ['responsive'],
    adaptivePolicy: { reducedMotion: true },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.BREAKPOINTS_MISSING));
});

test('adaptive: responsive capability with breakpoints=true passes', () => {
  const e = baseEntry({
    capabilities: ['responsive'],
    adaptivePolicy: { breakpoints: true, reducedMotion: true },
  });
  const r = validateAdaptivePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.BREAKPOINTS_MISSING));
});

// --- Reduced motion ---

test('adaptive: responsive entry without reducedMotion is warned', () => {
  const e = baseEntry({
    capabilities: ['responsive'],
    adaptivePolicy: { breakpoints: true },
  });
  const r = validateAdaptivePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.REDUCED_MOTION_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});
