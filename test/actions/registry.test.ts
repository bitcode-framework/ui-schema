import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  InMemoryActionAdapterRegistry,
  InMemoryCustomActionRegistry,
  type ActionAdapter,
} from '../../src/actions/index.ts';

function urlAdapter(): ActionAdapter {
  return { kind: 'url', execute: async () => ({ ok: true, status: 'success' }) };
}
function handlerAdapter(): ActionAdapter {
  return { kind: 'handler', execute: async () => ({ ok: true, status: 'success' }) };
}
function modelAdapter(): ActionAdapter {
  return { kind: 'model', execute: async () => ({ ok: true, status: 'success' }) };
}

// ---------------------------------------------------------------------------
// ActionAdapterRegistry
// ---------------------------------------------------------------------------

test('ActionAdapterRegistry: register + resolve + has', () => {
  const reg = new InMemoryActionAdapterRegistry();
  reg.register('url', urlAdapter());
  assert.equal(reg.has('url'), true);
  assert.equal(reg.has('model'), false);
  assert.ok(reg.resolve('url'));
  assert.equal(reg.resolve('model'), undefined);
});

test('ActionAdapterRegistry: keys() lists all registered', () => {
  const reg = new InMemoryActionAdapterRegistry();
  reg.register('url', urlAdapter());
  reg.register('model', modelAdapter());
  const keys = reg.keys();
  assert.equal(keys.length, 2);
  assert.ok(keys.includes('url'));
  assert.ok(keys.includes('model'));
});

test('ActionAdapterRegistry: duplicate registration throws', () => {
  const reg = new InMemoryActionAdapterRegistry();
  reg.register('url', urlAdapter());
  assert.throws(() => reg.register('url', urlAdapter()), /already registered/);
});

test('ActionAdapterRegistry: unregister removes adapter', () => {
  const reg = new InMemoryActionAdapterRegistry();
  reg.register('url', urlAdapter());
  assert.equal(reg.unregister('url'), true);
  assert.equal(reg.has('url'), false);
  assert.equal(reg.unregister('url'), false); // already removed
});

// ---------------------------------------------------------------------------
// CustomActionRegistry
// ---------------------------------------------------------------------------

test('CustomActionRegistry: register + resolve handler', () => {
  const reg = new InMemoryCustomActionRegistry();
  reg.register('submit-form', handlerAdapter());
  assert.equal(reg.has('submit-form'), true);
  assert.ok(reg.resolve('submit-form'));
  assert.equal(reg.resolve('unknown'), undefined);
});

test('CustomActionRegistry: duplicate handler throws', () => {
  const reg = new InMemoryCustomActionRegistry();
  reg.register('x', handlerAdapter());
  assert.throws(() => reg.register('x', handlerAdapter()), /already registered/);
});

test('CustomActionRegistry: rejects non-handler kind adapter', () => {
  const reg = new InMemoryCustomActionRegistry();
  assert.throws(() => reg.register('x', urlAdapter()), /kind 'handler'/);
});

test('CustomActionRegistry: keys() lists all handlers', () => {
  const reg = new InMemoryCustomActionRegistry();
  reg.register('a', handlerAdapter());
  reg.register('b', handlerAdapter());
  assert.equal(reg.keys().length, 2);
});

test('CustomActionRegistry: unregister removes handler', () => {
  const reg = new InMemoryCustomActionRegistry();
  reg.register('x', handlerAdapter());
  assert.equal(reg.unregister('x'), true);
  assert.equal(reg.has('x'), false);
});

test('CustomActionRegistry: allowlist security — unregistered key cannot execute', () => {
  const reg = new InMemoryCustomActionRegistry();
  reg.register('allowed', handlerAdapter());
  // 'denied' was never registered — runner will reject it at preflight.
  assert.equal(reg.has('denied'), false);
  assert.equal(reg.resolve('denied'), undefined);
});
