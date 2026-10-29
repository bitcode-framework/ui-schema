// ============================================================================
// @bitcode/ui-schema — Portable Expression AST (ADR-018 S5)
//
// Canonical, framework-neutral, JSON-serializable expression descriptor used
// by Ready Catalog reactivity (visibility, disabled, derived values,
// validators, action guards). NOT JavaScript, NOT a string DSL — a small,
// typed, versioned AST evaluable on web, Flutter, RN, and server with parity.
//
// Design (ADR-018 S5):
//   - Pure: no side effects, no I/O, no globals.
//   - Serializable: every node is plain JSON.
//   - Bounded: depth + step caps guard against DoS (see evaluator).
//   - Permission-filtered: scopes are filtered BEFORE evaluation.
//   - Coexists with the legacy string-based `Evaluator` (ADR-004 escape hatch).
//
// This file is TYPE-ONLY (no runtime). Evaluators live in @bitcode/ui (TS) and
// packages/ui-flutter (Dart). Validators live in ./validate.ts.
// ============================================================================

import type { PortableOperator } from './operators.ts';

/**
 * Schema version for the expression AST shape. Bumped only when the JSON
 * shape of `PortableExpression` changes in a backwards-incompatible way.
 * Adding a new node kind or operator is additive (no bump); removing or
 * renaming is a bump. Validators check this on deserialize.
 */
export const PORTABLE_EXPRESSION_SCHEMA_VERSION = 1 as const;

/**
 * A portable expression node. Five node kinds (ADR-018 S5):
 *
 * - `literal` — a JSON scalar (string | number | boolean | null).
 *   Objects/arrays are intentionally NOT allowed as literals: expressions are
 *   value-oriented, not data-construction tools. Use `call` (e.g.
 *   `array.concat`) for list building.
 * - `path`     — a deterministic reference into the named evaluation scope
 *   (e.g. `values.qty`, `data.items[0].price`, `$parent.tipe`). Grammar in
 *   ./scope.ts. Never touches globals.
 * - `op`       — a built-in operator (comparisons, boolean, arithmetic,
 *   aggregation, string/list, null/empty). Full set in ./operators.ts.
 * - `call`     — invocation of an allowlisted pure built-in function
 *   (`math.*`, `string.*`, `array.*`, `date.*`, `format.*`, `validate.*`) or a
 *   registered host function with a manifest. Never arbitrary eval.
 * - `if`       — conditional/ternary. Strict boolean test (truthy/falsy
 *   coercion is NOT applied — a non-boolean test is a type error).
 *
 * `if` is a node kind, not an operator, per ADR-018 S5.
 */
export type PortableExpression =
  | LiteralNode
  | PathNode
  | OpNode
  | CallNode
  | IfNode;

export interface LiteralNode {
  kind: 'literal';
  /** JSON scalar only: string | number | boolean | null. */
  value: string | number | boolean | null;
}

export interface PathNode {
  kind: 'path';
  /** Dotted path with optional `[index]` segments. See scope.ts grammar. */
  path: string;
}

export interface OpNode {
  kind: 'op';
  op: PortableOperator;
  /** Operator arguments. Arity enforced by validator + evaluator. */
  args: PortableExpression[];
}

export interface CallNode {
  kind: 'call';
  /** Namespaced function name, e.g. `string.concat`, `math.round`. */
  fn: string;
  /** Function arguments. Arity/type enforced by manifest + evaluator. */
  args: PortableExpression[];
}

export interface IfNode {
  kind: 'if';
  /** MUST evaluate to boolean (strict — no truthy/falsy coercion). */
  test: PortableExpression;
  then: PortableExpression;
  else: PortableExpression;
}

/** Type guard: literal node. */
export function isLiteralNode(node: PortableExpression): node is LiteralNode {
  return node.kind === 'literal';
}

/** Type guard: path node. */
export function isPathNode(node: PortableExpression): node is PathNode {
  return node.kind === 'path';
}

/** Type guard: op node. */
export function isOpNode(node: PortableExpression): node is OpNode {
  return node.kind === 'op';
}

/** Type guard: call node. */
export function isCallNode(node: PortableExpression): node is CallNode {
  return node.kind === 'call';
}

/** Type guard: if node. */
export function isIfNode(node: PortableExpression): node is IfNode {
  return node.kind === 'if';
}

/** All valid node kinds (used by validators to reject unknown kinds). */
export const EXPRESSION_NODE_KINDS = new Set<PortableExpression['kind']>([
  'literal',
  'path',
  'op',
  'call',
  'if',
]);

/**
 * Envelope shape for versioned serialization. Validators and serializers
 * accept both bare `PortableExpression` and a versioned envelope. The
 * envelope is the canonical on-disk/wire form; bare nodes are accepted for
 * ergonomics in code.
 */
export interface PortableExpressionEnvelope {
  schemaVersion: typeof PORTABLE_EXPRESSION_SCHEMA_VERSION;
  expr: PortableExpression;
}
