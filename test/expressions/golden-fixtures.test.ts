import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateExpression } from '../../src/expressions/index.ts';
import type { GoldenFixture } from '../../src/expressions/index.ts';
import { BUILTIN_FUNCTION_NAMES } from '../../src/expressions/builtin-manifest.ts';
import type { FunctionRegistry } from '../../src/expressions/function-registry.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'expressions');

// Registry backed by the static built-in manifest names.
const registry: FunctionRegistry = {
  has: (n) => BUILTIN_FUNCTION_NAMES.has(n),
  get: () => undefined,
  resolve: () => undefined,
  register: () => {},
  entries: () => [],
  validateRequired: () => [],
};

function loadFixtures(): Array<{ file: string; fixture: GoldenFixture }> {
  const out: Array<{ file: string; fixture: GoldenFixture }> = [];
  for (const file of readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))) {
    const raw = readFileSync(join(FIXTURE_DIR, file), 'utf8');
    const fixture = JSON.parse(raw) as GoldenFixture;
    out.push({ file, fixture });
  }
  return out;
}

// Codes that the STATIC validator can detect (structural errors). Cases
// expecting these codes MUST fail static validation.
const STATICALLY_DETECTABLE = new Set([
  'EXPR_NODE_INVALID',
  'EXPR_LITERAL_INVALID',
  'EXPR_OP_ARITY',
  'EXPR_PATH_MALFORMED',
  'EXPR_CALL_UNKNOWN_FN',
  'EXPR_DEPTH_EXCEEDED',
]);

// Codes only the evaluator can detect (need a scope / runtime types).
const RUNTIME_ONLY = new Set([
  'EXPR_PATH_MISSING',
  'EXPR_PATH_UNAUTHORIZED',
  'EXPR_OP_TYPE',
  'EXPR_OP_DIV_ZERO',
  'EXPR_CALL_ARG_TYPE',
  'EXPR_CALL_FN_PLATFORM',
  'EXPR_STEP_BUDGET_EXCEEDED',
]);

test('golden fixtures: every file parses as a GoldenFixture', () => {
  const fixtures = loadFixtures();
  assert.ok(fixtures.length >= 9, `expected >=9 fixture files, got ${fixtures.length}`);
  for (const { file, fixture } of fixtures) {
    assert.ok(Array.isArray(fixture.cases), `${file}: cases must be an array`);
    assert.equal(typeof fixture.category, 'string', `${file}: category required`);
    assert.equal(typeof fixture.name, 'string', `${file}: name required`);
  }
});

test('golden fixtures: case ids are globally unique across all files', () => {
  const seen = new Map<string, string>();
  for (const { file, fixture } of loadFixtures()) {
    for (const c of fixture.cases) {
      assert.ok(c.id, `${file}: case missing id`);
      const prev = seen.get(c.id);
      assert.equal(prev, undefined, `duplicate case id '${c.id}' in ${file} (also in ${prev ?? '?'})`);
      seen.set(c.id, file);
    }
  }
});

test('golden fixtures: every expect has a valid kind', () => {
  for (const { file, fixture } of loadFixtures()) {
    for (const c of fixture.cases) {
      assert.ok(
        c.expect.kind === 'value' || c.expect.kind === 'error' || c.expect.kind === 'denied',
        `${file}:${c.id} invalid expect kind`,
      );
    }
  }
});

test('golden fixtures: error codes reference canonical ExpressionErrorCode values', () => {
  const canonical = new Set<string>([
    ...STATICALLY_DETECTABLE,
    ...RUNTIME_ONLY,
  ]);
  for (const { file, fixture } of loadFixtures()) {
    for (const c of fixture.cases) {
      if (c.expect.kind === 'error') {
        assert.ok(
          canonical.has(c.expect.code),
          `${file}:${c.id} references unknown error code '${c.expect.code}'`,
        );
      }
    }
  }
});

test('golden fixtures: structurally-detectable error cases fail static validation', () => {
  for (const { file, fixture } of loadFixtures()) {
    for (const c of fixture.cases) {
      if (c.expect.kind !== 'error') continue;
      if (!STATICALLY_DETECTABLE.has(c.expect.code)) continue;
      const r = validateExpression(c.expr, registry);
      assert.equal(
        r.valid,
        false,
        `${file}:${c.id} expected static validation to fail (code ${c.expect.code}) but it passed`,
      );
    }
  }
});

test('golden fixtures: value cases with no runtime dependency pass static validation', () => {
  // Value cases that do not rely on a path/function only available at runtime
  // must pass static validation. This catches broken fixtures early.
  for (const { file, fixture } of loadFixtures()) {
    for (const c of fixture.cases) {
      if (c.expect.kind !== 'value') continue;
      const r = validateExpression(c.expr, registry);
      assert.equal(
        r.valid,
        true,
        `${file}:${c.id} (value case) failed static validation: ${r.errors.map((e) => e.code).join(',')}`,
      );
    }
  }
});
