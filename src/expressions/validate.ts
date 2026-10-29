// ============================================================================
// @bitcode/ui-schema - Portable Expression Validator (ADR-018 S5)
//
// Static, side-effect-free validator for the Portable Expression AST. Runs
// WITHOUT evaluating the expression, so it is safe to use on untrusted
// catalog JSON before any scope is constructed. The TS evaluator and the
// Dart evaluator each ALSO validate at eval time; this module gives build-
// time / catalog-tooling a fast, pure pass.
//
// What it rejects (per task scope):
//   - Unknown node kinds                      -> EXPR_NODE_INVALID
//   - Unknown operators                       -> EXPR_OP_UNKNOWN
//   - Unknown functions (not in manifest)     -> EXPR_CALL_UNKNOWN_FN
//   - Unsafe / member-access / eval-like      -> EXPR_NODE_INVALID / EXPR_PATH_MALFORMED
//   - Malformed paths                         -> EXPR_PATH_MALFORMED
//   - Invalid literals (object/array)         -> EXPR_LITERAL_INVALID
//   - Operator arity violations               -> EXPR_OP_ARITY
//   - Nesting too deep (DoS)                  -> EXPR_DEPTH_EXCEEDED
//
// What it reports:
//   - Precise path-based errors (nodePath like "op.args[1].call.args[0]").
//
// What it does NOT do (runtime concerns, left to evaluator):
//   - Type-check operand types (needs values).
//   - Permission filtering (needs scope + permissions).
//   - Step-budget accounting (needs evaluation).
//
// Pure functions, no I/O. Safe in Node/SSR/Dart-port reference.
// ============================================================================

import type { PortableExpression, PortableExpressionEnvelope } from './ast.ts';
import { EXPRESSION_NODE_KINDS, PORTABLE_EXPRESSION_SCHEMA_VERSION } from './ast.ts';
import type { PortableOperator } from './operators.ts';
import { OPERATOR_ARITY, OPERATOR_NAMES } from './operators.ts';
import type { ExpressionError } from './errors.ts';
import { exprError, EXPR_MAX_DEPTH } from './errors.ts';
import type { FunctionRegistry } from './function-registry.ts';
import { EXPRESSION_SCOPE_ROOTS } from './scope.ts';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Static function-name denylist
// ---------------------------------------------------------------------------

/**
 * Function names that are ALWAYS rejected, regardless of registry. These are
 * eval-like / reflection / global-mutation primitives that must never be
 * invocable from a portable expression (ADR-018 S5 safety). The check is
 * static so untrusted catalog JSON cannot smuggle them past a missing
 * registry.
 */
const FORBIDDEN_FUNCTION_NAMES: ReadonlySet<string> = new Set([
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'require',
  'process',
  'globalThis',
  'window',
  'document',
  'fetch',
  'constructor',
  '__proto__',
  'prototype',
  'reflect',
]);

