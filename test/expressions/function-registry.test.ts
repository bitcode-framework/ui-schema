import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BUILTIN_FUNCTION_MANIFEST,
  BUILTIN_FUNCTION_NAMES,
  isBuiltinFunction,
} from '../../src/expressions/index.ts';

test('BUILTIN_FUNCTION_MANIFEST: every entry is pure', () => {
  for (const e of BUILTIN_FUNCTION_MANIFEST) {
    assert.equal(e.pure, true, `${e.name} must be pure`);
  }
});

test('BUILTIN_FUNCTION_MANIFEST: every entry supports web + flutter', () => {
  for (const e of BUILTIN_FUNCTION_MANIFEST) {
    assert.ok(e.platforms.includes('web'), `${e.name} must support web`);
    assert.ok(e.platforms.includes('flutter'), `${e.name} must support flutter`);
  }
});

test('BUILTIN_FUNCTION_MANIFEST: only date.now is non-deterministic', () => {
  const nonDet = BUILTIN_FUNCTION_MANIFEST.filter((e) => !e.deterministic).map((e) => e.name);
  assert.deepEqual(nonDet, ['date.now']);
});

test('BUILTIN_FUNCTION_MANIFEST: date.* declare timezone behavior', () => {
  // date.* functions taking a wall-clock / ambiguous input must declare TZ.
  // date.isLeapYear / date.daysInMonth take numeric year/month (TZ N/A).
  // date.fromISO takes an absolute ISO-8601 string (always UTC, TZ N/A).
  const TZ_EXEMPT = new Set(['date.isLeapYear', 'date.daysInMonth', 'date.fromISO']);
  const dateTz = BUILTIN_FUNCTION_MANIFEST.filter(
    (e) => e.name.startsWith('date.') && !TZ_EXEMPT.has(e.name),
  );
  for (const d of dateTz) {
    assert.ok(d.timezone !== undefined, `${d.name} must declare timezone`);
  }
});

test('BUILTIN_FUNCTION_MANIFEST: format.* declare locale behavior', () => {
  const fmts = BUILTIN_FUNCTION_MANIFEST.filter((e) => e.name.startsWith('format.'));
  for (const f of fmts) {
    assert.ok(f.locale !== undefined, `${f.name} must declare locale`);
  }
});

test('BUILTIN_FUNCTION_NAMES + isBuiltinFunction: lookup parity', () => {
  assert.equal(isBuiltinFunction('math.abs'), true);
  assert.equal(isBuiltinFunction('math.nonexistent'), false);
  assert.equal(BUILTIN_FUNCTION_NAMES.has('string.concat'), true);
  assert.equal(BUILTIN_FUNCTION_NAMES.has('eval'), false, 'eval-like names are not built-ins');
});

test('BUILTIN_FUNCTION_MANIFEST: no dangerous names registered', () => {
  for (const e of BUILTIN_FUNCTION_MANIFEST) {
    assert.ok(!/eval|constructor|prototype|__proto__/.test(e.name), `${e.name} is unsafe`);
  }
});

test('BUILTIN_FUNCTION_MANIFEST: names are unique', () => {
  const names = BUILTIN_FUNCTION_MANIFEST.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, 'duplicate function names');
});
