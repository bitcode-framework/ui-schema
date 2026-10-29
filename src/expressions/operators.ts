// ============================================================================
// @bitcode/ui-schema — Portable Expression Operators (ADR-018 S5)
//
// The required operator set for Ready Catalog expressions. Pure, typed,
// arity-bounded. Each operator's arity and operand expectations are encoded
// in OPERATOR_SPECS so validators and evaluators share one source of truth.
//
// Operators are intentionally a closed set. New operators require a schema
// version bump (see ast.ts) because they change the evaluable surface across
// web/Flutter/RN/server.
// ============================================================================

/**
 * Built-in operators (ADR-018 S5).
 *
 * Grouped by family for readability; the union is the canonical set. Adding
 * an operator here is additive (no schema bump) IF every platform implements
 * it; otherwise it is a contract gap and must be gated by manifest/parity.
 */
export type PortableOperator =
  // comparisons
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // boolean
  | 'and'
  | 'or'
  | 'not'
  // arithmetic
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  // aggregation (operate on list operands)
  | 'sum'
  | 'count'
  | 'min'
  | 'max'
  | 'avg'
  // string / list
  | 'concat'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  // null / empty
  | 'isEmpty'
  | 'isNotEmpty'
  | 'coalesce';

/** All valid operator names (used by validators to reject unknown ops). */
export const PORTABLE_OPERATORS = new Set<PortableOperator>([
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'and', 'or', 'not',
  'add', 'sub', 'mul', 'div',
  'sum', 'count', 'min', 'max', 'avg',
  'concat', 'contains', 'startsWith', 'endsWith',
  'isEmpty', 'isNotEmpty', 'coalesce',
]);

/**
 * Operator family. Drives evaluator dispatch and error messages.
 */
export type OperatorFamily =
  | 'comparison'
  | 'boolean'
  | 'arithmetic'
  | 'aggregation'
  | 'string-list'
  | 'null-empty';

/**
 * Expected operand category. Used by the validator to surface type errors
 * without re-implementing evaluation. `any` means the operator is polymorphic
 * (e.g. `eq`/`ne` accept any pair; `coalesce` accepts any pair). The
 * evaluator still enforces runtime type rules per operator.
 */
export type OperandType =
  | 'number'
  | 'boolean'
  | 'string'
  | 'list'
  | 'any';

/**
 * Static spec for one operator. `arity` is exact; variadic operators use
 * `minArgs`/`maxArgs` (maxArgs `null` = unbounded).
 */
export interface OperatorSpec {
  op: PortableOperator;
  family: OperatorFamily;
  /** Exact fixed arity, OR null when variadic (see minArgs/maxArgs). */
  arity: number | null;
  minArgs: number;
  maxArgs: number | null;
  /** Expected operand type for type-check hints (evaluator is authoritative). */
  operands: OperandType;
  /** Short human description for diagnostics / docs. */
  description: string;
}

/**
 * The canonical operator spec table. Single source of truth for arity and
 * operand expectations. Validators consult this; evaluators consult this.
 *
 * Rationale for each arity:
 *   - comparisons (eq/ne/gt/gte/lt/lte): binary (2).
 *   - boolean and/or: variadic (min 2, unbounded) — short-circuit friendly.
 *   - boolean not: unary (1).
 *   - arithmetic (add/sub/mul/div): binary (2). No unary `sub` negation —
 *     use `mul` by -1 or `math.abs`/`math.sign` for sign ops.
 *   - aggregation (sum/count/min/max/avg): variadic over list operands
 *     (min 1, unbounded). Each arg must be a list; the operator aggregates
 *     across the union of elements. `count` returns total element count.
 *   - string/list concat: variadic (min 1, unbounded). Stringifies nothing —
 *     all args must be the same family (all strings or all lists); mixed is
 *     a type error. Empty arg list is a type error (min 1).
 *   - contains/startsWith/endsWith: binary (2) — (haystack, needle).
 *   - isEmpty/isNotEmpty: unary (1).
 *   - coalesce: variadic (min 2, unbounded) — returns first non-null arg.
 */