function isForbiddenFunctionName(name: string): boolean {
  const head = name.split('.')[0];
  return FORBIDDEN_FUNCTION_NAMES.has(head) || FORBIDDEN_FUNCTION_NAMES.has(name);
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Result of static validation. `valid === true` iff `errors` is empty.
 * `warnings` carries non-fatal notes (e.g. deprecated operators, suggested
 * canonical names) and never affects `valid`.
 */
export interface ExpressionValidationResult {
  valid: boolean;
  errors: ExpressionError[];
  warnings: ExpressionError[];
}

// ---------------------------------------------------------------------------
// Path grammar (mirrors scope.ts)
// ---------------------------------------------------------------------------

// segment := name | name '[' index ']'
// name    := [a-zA-Z_$][a-zA-Z0-9_$]*
// index   := [0-9]+ | '$index' | '$self' | '$parent' | '$root'
const NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const INDEX_RE = /^(?:[0-9]+|\$index|\$self|\$parent|\$root)$/;

/** Reserved path roots: canonical scope roots + nested-store sigils ($self/$parent/$root). */
const PATH_RESERVED_ROOTS: ReadonlySet<string> = new Set<string>([...EXPRESSION_SCOPE_ROOTS, '$self', '$parent', '$root']);

/** Forbidden segment names: block prototype-chain traversal and global access. */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validate a path string against the deterministic path grammar. Returns the
 * list of segments on success, or an error on failure. Does NOT touch scope.
 */
export function validatePath(path: string): { ok: true; segments: string[] } | { ok: false; error: ExpressionError } {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, error: exprError('EXPR_PATH_MALFORMED', 'Path is empty.', { path }) };
  }
  // Split on dots, then peel [index] suffixes off each segment.
  const rawSegments = path.split('.');
  const segments: string[] = [];
  for (const raw of rawSegments) {
    if (raw.length === 0) {
      return { ok: false, error: exprError('EXPR_PATH_MALFORMED', `Empty segment in path '${path}'.`, { path }) };
    }
    // Peel trailing [..] groups (allow multiple, e.g. a[0][1]).
    let rest = raw;
    const indices: string[] = [];
    while (rest.endsWith(']')) {
      const open = rest.lastIndexOf('[');
      if (open <= 0) {
        return { ok: false, error: exprError('EXPR_PATH_MALFORMED', `Unmatched ']' in path '${path}'.`, { path }) };
      }
      const inner = rest.slice(open + 1, -1);
      if (!INDEX_RE.test(inner)) {
        return { ok: false, error: exprError('EXPR_PATH_MALFORMED', `Invalid index '${inner}' in path '${path}'.`, { path }) };
      }
      indices.unshift(inner);
      rest = rest.slice(0, open);
    }
    if (rest.includes('[') || rest.includes(']')) {
      return { ok: false, error: exprError('EXPR_PATH_MALFORMED', `Stray bracket in path '${path}'.`, { path }) };
    }
    if (!NAME_RE.test(rest)) {
      return { ok: false, error: exprError('EXPR_PATH_MALFORMED', `Invalid name '${rest}' in path '${path}'.`, { path }) };
    }
    if (segments.length === 0 && !PATH_RESERVED_ROOTS.has(rest)) {
      return { ok: false, error: exprError('EXPR_PATH_MALFORMED', 'Unknown scope root ' + rest + ' in path ' + path + '.', { path }) };
    }
    if (FORBIDDEN_SEGMENTS.has(rest)) {
      return { ok: false, error: exprError('EXPR_PATH_MALFORMED', 'Forbidden segment ' + rest + ' in path ' + path + '.', { path }) };
    }
    segments.push(rest);
    for (const idx of indices) segments.push(idx);
  }
  return { ok: true, segments };
}

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

/**
 * Statically validate a PortableExpression AST.
 *
 * @param expr       The expression (bare node or versioned envelope).
 * @param registry   Optional function registry. When provided, `call` nodes
 *                   are checked against the manifest (unknown fn ->
 *                   EXPR_CALL_UNKNOWN_FN). When omitted, function-name
 *                   validation is skipped (callers may validate functions
 *                   separately). Passing the registry is recommended for
 *                   catalog-validation tooling.
 */
export function validateExpression(
  expr: PortableExpression | PortableExpressionEnvelope,
  registry?: FunctionRegistry,
): ExpressionValidationResult {
  const errors: ExpressionError[] = [];
  const warnings: ExpressionError[] = [];

  let node: PortableExpression;
  if (isEnvelope(expr)) {
    const env = expr;
    if (env.schemaVersion !== PORTABLE_EXPRESSION_SCHEMA_VERSION) {
      errors.push(
        exprError('EXPR_NODE_INVALID', `Unsupported expression schemaVersion ${String(env.schemaVersion)} (expected ${String(PORTABLE_EXPRESSION_SCHEMA_VERSION)}).`),
      );
      // Try to keep going on the inner node if present.
      node = env.expr;
    } else {
      node = env.expr;
    }
  } else {
    node = expr;
  }

  validateNode(node, '', errors, warnings, registry, 0);

  return { valid: errors.length === 0, errors, warnings };
}

