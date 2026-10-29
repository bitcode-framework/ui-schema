import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  isDeprecatedEntry,
  isReadyEntry,
  mergeResults,
  resolvePolicyConfig,
  validateBlockCatalogPolicies,
} from '../../src/block-catalog/policies/index.ts';
import type { BlockCatalogEntry } from '../../src/block-catalog/types.ts';

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

/**
 * Build a capabilities array. The policy layer treats capability tokens as
 * open-ended strings (hosts may add descriptive hints); the strict
 * `BlockCapability` union is only the canonical core. Tests use this helper
 * to exercise non-canonical tokens like 'url' that the policy keys off.
 */
function caps(...tokens: string[]): BlockCatalogEntry['capabilities'] {
  return tokens as unknown as BlockCatalogEntry['capabilities'];
}

// --- Orchestrator: runs all 5 policies ---

test('orchestrator: clean candidate entry produces a valid result', () => {
  const e = baseEntry();
  const r = validateBlockCatalogPolicies(e);
  assert.equal(r.valid, true);
  assert.equal(r.entryId, 'test.entry');
});

test('orchestrator: secret in entry makes result invalid', () => {
  const e = baseEntry({
    securityPolicy: { notes: 'Bearer eyJverylongtokenvalue1234567890' },
  });
  const r = validateBlockCatalogPolicies(e);
  assert.equal(r.valid, false);
  assert.ok(r.diagnostics.some((d) => d.code === 'BLOCK_POLICY_SECRET_FOUND'));
});

// --- Severity scaling: Ready vs Candidate ---

test('orchestrator: Ready entry without policies yields errors (gateSeverity scaling)', () => {
  const e = baseEntry({ readiness: 'ready' });
  const r = validateBlockCatalogPolicies(e);
  // A Ready entry with no adaptivePolicy / offlinePolicy / a11yEvidence
  // produces error diagnostics (gateSeverity => error for Ready).
  assert.equal(r.valid, false);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  assert.ok(errors.length > 0, 'expected at least one error for a bare Ready entry');
});

test('orchestrator: Candidate entry without policies yields warnings, stays valid', () => {
  const e = baseEntry({ readiness: 'candidate' });
  const r = validateBlockCatalogPolicies(e);
  assert.equal(r.valid, true);
  // No errors; only warnings/info.
  assert.ok(!r.diagnostics.some((d) => d.severity === 'error'));
});

// --- Deprecated entries are skipped ---

test('orchestrator: deprecated entry is skipped (valid, no diagnostics)', () => {
  const e = baseEntry({ readiness: 'deprecated' });
  const r = validateBlockCatalogPolicies(e);
  assert.equal(r.valid, true);
  assert.equal(r.diagnostics.length, 0);
});

// --- mergeResults ---

test('mergeResults: combines diagnostics and recomputes valid', () => {
  const a = {
    valid: false,
    diagnostics: [
      { code: 'A', severity: 'error' as const, message: 'a' },
    ],
  };
  const b = {
    valid: true,
    diagnostics: [
      { code: 'B', severity: 'warning' as const, message: 'b' },
    ],
  };
  const merged = mergeResults(a, b);
  assert.equal(merged.valid, false); // one error => invalid
  assert.equal(merged.diagnostics.length, 2);
});

test('mergeResults: two valid results stay valid', () => {
  const a = { valid: true, diagnostics: [{ code: 'A', severity: 'warning' as const, message: 'a' }] };
  const b = { valid: true, diagnostics: [] };
  const merged = mergeResults(a, b);
  assert.equal(merged.valid, true);
  assert.equal(merged.diagnostics.length, 1);
});

// --- Helper: isReadyEntry / isDeprecatedEntry ---

test('helpers: isReadyEntry reads readiness field defensively', () => {
  assert.equal(isReadyEntry(baseEntry({ readiness: 'ready' })), true);
  assert.equal(isReadyEntry(baseEntry({ readiness: 'candidate' })), false);
  assert.equal(isReadyEntry(baseEntry({ readiness: 'deprecated' })), false);
  assert.equal(isReadyEntry({} as BlockCatalogEntry), false);
});

test('helpers: isDeprecatedEntry detects terminal state', () => {
  assert.equal(isDeprecatedEntry(baseEntry({ readiness: 'deprecated' })), true);
  assert.equal(isDeprecatedEntry(baseEntry({ readiness: 'candidate' })), false);
});

// --- Determinism ---

test('orchestrator: identical input produces identical output (determinism)', () => {
  const e = baseEntry({
    capabilities: caps('url', 'large-data'),
    securityPolicy: { urlAllowlist: ['https://ok.example.com'] },
    cachePolicy: { strategy: 'none', notes: 'paginated' },
    offlinePolicy: { support: 'unsupported' },
  });
  const r1 = validateBlockCatalogPolicies(e);
  const r2 = validateBlockCatalogPolicies(e);
  assert.deepEqual(
    r1.diagnostics.map((d) => `${d.code}:${d.severity}`),
    r2.diagnostics.map((d) => `${d.code}:${d.severity}`),
  );
});

// --- Config override flows through ---

test('orchestrator: config override flows to policies', () => {
  const e = baseEntry({
    requiredComponents: Array.from({ length: 5 }, (_, i) => `BcComp${i}`),
  });
  // Default threshold 30 => no diagnostic. Override to 4 => diagnostic.
  const rDefault = validateBlockCatalogPolicies(e);
  assert.ok(!rDefault.diagnostics.some((d) => d.code === 'BLOCK_POLICY_DEPENDENCY_LIMIT_EXCEEDED'));
  const rOverride = validateBlockCatalogPolicies(e, { maxDependencyCount: 4 });
  assert.ok(rOverride.diagnostics.some((d) => d.code === 'BLOCK_POLICY_DEPENDENCY_LIMIT_EXCEEDED'));
});

// --- resolvePolicyConfig defaults ---

test('resolvePolicyConfig: returns defaults when called with no arg', () => {
  const c = resolvePolicyConfig();
  assert.equal(c.maxNestingDepth, 8);
  assert.equal(c.maxDependencyCount, 30);
  assert.equal(c.maxExpressionDepth, 12);
  assert.ok(c.knownSafeLabels.length > 0);
});

test('resolvePolicyConfig: partial override merges with defaults', () => {
  const c = resolvePolicyConfig({ maxNestingDepth: 4 });
  assert.equal(c.maxNestingDepth, 4);
  assert.equal(c.maxDependencyCount, 30); // default retained
});
