// ============================================================================
// @bitcode/ui-schema — Expression Evaluator Interface (ADR-018 S5)
//
// Pure, side-effect-free AST evaluator contract. Implementations live in
// @bitcode/ui (TypeScript) and packages/ui-flutter (Dart). The interface
// itself lives here so catalog/runtime code can depend on the contract
// without pulling a runtime.
//
// CRITICAL coexistence rule (ADR-018 S5, plan S3.4):
//   This is a NEW interface, parallel to the legacy string-based `Evaluator`
//   in ../reactive/types.ts. The legacy `Evaluator` stays as an escape hatch
//   for host/application code. Ready Catalog JSON uses the AST evaluator only.
//   Both may coexist on a single ReactiveStore (distinct option slots).
//
// Purity contract:
//   - evaluate() MUST NOT perform I/O, touch globals, mutate the scope, or
//     call non-pure functions. Date/time reads go through `date.now()` which
//     is the single declared non-deterministic entry (manifest flagged).
//   - evaluate() receives an ALREADY permission-filtered scope. It has no
//     path to unauthorized data. Filtering happens upstream
//     (buildPermissionFilteredScope / PermissionAdapter).
//   - On failure, implementations throw an `ExpressionError` (./errors.ts).
//     They do not return a sentinel.
// ============================================================================

import type { PortableExpression } from './ast.ts';
import type { ExpressionError } from './errors.ts';
import type { ExpressionScope } from './scope.ts';

/**
 * Pure AST-based expression evaluator. Implementations are registered on
 * ReactiveStore via the `expressionEvaluator` slot (ADR-018 S5) and used by
 * the ActionRunner to resolve payload ASTs (ADR-018 S8 step 3).
 */
export interface ExpressionEvaluator {
  /**
   * Evaluate a PortableExpression AST against an already-permission-filtered
   * scope. Pure: no side effects, no I/O, no globals. Throws `ExpressionError`
   * on any failure (missing path, type mismatch, unknown function, depth
   * budget, etc.).
   *
   * Implementations MUST enforce EXPR_MAX_DEPTH and EXPR_MAX_STEPS.
   */
  evaluate(expr: PortableExpression, scope: ExpressionScope): unknown;

  /**
   * Optional static validation of an AST without evaluating it. Used by
   * builder tooling and the catalog validator (P4). Returns null when the
   * AST is structurally valid; returns the first error otherwise.
   *
   * Static validation covers: unknown node kinds, unknown operators, unknown
   * functions, arity for operators with fixed arity, literal type checks, and
   * depth. It CANNOT check path resolution or runtime type errors (those need
   * a scope). Path-malformed checks ARE static.
   */
  validate?(expr: PortableExpression): ExpressionError | null;
}