export const OPERATOR_SPECS: Readonly<Record<PortableOperator, OperatorSpec>> = {
  eq:           { op: 'eq',           family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'any',     description: 'Equal (deep equality).' },
  ne:           { op: 'ne',           family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'any',     description: 'Not equal (deep inequality).' },
  gt:           { op: 'gt',           family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Greater than.' },
  gte:          { op: 'gte',          family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Greater than or equal.' },
  lt:           { op: 'lt',           family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Less than.' },
  lte:          { op: 'lte',          family: 'comparison',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Less than or equal.' },
  and:          { op: 'and',          family: 'boolean',     arity: null, minArgs: 2, maxArgs: null, operands: 'boolean', description: 'Logical AND (variadic, short-circuit).' },
  or:           { op: 'or',           family: 'boolean',     arity: null, minArgs: 2, maxArgs: null, operands: 'boolean', description: 'Logical OR (variadic, short-circuit).' },
  not:          { op: 'not',          family: 'boolean',     arity: 1,    minArgs: 1, maxArgs: 1,    operands: 'boolean', description: 'Logical NOT.' },
  add:          { op: 'add',          family: 'arithmetic',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Numeric addition.' },
  sub:          { op: 'sub',          family: 'arithmetic',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Numeric subtraction.' },
  mul:          { op: 'mul',          family: 'arithmetic',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Numeric multiplication.' },
  div:          { op: 'div',          family: 'arithmetic',  arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'number',  description: 'Numeric division (div-by-zero is a typed error).' },
  sum:          { op: 'sum',          family: 'aggregation', arity: null, minArgs: 1, maxArgs: null, operands: 'list',    description: 'Sum of all elements across list args.' },
  count:        { op: 'count',        family: 'aggregation', arity: null, minArgs: 1, maxArgs: null, operands: 'list',    description: 'Total element count across list args.' },
  min:          { op: 'min',          family: 'aggregation', arity: null, minArgs: 1, maxArgs: null, operands: 'list',    description: 'Minimum element across list args.' },
  max:          { op: 'max',          family: 'aggregation', arity: null, minArgs: 1, maxArgs: null, operands: 'list',    description: 'Maximum element across list args.' },
  avg:          { op: 'avg',          family: 'aggregation', arity: null, minArgs: 1, maxArgs: null, operands: 'list',    description: 'Average of elements across list args.' },
  concat:       { op: 'concat',       family: 'string-list', arity: null, minArgs: 0, maxArgs: null, operands: 'any',     description: 'Concatenate strings or lists (same family only). Empty args yields empty string.' },
  contains:     { op: 'contains',     family: 'string-list', arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'any',     description: 'Haystack contains needle (string or list).' },
  startsWith:   { op: 'startsWith',   family: 'string-list', arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'string',  description: 'String starts with needle.' },
  endsWith:     { op: 'endsWith',     family: 'string-list', arity: 2,    minArgs: 2, maxArgs: 2,    operands: 'string',  description: 'String ends with needle.' },
  isEmpty:      { op: 'isEmpty',      family: 'null-empty',  arity: 1,    minArgs: 1, maxArgs: 1,    operands: 'any',     description: 'True for null, "", [], or {}.' },
  isNotEmpty:   { op: 'isNotEmpty',   family: 'null-empty',  arity: 1,    minArgs: 1, maxArgs: 1,    operands: 'any',     description: 'Negation of isEmpty.' },
  coalesce:     { op: 'coalesce',     family: 'null-empty',  arity: null, minArgs: 2, maxArgs: null, operands: 'any',     description: 'First non-null arg; null if all null.' },
};

/** Lookup helper with a typed result. */
export function getOperatorSpec(op: string): OperatorSpec | undefined {
  return (OPERATOR_SPECS as Record<string, OperatorSpec>)[op];
}

/** Whether `op` is a known canonical operator. */
export function isPortableOperator(op: string): op is PortableOperator {
  return PORTABLE_OPERATORS.has(op as PortableOperator);
}

// ---------------------------------------------------------------------------
// Convenience exports (derived from OPERATOR_SPECS) for validators + barrel
// ---------------------------------------------------------------------------

/** Alias for PORTABLE_OPERATORS — the canonical set of operator names. */
export const OPERATOR_NAMES: ReadonlySet<PortableOperator> = PORTABLE_OPERATORS;

/** Alias for PORTABLE_OPERATORS — canonical operator set. */
export const CANONICAL_PORTABLE_OPERATORS: ReadonlySet<PortableOperator> = PORTABLE_OPERATORS;

/**
 * Arity bounds per operator, derived from OPERATOR_SPECS. Shape:
 * `{ exact?: number; min?: number; max?: number | null }`.
 * `exact` is set for fixed-arity operators; `min`/`max` for variadic.
 */
export const OPERATOR_ARITY: Readonly<
  Record<PortableOperator, { exact?: number; min?: number; max?: number | null }>
> = (() => {
  const out: Record<string, { exact?: number; min?: number; max?: number | null }> = {};
  for (const spec of Object.values(OPERATOR_SPECS)) {
    if (spec.arity !== null) {
      out[spec.op] = { exact: spec.arity, min: spec.minArgs, max: spec.maxArgs };
    } else {
      out[spec.op] = { min: spec.minArgs, max: spec.maxArgs };
    }
  }
  return out as Record<PortableOperator, { exact?: number; min?: number; max?: number | null }>;
})();

/** Family membership predicates. */
export function isComparisonOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'comparison';
}
export function isBooleanOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'boolean';
}
export function isArithmeticOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'arithmetic';
}
export function isAggregationOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'aggregation';
}
export function isListStringOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'string-list';
}
export function isNullEmptyOp(op: string): boolean {
  const s = getOperatorSpec(op);
  return s?.family === 'null-empty';
}
