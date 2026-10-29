import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateSecurityPolicy } from '../../src/block-catalog/policies/index.ts';
import { resolvePolicyConfig } from '../../src/block-catalog/policies/index.ts';
import type { BlockCatalogEntry } from '../../src/block-catalog/types.ts';
import { POLICY_DIAGNOSTIC_CODES } from '../../src/block-catalog/policies/index.ts';

const cfg = resolvePolicyConfig();

/**
 * Build a capabilities array. The policy layer reasons about capability
 * tokens as open-ended strings (so hosts can add descriptive hints); the
 * strict `BlockCapability` union is only the canonical core. Tests use this
 * helper to exercise non-canonical tokens like 'url'/'provider-adapter' that
 * the policy logic keys off but that aren't in the canonical union.
 */
function caps(...tokens: string[]): BlockCatalogEntry['capabilities'] {
  return tokens as unknown as BlockCatalogEntry['capabilities'];
}

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

function hasCode(result: { diagnostics: { code: string; severity: string }[] }, code: string): boolean {
  return result.diagnostics.some((d) => d.code === code);
}

// --- Secret detection (anchored patterns) ---

test('security: bearer token in schemaPreset description is flagged', () => {
  const e = baseEntry({
    schemaPreset: {
      type: 'section',
      title: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadsignature',
      sections: [],
    } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.SECRET_FOUND), 'expected SECRET_FOUND');
});

test('security: PEM private key in migration notes is flagged', () => {
  const e = baseEntry({
    migration: { toVersion: '1.0.0', migrationNotes: '-----BEGIN RSA PRIVATE KEY----- stuff' },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.SECRET_FOUND));
});

test('security: assigned api_key is flagged', () => {
  const e = baseEntry({
    securityPolicy: { notes: 'api_key = test-fixture-value-not-a-real-key' },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.SECRET_FOUND));
});

// --- False-positive guards ---

test('security: "Password reset link" label is NOT flagged (false-positive guard)', () => {
  const e = baseEntry({ fallbackLabel: 'Password reset link' });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.SECRET_FOUND));
});

test('security: "block.security.login" labelKey is NOT flagged', () => {
  const e = baseEntry({ labelKey: 'block.security.login' });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.SECRET_FOUND));
});

test('security: "evaluate" substring in label is NOT flagged (anchored to call form)', () => {
  const e = baseEntry({ fallbackLabel: 'Re-evaluate your plan' });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_CALL_STRING));
});

// --- Unsafe call strings ---

test('security: eval( in schemaPreset payload is flagged', () => {
  const e = baseEntry({
    schemaPreset: {
      type: 'custom',
      name: 'x',
      payload: 'do eval(document.cookie)',
    } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_CALL_STRING));
});

test('security: Function( constructor form is flagged', () => {
  const e = baseEntry({ securityPolicy: { notes: 'call Function("return this")()' } });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_CALL_STRING));
});

// --- Unsafe URL schemes ---

test('security: javascript: URL in allowlist is flagged', () => {
  const e = baseEntry({
    capabilities: caps('url'),
    securityPolicy: { urlAllowlist: ['javascript:alert(1)'] },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_URL));
});

test('security: data: URL in allowlist is flagged', () => {
  const e = baseEntry({
    capabilities: caps('url'),
    securityPolicy: { urlAllowlist: ['data:text/html,<script>'] },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_URL));
});

test('security: http URL in allowlist flagged for Ready but not Candidate', () => {
  const ready = baseEntry({
    readiness: 'ready',
    capabilities: caps('url'),
    securityPolicy: { urlAllowlist: ['http://insecure.example.com'] },
  });
  assert.ok(hasCode(validateSecurityPolicy(ready, cfg), POLICY_DIAGNOSTIC_CODES.UNSAFE_URL));

  const candidate = baseEntry({
    readiness: 'candidate',
    capabilities: caps('url'),
    securityPolicy: { urlAllowlist: ['http://insecure.example.com'] },
  });
  assert.ok(!hasCode(validateSecurityPolicy(candidate, cfg), POLICY_DIAGNOSTIC_CODES.UNSAFE_URL));
});

