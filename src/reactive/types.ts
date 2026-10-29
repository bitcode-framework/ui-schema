// ============================================================================
// @bitcode/ui-schema — Reactive Engine Types (ADR-004)
//
// Defines Reaction, Effect, FieldMeta, and related interfaces used by
// ReactiveStore. Headless: pure logic, framework-agnostic.
//
// Extracted from @bitcode/ui per ADR-012.
// ============================================================================

export type FieldPath = string;

/**
 * Scope passed to reaction predicates / effects (ADR-004 §4).
 *
 * Today this is a flat record of the current store's values. When repeaters
 * land (Phase C of ADR-004), the reactive runtime will populate the optional
 * `$self` / `$parent` / `$root` / `$index` keys so expressions like
 * `s.$parent.tipe === 'NPWP'` resolve naturally.
 *
 * Encoded as keys on the same record (not nested objects) so reaction author
 * functions stay one level deep and Mitosis-friendly. Stores that are not
 * nested simply leave these slots undefined.
 */
export type Snapshot = Record<string, unknown> & {
  $self?: Record<string, unknown>;
  $parent?: Record<string, unknown>;
  $root?: Record<string, unknown>;
  $index?: number;
};

/**
 * Plug-in slot for string-based expression evaluators (ADR-004 §3 / Phase E).
 *
 * `@bitcode/ui` does NOT ship an evaluator; reactions default to plain JS
 * functions (`(s) => s.qty * s.harga`). This interface lets host apps wire
 * `expr-js` (frontend port of expr-lang) for live preview in form builders
 * or offline validation. The reactive runtime calls `evaluate(expr, scope)`
 * only when a reaction author hands it a string instead of a function.
 *
 * Constraints (ADR-004 §3 — Batasan):
 *   - Reactions remain **pure**: no side effects in `evaluate`.
 *   - Evaluators MUST NOT touch `window` / `process` / `fs` / network.
 *   - No `eval()` of raw JS — implementations parse to AST.
 */
export interface Evaluator {
  evaluate(expr: string, scope: Snapshot): unknown;
  /** Optional AST cache hook. Implementations free to no-op. */
  compile?(expr: string): CompiledExpr;
}

/** Opaque handle returned by `Evaluator.compile` for fast re-evaluation. */
export interface CompiledExpr {
  evaluate(scope: Snapshot): unknown;
}

export interface FieldMeta {
  visible: boolean;
  disabled: boolean;
  required: boolean;
  options?: unknown[];
  rules?: ValidationRule[];
  error?: string;
  loading?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'length' | 'pattern' | 'custom';
  value?: unknown;
  message?: string;
  fn?: (value: unknown) => boolean;
}

// -- Effects --

/** Re-query a field's data source when dependencies change. */
export interface DataEffect {
  source: {
    type: 'model' | 'url' | 'fetcher' | 'local';
    name?: string;
    url?: string;
    fetcher?: (scope: Record<string, unknown>) => Promise<unknown[]>;
    data?: unknown[];
    filters?: Record<string, unknown>;
  };
  clearOnChange?: boolean;
}

/** Replace a field's validation rules. */
export interface ValidationEffect {
  rules: ValidationRule[] | ((scope: Record<string, unknown>) => ValidationRule[]);
}

/** Show/hide, enable/disable, require/unrequire. */
export interface UiEffect {
  visible?: boolean | ((scope: Record<string, unknown>) => boolean);
  disabled?: boolean | ((scope: Record<string, unknown>) => boolean);
  required?: boolean | ((scope: Record<string, unknown>) => boolean);
}

/** Compute a field's value from an expression / function. */
export interface ValueEffect {
  expr?: (scope: Record<string, unknown>) => unknown;
}

export type Effect =
  | { kind: 'data'; data: DataEffect }
  | { kind: 'validation'; validation: ValidationEffect }
  | { kind: 'ui'; ui: UiEffect }
  | { kind: 'value'; value: ValueEffect };

export interface Reaction {
  when: FieldPath | FieldPath[];
  target: FieldPath;
  effect: Effect;
  condition?: (scope: Record<string, unknown>) => boolean;
}

export interface ReactiveStoreOptions {
  initialValues?: Record<string, unknown>;
  reactions?: Reaction[];
  onChange?: (path: FieldPath, value: unknown) => void;
  /**
   * Parent store for nested scopes (ADR-004 §4 repeater rows). When set,
   * `$parent` and `$root` resolve from this link. The child does NOT mutate
   * the parent; it only reads parent snapshots into its scope.
   */
  parent?: ReactiveScopeLike;
  /** Row index inside a repeater. Surfaced as `$index` in the scope. */
  index?: number;
  /**
   * Optional string-expression evaluator (ADR-004 §3). When omitted,
   * reactions MUST use function form. Reaction effects that supply a `string`
   * expression while no evaluator is attached throw at runtime — this
   * intentional fail-fast prevents silent no-ops.
   */
  evaluator?: Evaluator;
}

/**
 * Minimal contract a parent must satisfy for a child store to read it.
 * `ReactiveStore` implements this; tests can inject lighter mocks too.
 */
export interface ReactiveScopeLike {
  snapshot(): Record<string, unknown>;
  /** Walk up to the topmost ancestor for `$root` resolution. */
  getRoot(): ReactiveScopeLike;
}
