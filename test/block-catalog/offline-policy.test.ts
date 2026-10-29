import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateOfflinePolicy, resolvePolicyConfig } from '../../src/block-catalog/policies/index.ts';
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

/** Build a fully-populated offline queue. */
function fullQueue() {
  return {
    durable: true,
    retryBackoff: 'exponential' as const,
    idempotencyKey: true,
    replayOnReconnect: true,
    conflictResolution: 'last-write-wins' as const,
    permissionRevalidation: true,
  };
}

// --- offlinePolicy declaration ---

test('offline: Ready entry without offlinePolicy is flagged (error)', () => {
  const e = baseEntry({ readiness: 'ready' });
  const r = validateOfflinePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.OFFLINE_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('offline: entry with unsupported offlinePolicy passes declaration check', () => {
  const e = baseEntry({ offlinePolicy: { support: 'unsupported' } });
  const r = validateOfflinePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.OFFLINE_MISSING));
});

// --- read-write + action-source => full queue ---

test('offline: read-write action block missing queue fields is flagged', () => {
  const e = baseEntry({
    capabilities: ['action-source'],
    offlinePolicy: { support: 'read-write', queue: { durable: true } },
  });
  const r = validateOfflinePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.OFFLINE_QUEUE_INCOMPLETE);
  assert.ok(d);
  // Should list the missing fields.
  assert.match(d!.message, /idempotencyKey/);
  assert.match(d!.message, /visibleFailureStates/);
});

test('offline: read-write action block missing queue fields is error for Ready', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['action-source'],
    offlinePolicy: { support: 'read-write', queue: fullQueue() },
  });
  // missing visibleFailureStates
  const r = validateOfflinePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.OFFLINE_QUEUE_INCOMPLETE);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('offline: read-write action block with full queue + visibleFailureStates passes', () => {
  const e = baseEntry({
    readiness: 'ready',
    capabilities: ['action-source'],
    offlinePolicy: { support: 'read-write', queue: fullQueue(), visibleFailureStates: true },
  });
  const r = validateOfflinePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.OFFLINE_QUEUE_INCOMPLETE));
});

test('offline: read-write action block with every field populated passes', () => {
  const e = baseEntry({
    capabilities: ['action-source'],
    offlinePolicy: {
      support: 'read-write',
      queue: fullQueue(),
      visibleFailureStates: true,
    },
  });
  const r = validateOfflinePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.OFFLINE_QUEUE_INCOMPLETE));
});

// --- read + action-source => mismatch ---

test('offline: read support + action-source is mismatch warning', () => {
  const e = baseEntry({
    capabilities: ['action-source'],
    offlinePolicy: { support: 'read' },
  });
  const r = validateOfflinePolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.OFFLINE_ACTION_MISMATCH);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

// --- data-source + offline cap incompatibility ---

test('offline: data-source + offline caps with unsupported support is flagged', () => {
  const e = baseEntry({
    capabilities: ['data-source', 'offline'],
    offlinePolicy: { support: 'unsupported' },
  });
  const r = validateOfflinePolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.OFFLINE_DATA_INCOMPATIBLE));
});

test('offline: data-source + offline caps with read support passes', () => {
  const e = baseEntry({
    capabilities: ['data-source', 'offline'],
    offlinePolicy: { support: 'read' },
  });
  const r = validateOfflinePolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.OFFLINE_DATA_INCOMPATIBLE));
});

// --- entry with offline cap but no action-source and read support: clean ---

test('offline: read-only offline data block with no action cap is clean', () => {
  const e = baseEntry({
    capabilities: ['data-source', 'offline'],
    offlinePolicy: { support: 'read', visibleFailureStates: true },
  });
  const r = validateOfflinePolicy(e, cfg);
  assert.equal(r.valid, true);
});
