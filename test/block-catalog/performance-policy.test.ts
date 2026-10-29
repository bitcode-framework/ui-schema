import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validatePerformancePolicy, resolvePolicyConfig } from '../../src/block-catalog/policies/index.ts';
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

/** Build a nested schemaPreset of the given depth. Always returns a concrete
 * UiSchema (never undefined) so it can be nested without narrowing. */
function nestedPreset(depth: number): NonNullable<BlockCatalogEntry['schemaPreset']> {
  if (depth <= 0) return { type: 'section', title: 'leaf', sections: [] };
  return {
    type: 'section',
    title: `level-${depth}`,
    sections: [nestedPreset(depth - 1)],
  };
}

// --- Nesting depth ---

test('perf: nesting exceeding default limit is flagged (warning for plain Candidate)', () => {
  const e = baseEntry({ schemaPreset: nestedPreset(cfg.maxNestingDepth + 2) });
  const r = validatePerformancePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.NESTING_EXCEEDED);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

test('perf: nesting exceeding limit is error when Ready + large-data', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['large-data'],
    schemaPreset: nestedPreset(cfg.maxNestingDepth + 2),
  });
  const r = validatePerformancePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.NESTING_EXCEEDED);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('perf: nesting under limit passes', () => {
  const e = baseEntry({ schemaPreset: nestedPreset(cfg.maxNestingDepth - 2) });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.NESTING_EXCEEDED));
});

// --- Dependency count ---

test('perf: dependency count exceeding limit is flagged', () => {
  const e = baseEntry({
    requiredComponents: Array.from({ length: cfg.maxDependencyCount + 5 }, (_, i) => `BcComp${i}`),
    requiredFunctions: ['f1', 'f2'],
    requiredAdapters: ['a1'],
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.DEPENDENCY_LIMIT_EXCEEDED));
});

// --- large-data perf declaration ---

test('perf: large-data without perf declaration is flagged', () => {
  const e = baseEntry({ capabilities: ['large-data'] });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.LARGE_DATA_NO_PERF));
});

test('perf: large-data with pagination note passes', () => {
  const e = baseEntry({
    capabilities: ['large-data'],
    cachePolicy: { strategy: 'memory', notes: 'Server-side pagination with debounce.' },
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.LARGE_DATA_NO_PERF));
});

test('perf: large-data with virtualization note passes', () => {
  const e = baseEntry({
    capabilities: ['large-data'],
    adaptivePolicy: { notes: 'Virtualized list with bounded scrolling.' },
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.LARGE_DATA_NO_PERF));
});

// --- Expression complexity ---

test('perf: deeply nested expression AST in payload is warned', () => {
  // Build a chain of `if` nodes deeper than maxExpressionDepth.
  let node: Record<string, unknown> = { kind: 'literal', value: 1 };
  for (let i = 0; i < cfg.maxExpressionDepth + 2; i++) {
    node = { kind: 'if', test: { kind: 'literal', value: true }, then: node, else: node };
  }
  const e = baseEntry({
    schemaPreset: { type: 'custom', name: 'x', payload: node } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.EXPRESSION_COMPLEXITY));
});

test('perf: shallow expression AST is not flagged', () => {
  const node = { kind: 'op', op: 'add', args: [{ kind: 'literal', value: 1 }, { kind: 'literal', value: 2 }] };
  const e = baseEntry({
    schemaPreset: { type: 'custom', name: 'x', payload: node } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.EXPRESSION_COMPLEXITY));
});

// --- debounce/abort for action-source + large-data ---

test('perf: action-source + large-data without debounce/abort note is warned', () => {
  const e = baseEntry({
    capabilities: ['action-source', 'large-data'],
    cachePolicy: { strategy: 'none', notes: 'regular submit' },
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.NO_DEBOUNCE_ABORT));
});

test('perf: action-source + large-data with debounce note passes', () => {
  const e = baseEntry({
    capabilities: ['action-source', 'large-data'],
    cachePolicy: { strategy: 'none', notes: 'Submit is debounced; abort on unmount.' },
  });
  const r = validatePerformancePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.NO_DEBOUNCE_ABORT));
});

// --- Config override ---

test('perf: config override lowers nesting threshold', () => {
  const e = baseEntry({ schemaPreset: nestedPreset(3) });
  const r = validatePerformancePolicy(e, resolvePolicyConfig({ maxNestingDepth: 2 }));
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.NESTING_EXCEEDED));
});
