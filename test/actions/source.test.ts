import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ACTION_SOURCE_TYPES,
  isActionSourceType,
  isHandlerActionSource,
  isLocalActionSource,
  isModelActionSource,
  isUrlActionSource,
  validateActionSource,
} from '../../src/actions/index.ts';
import type { ActionSource } from '../../src/actions/index.ts';

test('ActionSource: local variant is valid', () => {
  const source: ActionSource = { type: 'local', effects: [] };
  const result = validateActionSource(source);
  assert.equal(result.valid, true);
  assert.equal(isLocalActionSource(source), true);
});

test('ActionSource: handler variant validates handlerKey', () => {
  const ok = validateActionSource({ type: 'handler', handlerKey: 'submit-form' });
  assert.equal(ok.valid, true);

  const bad = validateActionSource({ type: 'handler', handlerKey: '' });
  assert.equal(bad.valid, false);
  assert.match(bad.diagnostics[0].message, /handlerKey/);
});

test('ActionSource: url variant validates url + method', () => {
  const ok = validateActionSource({ type: 'url', method: 'POST', url: 'https://api.test/x' });
  assert.equal(ok.valid, true);

  const noUrl = validateActionSource({ type: 'url', method: 'POST', url: '' });
  assert.equal(noUrl.valid, false);
  assert.match(noUrl.diagnostics[0].message, /url/);

  const badMethod = validateActionSource({ type: 'url', method: 'GET', url: 'https://x' });
  assert.equal(badMethod.valid, false);
  assert.match(badMethod.diagnostics[0].message, /method/);
});

test('ActionSource: model variant validates model + operation', () => {
  const ok = validateActionSource({ type: 'model', model: 'crm.contact', operation: 'create' });
  assert.equal(ok.valid, true);

  const noModel = validateActionSource({ type: 'model', model: '', operation: 'create' });
  assert.equal(noModel.valid, false);

  const badOp = validateActionSource({ type: 'model', model: 'x', operation: 'frobnicate' });
  assert.equal(badOp.valid, false);
  assert.match(badOp.diagnostics[0].message, /operation/);

  const customNoName = validateActionSource({ type: 'model', model: 'x', operation: 'custom' });
  assert.equal(customNoName.valid, false);
  assert.match(customNoName.diagnostics[0].message, /customOperation/);
});

test('ActionSource: unknown type rejected', () => {
  const bad = validateActionSource({ type: 'teleport', effects: [] });
  assert.equal(bad.valid, false);
  assert.equal(bad.diagnostics[0].code, 'ACTION_SOURCE_INVALID');
});

test('ActionSource: non-object rejected', () => {
  assert.equal(validateActionSource(null).valid, false);
  assert.equal(validateActionSource('local').valid, false);
  assert.equal(validateActionSource(42).valid, false);
});

test('ActionSource: type guards discriminate correctly', () => {
  const local: ActionSource = { type: 'local', effects: [] };
  const handler: ActionSource = { type: 'handler', handlerKey: 'x' };
  const url: ActionSource = { type: 'url', method: 'POST', url: 'u' };
  const model: ActionSource = { type: 'model', model: 'm', operation: 'create' };

  assert.equal(isLocalActionSource(local), true);
  assert.equal(isHandlerActionSource(handler), true);
  assert.equal(isUrlActionSource(url), true);
  assert.equal(isModelActionSource(model), true);

  assert.equal(isLocalActionSource(handler), false);
  assert.equal(isUrlActionSource(model), false);
});

test('ACTION_SOURCE_TYPES: contains all four variants', () => {
  assert.equal(ACTION_SOURCE_TYPES.size, 4);
  assert.equal(isActionSourceType('local'), true);
  assert.equal(isActionSourceType('handler'), true);
  assert.equal(isActionSourceType('url'), true);
  assert.equal(isActionSourceType('model'), true);
  assert.equal(isActionSourceType('teleport'), false);
});