function isEnvelope(x: unknown): x is PortableExpressionEnvelope {
  return typeof x === 'object' && x !== null && 'schemaVersion' in x && 'expr' in x;
}

function validateNode(
  node: PortableExpression,
  nodePath: string,
  errors: ExpressionError[],
  warnings: ExpressionError[],
  registry: FunctionRegistry | undefined,
  depth: number,
): void {
  if (depth > EXPR_MAX_DEPTH) {
    errors.push(exprError('EXPR_DEPTH_EXCEEDED', `Expression nesting exceeds max depth ${String(EXPR_MAX_DEPTH)}.`, { nodePath }));
    return;
  }
  if (typeof node !== 'object' || node === null) {
    errors.push(exprError('EXPR_NODE_INVALID', 'Node is not an object.', { nodePath }));
    return;
  }
  if (!('kind' in node)) {
    errors.push(exprError('EXPR_NODE_INVALID', 'Node is missing required `kind` field.', { nodePath }));
    return;
  }
  const kind = (node as { kind: unknown }).kind;
  if (typeof kind !== 'string' || !EXPRESSION_NODE_KINDS.has(kind as PortableExpression['kind'])) {
    errors.push(exprError('EXPR_NODE_INVALID', `Unknown node kind '${String(kind)}'.`, { nodePath }));
    return;
  }

  switch (kind) {
    case 'literal':
      validateLiteralNode(node as Extract<PortableExpression, { kind: 'literal' }>, nodePath, errors);
      break;
    case 'path':
      validatePathNode(node as Extract<PortableExpression, { kind: 'path' }>, nodePath, errors);
      break;
    case 'op':
      validateOpNode(node as Extract<PortableExpression, { kind: 'op' }>, nodePath, errors, warnings, registry, depth);
      break;
    case 'call':
      validateCallNode(node as Extract<PortableExpression, { kind: 'call' }>, nodePath, errors, registry, depth);
      break;
    case 'if':
      validateIfNode(node as Extract<PortableExpression, { kind: 'if' }>, nodePath, errors, warnings, registry, depth);
      break;
  }
}

function validateLiteralNode(
  node: Extract<PortableExpression, { kind: 'literal' }>,
  nodePath: string,
  errors: ExpressionError[],
): void {
  const v = node.value;
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return;
  }
  // Reject objects/arrays/functions/symbols: expressions are value-oriented.
  errors.push(
    exprError('EXPR_LITERAL_INVALID', `Literal value must be string | number | boolean | null, got '${typeof v}'.`, { nodePath: child(nodePath, 'value') }),
  );
}

function validatePathNode(
  node: Extract<PortableExpression, { kind: 'path' }>,
  nodePath: string,
  errors: ExpressionError[],
): void {
  const r = validatePath(node.path);
  if (!r.ok) {
    errors.push({ ...r.error, nodePath });
  }
}

function validateOpNode(
  node: Extract<PortableExpression, { kind: 'op' }>,
  nodePath: string,
  errors: ExpressionError[],
  warnings: ExpressionError[],
  registry: FunctionRegistry | undefined,
  depth: number,
): void {
  const op = node.op;
  if (typeof op !== 'string' || !OPERATOR_NAMES.has(op as PortableOperator)) {
    errors.push(exprError('EXPR_NODE_INVALID', `Unknown operator '${String(op)}'.`, { nodePath: child(nodePath, 'op') }));
    return;
  }
  // Arity check.
  const arity = OPERATOR_ARITY[op as PortableOperator];
  if (arity) {
    const args = Array.isArray(node.args) ? node.args : [];
    if (arity.exact !== undefined && args.length !== arity.exact) {
      errors.push(exprError('EXPR_OP_ARITY', `Operator '${op}' expects ${String(arity.exact)} arg(s), got ${String(args.length)}.`, { nodePath }));
    } else if (arity.min !== undefined && args.length < arity.min) {
      errors.push(exprError('EXPR_OP_ARITY', `Operator '${op}' expects at least ${String(arity.min)} arg(s), got ${String(args.length)}.`, { nodePath }));
    } else if (arity.max != null && args.length > arity.max) {
      errors.push(exprError('EXPR_OP_ARITY', `Operator '${op}' expects at most ${String(arity.max)} arg(s), got ${String(args.length)}.`, { nodePath }));
    }
  }
  const args = Array.isArray(node.args) ? node.args : [];
  if (!Array.isArray(node.args)) {
    errors.push(exprError('EXPR_NODE_INVALID', `Operator '${op}' args must be an array.`, { nodePath: child(nodePath, 'args') }));
  }
  args.forEach((arg, i) => validateNode(arg, child(child(nodePath, 'args'), String(i)), errors, warnings, registry, depth + 1));
}

