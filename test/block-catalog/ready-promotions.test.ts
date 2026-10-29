// Ready promotions test — the first Ready catalog entries pass every gate:
// shape validation, deep validation (0 errors), policy validation (0 errors),
// and component-registry probe on BOTH web and Flutter.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  READY_CATALOG_ENTRIES,
  READY_COUNT,
  getReadyEntryById,
  validateBlockCatalogEntry,
  validateBlockCatalogEntryDeep,
  validateBlockCatalogPolicies,
} from '../../src/block-catalog/index.ts';
import { PLATFORM_AUDIT } from '../../src/block-catalog/platform-audit.ts';
import type { ComponentRegistryProbe } from '../../src/block-catalog/index.ts';

/**
 * Registry probe backed by the static PLATFORM_AUDIT snapshot. This is the
 * same evidence source the pilot analysis uses; the P4 live scanner remains
 * authoritative but this probe gives deterministic test-time coverage.
 */
const auditProbe: ComponentRegistryProbe = {
  has(key: string, platform?: 'web' | 'flutter'): boolean {
    const entry = PLATFORM_AUDIT[key];
    if (!entry) return false;
    if (platform === 'web') return entry.web;
    if (platform === 'flutter') return entry.flutter;
    return entry.web && entry.flutter;
  },
};

test('ready-promotions: READY_CATALOG_ENTRIES is non-empty', () => {
  assert.ok(READY_CATALOG_ENTRIES.length > 0, 'expected at least one Ready entry');
  assert.equal(READY_COUNT, READY_CATALOG_ENTRIES.length);
});

test('ready-promotions: every entry has readiness === "ready"', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    assert.equal(
      entry.readiness,
      'ready',
      `${entry.id} is not readiness 'ready'`,
    );
  }
});

test('ready-promotions: expected Ready ids are present', () => {
  const ids = READY_CATALOG_ENTRIES.map((e) => e.id);
  assert.ok(ids.includes('content.plain-text'), 'content.plain-text should be Ready');
  assert.ok(ids.includes('content.faq'), 'content.faq should be Ready');
});

test('ready-promotions: getReadyEntryById resolves', () => {
  const entry = getReadyEntryById('content.plain-text');
  assert.ok(entry);
  assert.equal(entry!.readiness, 'ready');
  assert.equal(getReadyEntryById('nonexistent'), undefined);
});

test('ready-promotions: every entry passes P1 shape validation with 0 errors', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    const result = validateBlockCatalogEntry(entry);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    assert.equal(
      errors.length,
      0,
      `Ready entry '${entry.id}' has shape errors: ${JSON.stringify(errors)}`,
    );
  }
});

test('ready-promotions: every entry passes deep validation with 0 errors', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    const result = validateBlockCatalogEntryDeep(entry, {
      componentRegistry: auditProbe,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    assert.equal(
      errors.length,
      0,
      `Ready entry '${entry.id}' has deep-validation errors: ${JSON.stringify(errors)}`,
    );
  }
});

test('ready-promotions: every entry passes policy validation with 0 errors', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    const result = validateBlockCatalogPolicies(entry);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    assert.equal(
      errors.length,
      0,
      `Ready entry '${entry.id}' has policy errors: ${JSON.stringify(errors)}`,
    );
  }
});

test('ready-promotions: every requiredComponent is registered on BOTH platforms', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    for (const rc of entry.requiredComponents ?? []) {
      const key = typeof rc === 'string' ? rc : rc.key;
      const audit = PLATFORM_AUDIT[key];
      assert.ok(
        audit,
        `Component '${key}' required by '${entry.id}' is missing from PLATFORM_AUDIT`,
      );
      assert.ok(
        audit.web,
        `Component '${key}' required by '${entry.id}' is not confirmed on web`,
      );
      assert.ok(
        audit.flutter,
        `Component '${key}' required by '${entry.id}' is not confirmed on flutter`,
      );
    }
  }
});

test('ready-promotions: every entry declares all [Ready] required fields', () => {
  for (const entry of READY_CATALOG_ENTRIES) {
    assert.ok(entry.version, `${entry.id}: version`);
    assert.ok(entry.schemaVersion, `${entry.id}: schemaVersion`);
    assert.ok(entry.labelKey, `${entry.id}: labelKey`);
    assert.ok(entry.fallbackLabel, `${entry.id}: fallbackLabel`);
    assert.ok(Array.isArray(entry.channels) && entry.channels.length > 0, `${entry.id}: channels`);
    assert.ok(Array.isArray(entry.capabilities), `${entry.id}: capabilities`);
    assert.ok(entry.renderStrategy, `${entry.id}: renderStrategy`);
    assert.ok(Array.isArray(entry.requiredComponents) && entry.requiredComponents.length > 0, `${entry.id}: requiredComponents`);
    assert.ok(Array.isArray(entry.requiredFunctions), `${entry.id}: requiredFunctions`);
    assert.ok(Array.isArray(entry.requiredAdapters), `${entry.id}: requiredAdapters`);
    assert.ok(entry.adaptivePolicy, `${entry.id}: adaptivePolicy`);
    assert.ok(entry.securityPolicy, `${entry.id}: securityPolicy`);
    assert.ok(entry.cachePolicy, `${entry.id}: cachePolicy`);
    assert.ok(entry.offlinePolicy, `${entry.id}: offlinePolicy`);
    assert.ok(entry.migration, `${entry.id}: migration`);
    assert.ok(entry.a11yEvidence, `${entry.id}: a11yEvidence`);
    assert.ok(entry.tests, `${entry.id}: tests`);
    // schema-strategy entries must have a schemaPreset
    if (entry.renderStrategy === 'schema') {
      assert.ok(entry.schemaPreset, `${entry.id}: schemaPreset for schema-strategy`);
    }
  }
});
