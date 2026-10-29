// Platform audit test — the static audit snapshot has provenance metadata
// and every requiredComponents key referenced by candidates has an audit entry.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PLATFORM_AUDIT,
  PLATFORM_AUDIT_META,
  componentPlatforms,
  getPlatformAuditEntry,
  isComponentOnBothPlatforms,
} from '../../src/block-catalog/index.ts';
import { ALL_CANDIDATE_ENTRIES } from '../../src/block-catalog/categories/index.ts';

test('platform-audit: provenance metadata present', () => {
  assert.ok(PLATFORM_AUDIT_META.auditedAt, 'auditedAt missing');
  assert.ok(PLATFORM_AUDIT_META.auditMethod, 'auditMethod missing');
  assert.ok(
    PLATFORM_AUDIT_META.evidencePaths.length >= 2,
    'evidencePaths must list web + flutter barrels',
  );
  assert.ok(
    PLATFORM_AUDIT_META.authoritativeReadyGate.length > 0,
    'authoritativeReadyGate reminder missing',
  );
});

test('platform-audit: snapshot is non-empty', () => {
  assert.ok(Object.keys(PLATFORM_AUDIT).length > 50, 'audit should cover many keys');
});

test('platform-audit: every requiredComponents key has an audit entry', () => {
  const missing: string[] = [];
  for (const entry of ALL_CANDIDATE_ENTRIES) {
    for (const c of entry.requiredComponents ?? []) {
      const key = typeof c === 'string' ? c : c.key;
      if (!getPlatformAuditEntry(key)) {
        missing.push(`${entry.id} -> ${key}`);
      }
    }
  }
  assert.deepEqual(missing, [], 'requiredComponents keys missing from audit');
});

test('platform-audit: getPlatformAuditEntry returns null for unknown', () => {
  assert.equal(getPlatformAuditEntry('BcNonexistent'), null);
});

test('platform-audit: isComponentOnBothPlatforms true for known-both', () => {
  assert.equal(isComponentOnBothPlatforms('BcCard'), true);
  assert.equal(isComponentOnBothPlatforms('BcForm'), true);
});

test('platform-audit: web-only components flagged correctly', () => {
  // BcSection and BcTimeline are web-only per the 2026-07-01 audit.
  assert.equal(isComponentOnBothPlatforms('BcSection'), false);
  assert.equal(isComponentOnBothPlatforms('BcTimeline'), false);
  const sec = getPlatformAuditEntry('BcSection');
  assert.ok(sec, 'BcSection audit entry');
  assert.equal(sec!.web, true);
  assert.equal(sec!.flutter, false);
});

test('platform-audit: componentPlatforms returns array of platforms', () => {
  assert.deepEqual(componentPlatforms('BcCard'), ['web', 'flutter']);
  assert.deepEqual(componentPlatforms('BcSection'), ['web']);
  assert.deepEqual(componentPlatforms('BcUnknown'), []);
});