function validateCallNode(
  node: Extract<PortableExpression, { kind: 'call' }>,
  nodePath: string,
  errors: ExpressionError[],
  registry: FunctionRegistry | undefined,
  depth: number,
): void {
  // Reject eval-like / member-access function names: no dots beyond namespace,
  // no parens, no brackets, no quotes.
  if (typeof node.fn !== 'string' || node.fn.length === 0) {
    errors.push(exprError('EXPR_NODE_INVALID', 'call.fn must be a non-empty string.', { nodePath: child(nodePath, 'fn') }));
    return;
  }
  if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(node.fn)) {
    errors.push(exprError('EXPR_NODE_INVALID', `Unsafe/malformed function name '${node.fn}'.`, { nodePath: child(nodePath, 'fn') }));
    return;
  }
  if (isForbiddenFunctionName(node.fn)) {
    errors.push(exprError('EXPR_CALL_UNKNOWN_FN', 'Unsafe/forbidden function name ' + node.fn + '.', { nodePath: child(nodePath, 'fn') }));
    return;
  }
  if (registry) {
    if (!registry.has(node.fn)) {
      const suggestions = suggestFunctions(node.fn, registry);
      errors.push(exprError('EXPR_CALL_UNKNOWN_FN', `Unknown function '${node.fn}'.`, { nodePath: child(nodePath, 'fn'), suggestions }));
    }
  }
  if (!Array.isArray(node.args)) {
    errors.push(exprError('EXPR_NODE_INVALID', `call.args must be an array.`, { nodePath: child(nodePath, 'args') }));
    return;
  }
  // Warn: functions taking higher-order args (array.filter/map/reduce/find/sort)
  // expect their callable as a `path` node referencing args.fn. We cannot
  // fully check without the manifest's arg schema; leave deep checks to eval.
  const warnings: ExpressionError[] = [];
  node.args.forEach((arg, i) => {
    validateNode(arg, child(child(nodePath, 'args'), String(i)), errors, warnings, registry, depth + 1);
  });
}

function validateIfNode(
  node: Extract<PortableExpression, { kind: 'if' }>,
  nodePath: string,
  errors: ExpressionError[],
  warnings: ExpressionError[],
  registry: FunctionRegistry | undefined,
  depth: number,
): void {
  validateNode(node.test, child(nodePath, 'test'), errors, warnings, registry, depth + 1);
  validateNode(node.then, child(nodePath, 'then'), errors, warnings, registry, depth + 1);
  validateNode(node.else, child(nodePath, 'else'), errors, warnings, registry, depth + 1);
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function child(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

/**
 * Levenshtein top-3 function-name suggestions from the registry. Helps users
 * fix typos like `string.conat` -> `string.concat`. Returns [] if registry
 * is empty or no close match.
 */
export function suggestFunctions(name: string, registry: FunctionRegistry): string[] {
  const names: string[] = [];
  // Best-effort: registry may not expose enumeration; collect via known
  // builtin namespaces if the registry supports listing. We use has() probes
  // against BUILTIN_FUNCTION_NAMES when available on the registry.
  const list = (registry as FunctionRegistry & { list?: () => string[] }).list;
  if (typeof list === 'function') {
    names.push(...list());
  }
  if (names.length === 0) return [];
  return names
    .map((n) => ({ n, d: levenshtein(name, n) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.n);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}
