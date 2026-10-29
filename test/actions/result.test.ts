import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  errorResult,
  isValidationError,
  normalizeActionResult,
  successResult,
  validationErrorResult,
} from '../../src/actions/index.ts';

test('normalizeActionResult: complete success result passes through', () => {
  const raw = { ok: true, status: 'success', data: { id: 1 } };
  const r = normalizeActionResult(raw);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'success');
  assert.deepEqual(r.data, { id: 1 });
});

test('normalizeActionResult: missing ok defaults to false + error', () => {
  const r = normalizeActionResult({ data: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 'error');
});

test('normalizeActionResult: non-object returns malformed error', () => {
  const r = normalizeActionResult(null);
  assert.equal(r.ok, false);
  assert.equal(r.status, 'error');
  assert.equal(r.errorList![0].code, 'ACTION_RESULT_MALFORMED');
});

test('normalizeActionResult: missing status inferred from ok', () => {
  assert.equal(normalizeActionResult({ ok: true }).status, 'success');
  assert.equal(normalizeActionResult({ ok: false }).status, 'error');
});

test('normalizeActionResult: validation errors infer validation-error status', () => {
  const r = normalizeActionResult({ ok: false, errors: { email: 'invalid' } });
  assert.equal(r.status, 'validation-error');
  assert.ok(r.errorList && r.errorList.length > 0);
  assert.equal(r.errorList![0].field, 'email');
});

test('normalizeActionResult: errorList array of multiple messages', () => {
  const r = normalizeActionResult({ ok: false, errors: { tags: ['too short', 'banned'] } });
  assert.equal(r.errorList!.length, 2);
  assert.equal(r.errorList![0].message, 'too short');
  assert.equal(r.errorList![1].message, 'banned');
});

test('normalizeActionResult: preserves effects + meta arrays', () => {
  const r = normalizeActionResult({
    ok: true,
    effects: [{ type: 'toast', level: 'success', fallbackMessage: 'done' }],
    meta: { duration: 42 },
  });
  assert.ok(r.effects);
  assert.equal(r.effects![0].type, 'toast');
  assert.deepEqual(r.meta, { duration: 42 });
});

test('successResult: builds minimal success', () => {
  const r = successResult({ id: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.status, 'success');
  assert.deepEqual(r.data, { id: 5 });
});

test('errorResult: builds single-error result', () => {
  const r = errorResult('CUSTOM_CODE', 'something broke', { recoverable: true });
  assert.equal(r.ok, false);
  assert.equal(r.errorList![0].code, 'CUSTOM_CODE');
  assert.equal(r.errorList![0].recoverable, true);
});

test('validationErrorResult: builds field-error result', () => {
  const r = validationErrorResult({ name: 'required', email: 'bad format' });
  assert.equal(r.status, 'validation-error');
  assert.equal(isValidationError(r), true);
});

test('isValidationError: returns false for ok results', () => {
  assert.equal(isValidationError(successResult()), false);
});

test('isValidationError: detects errorList with field', () => {
  const r = {
    ok: false,
    status: 'error' as const,
    errorList: [{ code: 'X', message: 'm', field: 'phone' }],
  };
  assert.equal(isValidationError(r), true);
});
