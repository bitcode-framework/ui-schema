import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  checkUrlPolicy,
  InMemoryActionAdapterRegistry,
  InMemoryCustomActionRegistry,
  validateActionSource,
  validateRuntimeContext,
  type ActionRuntimeContext,
  type EffectSink,
} from '../../src/actions/index.ts';
import type { ActionAdapter } from '../../src/actions/index.ts';

function noopSink(): EffectSink {
  return {
    setValue() {}, setMeta() {}, setError() {}, refreshDataSource() {},
    invalidateKey() {}, closeOverlay() {}, resetForm() {}, emit() {},
  };
}

function makeCtx(overrides: Partial<ActionRuntimeContext> = {}): ActionRuntimeContext {
  return {
    values: {}, meta: {}, data: {},
    scope: { values: {}, meta: {}, data: {}, services: {}, permissions: {} },
    adapters: {},
    effectSink: noopSink(),
    ...overrides,
  };
}

test('validateActionSource: local with effects array is valid', () => {
  const r = validateActionSource({ type: 'local', effects: [{ type: 'emit', event: 'x' }] });
  assert.equal(r.valid, true);
});

test('validateActionSource: local without effects array is invalid', () => {
  const r = validateActionSource({ type: 'local' });
  assert.equal(r.valid, false);
  assert.match(r.diagnostics[0].message, /effects/);
});

test('validateActionSource: url requires non-empty url + valid method', () => {
  assert.equal(validateActionSource({ type: 'url', method: 'POST', url: 'https://x' }).valid, true);
  assert.equal(validateActionSource({ type: 'url', method: 'POST', url: '' }).valid, false);
  assert.equal(validateActionSource({ type: 'url', method: 'GET', url: 'https://x' }).valid, false);
});

test('validateActionSource: model custom requires customOperation', () => {
  assert.equal(validateActionSource({ type: 'model', model: 'm', operation: 'create' }).valid, true);
  const r = validateActionSource({ type: 'model', model: 'm', operation: 'custom' });
  assert.equal(r.valid, false);
  assert.match(r.diagnostics[0].message, /customOperation/);
  assert.equal(
    validateActionSource({ type: 'model', model: 'm', operation: 'custom', customOperation: 'archive' }).valid,
    true,
  );
});

test('validateRuntimeContext: missing effectSink produces diagnostic', () => {
  const ctx = { ...makeCtx(), effectSink: undefined as unknown as EffectSink };
  const diags = validateRuntimeContext(
    { type: 'local', effects: [] },
    ctx,
    new InMemoryActionAdapterRegistry(),
    new InMemoryCustomActionRegistry(),
  );
  assert.ok(diags.some((d) => d.message.includes('effectSink')));
});

test('validateRuntimeContext: url source without url adapter = ACTION_ADAPTER_MISSING', () => {
  const diags = validateRuntimeContext(
    { type: 'url', method: 'POST', url: 'https://x' },
    makeCtx(),
    new InMemoryActionAdapterRegistry(),
    new InMemoryCustomActionRegistry(),
  );
  assert.equal(diags[0].code, 'ACTION_ADAPTER_MISSING');
});

test('validateRuntimeContext: model source with registered adapter = no diags', () => {
  const registry = new InMemoryActionAdapterRegistry();
  const adapter: ActionAdapter = { kind: 'model', execute: async () => ({ ok: true, status: 'success' }) };
  registry.register('model', adapter);
  const diags = validateRuntimeContext(
    { type: 'model', model: 'm', operation: 'create' },
    makeCtx(),
    registry,
    new InMemoryCustomActionRegistry(),
  );
  assert.equal(diags.length, 0);
});

test('validateRuntimeContext: model source with named adapter resolves correctly', () => {
  const registry = new InMemoryActionAdapterRegistry();
  const adapter: ActionAdapter = { kind: 'model', execute: async () => ({ ok: true, status: 'success' }) };
  registry.register('myCustomModel', adapter);
  const diags = validateRuntimeContext(
    { type: 'model', model: 'm', operation: 'create', adapter: 'myCustomModel' },
    makeCtx(),
    registry,
    new InMemoryCustomActionRegistry(),
  );
  assert.equal(diags.length, 0);
});

test('validateRuntimeContext: handler with registered key = no diags', () => {
  const custom = new InMemoryCustomActionRegistry();
  const adapter: ActionAdapter = { kind: 'handler', execute: async () => ({ ok: true, status: 'success' }) };
  custom.register('doThing', adapter);
  const diags = validateRuntimeContext(
    { type: 'handler', handlerKey: 'doThing' },
    makeCtx(),
    new InMemoryActionAdapterRegistry(),
    custom,
  );
  assert.equal(diags.length, 0);
});

test('checkUrlPolicy: no policy = no diagnostics (allowed by default)', () => {
  const diags = checkUrlPolicy({ type: 'url', method: 'POST', url: 'https://anywhere' }, undefined);
  assert.equal(diags.length, 0);
});

test('checkUrlPolicy: policy denies = ACTION_URL_NOT_ALLOWED', () => {
  const diags = checkUrlPolicy(
    { type: 'url', method: 'POST', url: 'https://evil' },
    { isAllowed: () => false },
  );
  assert.equal(diags[0].code, 'ACTION_URL_NOT_ALLOWED');
});

test('checkUrlPolicy: policy allows = no diagnostics', () => {
  const diags = checkUrlPolicy(
    { type: 'url', method: 'POST', url: 'https://ok' },
    { isAllowed: () => true },
  );
  assert.equal(diags.length, 0);
});

test('validateRuntimeContext: ctx null = source invalid diagnostic', () => {
  const diags = validateRuntimeContext(
    { type: 'local', effects: [] },
    null as unknown as ActionRuntimeContext,
    new InMemoryActionAdapterRegistry(),
    new InMemoryCustomActionRegistry(),
  );
  assert.ok(diags.length > 0);
});
