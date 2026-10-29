import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { redactSensitiveFields } from '../../src/actions/index.ts';

test('redact: remove mode deletes top-level fields', () => {
  const payload = { name: 'alice', password: 'secret', token: 'abc' };
  const out = redactSensitiveFields(payload, { fields: ['password', 'token'], mode: 'remove' });
  assert.deepEqual(out, { name: 'alice' });
  // Original not mutated.
  assert.deepEqual(payload, { name: 'alice', password: 'secret', token: 'abc' });
});

test('redact: mask mode replaces with ***', () => {
  const payload = { name: 'alice', ssn: '123-45-6789' };
  const out = redactSensitiveFields(payload, { fields: ['ssn'], mode: 'mask' });
  assert.deepEqual(out, { name: 'alice', ssn: '***' });
});

test('redact: no config returns shallow clone unchanged', () => {
  const payload = { a: 1, b: 2 };
  const out = redactSensitiveFields(payload, undefined);
  assert.deepEqual(out, payload);
  assert.notEqual(out, payload); // clone, not same ref
});

test('redact: empty fields array returns clone unchanged', () => {
  const payload = { a: 1 };
  const out = redactSensitiveFields(payload, { fields: [], mode: 'remove' });
  assert.deepEqual(out, payload);
});

test('redact: non-object value returned unchanged', () => {
  assert.equal(redactSensitiveFields('hello', { fields: ['x'], mode: 'remove' }), 'hello');
  assert.equal(redactSensitiveFields(42, { fields: ['x'], mode: 'remove' }), 42);
  assert.equal(redactSensitiveFields(null, { fields: ['x'], mode: 'remove' }), null);
});

test('redact: array shallow-copied, elements not inspected (v1 limitation)', () => {
  const arr = [{ password: 'x' }];
  const out = redactSensitiveFields(arr, { fields: ['password'], mode: 'remove' });
  const outArr = out as unknown[];
  assert.ok(Array.isArray(outArr));
  assert.equal(outArr.length, 1);
  // v1 does not walk into array elements.
  assert.deepEqual(outArr[0], { password: 'x' });
});

test('redact: null/undefined values preserved', () => {
  const payload = { a: null, b: undefined, c: 'x' };
  const out = redactSensitiveFields(payload, { fields: ['c'], mode: 'remove' }) as Record<string, unknown>;
  assert.equal(out['a'], null);
  assert.equal(out['b'], undefined);
  assert.ok(!('c' in out));
});

test('redact: does not mutate original (remove mode)', () => {
  const payload = { secret: 's', public: 'p' };
  redactSensitiveFields(payload, { fields: ['secret'], mode: 'remove' });
  assert.equal(payload.secret, 's'); // unchanged
});

test('redact: does not mutate original (mask mode)', () => {
  const payload = { secret: 's' };
  redactSensitiveFields(payload, { fields: ['secret'], mode: 'mask' });
  assert.equal(payload.secret, 's'); // unchanged
});
