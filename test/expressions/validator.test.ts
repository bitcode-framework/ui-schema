import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  deserializeExpression,
  roundTripExpression,
  serializeExpression,
  validateExpression,
  validatePath,
} from '../../src/expressions/index.ts';
import type {
  PortableExpression,
  PortableExpressionEnvelope,
} from '../../src/expressions/index.ts';
import type { FunctionRegistry } from '../../src/expressions/function-registry.ts';

// --- fixtures ----------------------------------------------------------------

const lit = (value: unknown): PortableExpression => ({ kind: 'literal', value: value as string | number | boolean | null });
const ref = (path: string): PortableExpression => ({ kind: 'path', path });
const op = (operator: string, ...args: PortableExpression[]): PortableExpression => ({ kind: 'op', op: operator as never, args });
const call = (fn: string, ...args: PortableExpression[]): PortableExpression => ({ kind: 'call', fn, args });
const ifExpr = (test: PortableExpression, then: PortableExpression, els: PortableExpression): PortableExpression => ({ kind: 'if', test, then, else: els });

// A tiny registry backed by the static built-in manifest names.
import { BUILTIN_FUNCTION_NAMES } from '../../src/expressions/builtin-manifest.ts';
const registry: FunctionRegistry = {
  has: (n) => BUILTIN_FUNCTION_NAMES.has(n),
  get: () => undefined,
  resolve: () => undefined,
  register: () => {},
  entries: () => [],
  validateRequired: () => [],
};

// ============================================================================
// validatePath
// ============================================================================

test('validatePath: accepts dotted + indexed paths', () => {
  assert.equal(validatePath('values.qty').ok, true);
  assert.equal(validatePath('data.items[0].price').ok, true);
  assert.equal(validatePath('values.items[$index].id').ok, true);
  assert.equal(validatePath('$parent.tipe').ok, true);
});

test('validatePath: rejects malformed paths', () => {
  assert.equal(validatePath('').ok, false);
  assert.equal(validatePath('values..qty').ok, false);
  assert.equal(validatePath('values.qty.').ok, false);
  assert.equal(validatePath('values[0').ok, false);
  assert.equal(validatePath('globals.window').ok, false, 'non-reserved root rejected');
  assert.equal(validatePath('values[-1]').ok, false, 'negative index rejected');
  assert.equal(validatePath('values.__proto__').ok, false, 'proto segment rejected');
});

// ============================================================================
// validateExpression: unknown kinds / unsafe constructs
// ============================================================================

test('validateExpression: rejects unknown node kind', () => {
  const r = validateExpression({ kind: 'unknown' } as unknown as PortableExpression);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === 'EXPR_NODE_INVALID'));
});

test('validateExpression: rejects non-object node', () => {
  const r = validateExpression(42 as unknown as PortableExpression);
  assert.equal(r.valid, false);
});

test('validateExpression: accepts valid AST', () => {
  const expr = ifExpr(op('eq', ref('values.qty'), lit(5)), lit('yes'), lit('no'));
  const r = validateExpression(expr);
  assert.equal(r.valid, true, r.errors.map((e) => e.message).join('; '));
});

test('validateExpression: rejects object literal', () => {
  const r = validateExpression(lit({ a: 1 }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === 'EXPR_LITERAL_INVALID'));
});

test('validateExpression: rejects array literal', () => {
  const r = validateExpression(lit([1, 2]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === 'EXPR_LITERAL_INVALID'));
});

test('validateExpression: rejects unknown operator', () => {
  const r = validateExpression(op('xor', lit(true), lit(false)));
  assert.equal(r.valid, false);
});

test('validateExpression: rejects operator arity mismatch', () => {
  assert.equal(validateExpression(op('not', lit(true), lit(false))).valid, false);
  assert.equal(validateExpression(op('add', lit(1))).valid, false);
  assert.equal(validateExpression(op('and')).valid, false);
});

test('validateExpression: rejects unknown function (with registry)', () => {
  const r = validateExpression(call('string.nonexistent'), registry);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === 'EXPR_CALL_UNKNOWN_FN'));
});

test('validateExpression: rejects unsafe member-access fn name', () => {
  const r = validateExpression(call('constructor', lit(1)));
  assert.equal(r.valid, false);
});

test('validateExpression: rejects eval-like fn name', () => {
  const r = validateExpression(call('eval', lit('x')));
  assert.equal(r.valid, false);
});

test('validateExpression: reports path-based nodePath on nested errors', () => {
  // call.args[0] is an unknown-kind node.
  const expr = call('math.abs', { kind: 'bogus' } as unknown as PortableExpression);
  const r = validateExpression(expr);
  assert.equal(r.valid, false);
  const err = r.errors.find((e) => e.code === 'EXPR_NODE_INVALID');
  assert.ok(err, 'expected NODE_INVALID error');
  assert.ok(err?.nodePath?.includes('args'), `nodePath should point at args, got ${err?.nodePath}`);
});

// ============================================================================
// Serialization round-trip
// ============================================================================

test('serializeExpression: produces versioned envelope', () => {
  const env = serializeExpression(lit(42));
  assert.equal(env.schemaVersion, 1);
  assert.deepEqual(env.expr, { kind: 'literal', value: 42 });
});

test('deserializeExpression: accepts bare node and envelope', () => {
  const bare = deserializeExpression(lit('hi'));
  assert.equal(bare.ok, true);
  const env = deserializeExpression(serializeExpression(lit('hi')));
  assert.equal(env.ok, true);
});

test('deserializeExpression: rejects unknown envelope version', () => {
  const bad: PortableExpressionEnvelope = { schemaVersion: 999 as never, expr: lit(1) };
  const r = deserializeExpression(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'EXPR_NODE_INVALID'));
});

test('deserializeExpression: rejects non-object', () => {
  const r = deserializeExpression('not-an-expr');
  assert.equal(r.ok, false);
});

test('roundTripExpression: stable for valid AST', () => {
  const expr = ifExpr(op('gt', ref('values.qty'), lit(0)), lit('pos'), lit('zero'));
  const out = roundTripExpression(expr);
  assert.deepEqual(out, expr);
});