// --- URL allowlist declaration requirement ---

test('security: url capability without allowlist declaration is flagged (warning for Candidate)', () => {
  const e = baseEntry({ capabilities: caps('url') });
  const r = validateSecurityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.URL_ALLOWLIST_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'warning');
});

test('security: url capability without allowlist declaration is error for Ready', () => {
  const e = baseEntry({ readiness: 'ready', capabilities: caps('url') });
  const r = validateSecurityPolicy(e, cfg);
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.URL_ALLOWLIST_MISSING);
  assert.ok(d);
  assert.equal(d!.severity, 'error');
});

test('security: url capability with allowlist declaration passes', () => {
  const e = baseEntry({
    capabilities: caps('url'),
    securityPolicy: { urlAllowlist: ['https://safe.example.com'] },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.URL_ALLOWLIST_MISSING));
});

// --- Sanitization ---

test('security: sanitize capability with richTextSanitize n/a is flagged', () => {
  const e = baseEntry({
    capabilities: ['sanitize'],
    securityPolicy: { richTextSanitize: 'n/a' },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.SANITIZE_OFF));
});

test('security: sanitize capability with richTextSanitize on passes', () => {
  const e = baseEntry({
    capabilities: ['sanitize'],
    securityPolicy: { richTextSanitize: 'on' },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.SANITIZE_OFF));
});

// --- Untrusted HTML ---

test('security: <script> tag in schemaPreset title is flagged', () => {
  const e = baseEntry({
    schemaPreset: {
      type: 'section',
      title: '<script>alert(1)</script>',
      sections: [],
    } as BlockCatalogEntry['schemaPreset'],
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.UNSAFE_HTML));
});

// --- Payment adapter ---

test('security: payment-adapter without paymentAdapterRequired is flagged', () => {
  const e = baseEntry({ capabilities: ['payment-adapter'] });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.PAYMENT_NO_ADAPTER));
});

test('security: payment-adapter with paymentAdapterRequired passes', () => {
  const e = baseEntry({
    capabilities: ['payment-adapter'],
    securityPolicy: { paymentAdapterRequired: true },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.PAYMENT_NO_ADAPTER));
});

// --- External links ---

test('security: content category with externalLinks=allow is warned', () => {
  const e = baseEntry({
    category: 'content',
    securityPolicy: { externalLinks: 'allow' },
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.EXTERNAL_LINK_OPEN));
  const d = r.diagnostics.find((x) => x.code === POLICY_DIAGNOSTIC_CODES.EXTERNAL_LINK_OPEN);
  assert.equal(d!.severity, 'warning');
});

// --- Runtime declaration consistency ---

test('security: reactive capability without requiredFunctions/Adapters is flagged', () => {
  const e = baseEntry({ capabilities: ['reactive'] });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(hasCode(r, POLICY_DIAGNOSTIC_CODES.EXPR_RUNTIME_NOT_DECLARED));
});

test('security: action-source with declared adapter passes', () => {
  const e = baseEntry({
    capabilities: ['action-source'],
    requiredAdapters: ['action'],
  });
  const r = validateSecurityPolicy(e, cfg);
  assert.ok(!hasCode(r, POLICY_DIAGNOSTIC_CODES.EXPR_RUNTIME_NOT_DECLARED));
});

// --- Valid entry: clean ---

test('security: clean minimal entry produces no security diagnostics', () => {
  const e = baseEntry();
  const r = validateSecurityPolicy(e, cfg);
  for (const d of r.diagnostics) {
    // Only non-security codes allowed (other policies aren't run here).
    assert.ok(!d.code.startsWith('BLOCK_POLICY_SECRET') && !d.code.includes('UNSAFE'), `unexpected: ${d.code}`);
  }
});
