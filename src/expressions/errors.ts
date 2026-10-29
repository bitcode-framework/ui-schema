// ============================================================================
// @bitcode/ui-schema — Portable Expression Errors (ADR-018 S5)
//
// Typed evaluation/validation errors with node-path tracking. Errors point to
// the offending AST node (dotted path) and, where relevant, the resolved data
// path. Inspired by go-json error enrichment (lang/errors.go) but smaller.
//
// Pure data: no throwing helpers here. Evaluator/validator throw/return these.
// ============================================================================

/**
 * Stable error codes for portable expression evaluation and validation.
 * Prefixed `EXPR_*` to keep a separate code space from `BLOCK_*` (ADR-017)
 * and the future `BLOCK_ACTION_*` (ADR-018 actions).
 */
export type ExpressionErrorCode =
  | 'EXPR_PATH_MISSING'
  | 'EXPR_PATH_UNAUTHORIZED'
  | 'EXPR_PATH_MALFORMED'
  | 'EXPR_OP_ARITY'
  | 'EXPR_OP_TYPE'
  | 'EXPR_OP_DIV_ZERO'
  | 'EXPR_CALL_UNKNOWN_FN'
  | 'EXPR_CALL_FN_PLATFORM'
  | 'EXPR_CALL_ARG_TYPE'
  | 'EXPR_LITERAL_INVALID'
  | 'EXPR_NODE_INVALID'
  | 'EXPR_DEPTH_EXCEEDED'
  | 'EXPR_STEP_BUDGET_EXCEEDED'
  | 'EXPR_CYCLE';

/**
 * A typed expression error. Carries a stable code, a human message, and
 * precise location info for builder diagnostics.
 */
export interface ExpressionError {
  code: ExpressionErrorCode;
  message: string;
  /**
   * Dotted path to the offending AST node, e.g. `op.args[1].call`.
   * Root-level errors omit this.
   */
  nodePath?: string;
  /**
   * The resolved data path that failed (for path errors), e.g.
   * `values.customer.address.zip`.
   */
  path?: string;
  /**
   * Suggested similar function/operator names (Levenshtein top-3) for
   * `EXPR_CALL_UNKNOWN_FN` / `EXPR_NODE_INVALID`-style typos.
   */
  suggestions?: string[];
}

/** Maximum AST nesting depth (DoS guard). Mirrors ReactiveStore cap discipline. */
export const EXPR_MAX_DEPTH = 64;

/** Maximum evaluation steps (DoS guard). One step ~= one node visit. */
export const EXPR_MAX_STEPS = 10_000;

/**
 * Build an error with optional fields. Keeps call sites terse.
 */
export function exprError(
  code: ExpressionErrorCode,
  message: string,
  opts: { nodePath?: string; path?: string; suggestions?: string[] } = {},
): ExpressionError {
  return {
    code,
    message,
    ...(opts.nodePath !== undefined ? { nodePath: opts.nodePath } : {}),
    ...(opts.path !== undefined ? { path: opts.path } : {}),
    ...(opts.suggestions !== undefined ? { suggestions: opts.suggestions } : {}),
  };
}
