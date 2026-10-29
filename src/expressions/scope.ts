// ============================================================================
// @bitcode/ui-schema — Expression Scope & Path Grammar (ADR-018 S5, S7)
//
// Defines the named evaluation scope, path grammar, and permission snapshot.
// Pure types + pure path helpers. No runtime eval here (see evaluator).
//
// Scope roots are FIXED and named (ADR-018 S5): `values`, `meta`, `data`,
// `services`, `permissions`, `args`. Path resolution is deterministic and
// MUST NOT access global objects (window/process/fs/...).
// ============================================================================

// ---------------------------------------------------------------------------
// Scope roots
// ---------------------------------------------------------------------------

/**
 * The fixed set of scope roots an expression path may start from.
 * Adding a root is additive; removing/renaming is a schema-version bump.
 */
export type ExpressionScopeRoot =
  | 'values'
  | 'meta'
  | 'data'
  | 'services'
  | 'permissions'
  | 'args';

export const EXPRESSION_SCOPE_ROOTS: ReadonlySet<ExpressionScopeRoot> = new Set([
  'values',
  'meta',
  'data',
  'services',
  'permissions',
  'args',
]);

/**
 * Reserved scope-relative sigils used inside repeater/nested contexts
 * (mirrors `Snapshot.$self/$parent/$root/$index` from reactive/types.ts).
 * These may appear as the FIRST path segment OR as an array index.
 */
export const SCOPE_SIGILS = new Set(['$self', '$parent', '$root', '$index']);

// ---------------------------------------------------------------------------
// Permission snapshot
// ---------------------------------------------------------------------------

/**
 * Permission facts exposed to the expression evaluator. The permission
 * adapter builds this BEFORE evaluation; the evaluator receives only the
 * already-filtered scope (ADR-018 S5, S7).
 *
 * Field-level authorization is expressed as explicit allow-sets per
 * namespace. An ABSENT set means "deny all for that namespace". A PRESENT
 * but empty set also means "deny all" (no fields authorized).
 *
 * `superuser` is reserved for host adapters only — Ready Catalog JSON must
 * never rely on it. Validators reject expressions whose evaluation depends
 * on `superuser` in catalog context (handled by catalog validator, P4).
 */
export interface PermissionSnapshot {
  /** Authorized `values.<field>` paths (dot-notation, top-level field names). */
  allowedValueFields?: Set<string>;
  /** Authorized `data.<key>` keys. */
  allowedDataKeys?: Set<string>;
  /** Authorized `services.<name>` names. */
  allowedServices?: Set<string>;
  /** Permission facts exposed to expressions (e.g. `{ canApprove: true }`). */
  facts?: Record<string, boolean>;
  /** Superuser bypass — host adapters only, never catalog JSON. */
  superuser?: boolean;
}

// ---------------------------------------------------------------------------
// Expression scope
// ---------------------------------------------------------------------------

/**
 * The evaluation scope. All maps are plain records for JSON-friendliness;
 * `permissions` carries the typed snapshot.
 *
 * `args` is caller-controlled and always survives permission filtering (the
 * caller is responsible for authorizing what it passes). Higher-order
 * built-ins (array.filter/map/reduce/...) receive the lambda AST via
 * `args.fn` — keeping the AST serializable (no closures in JSON).
 */
export interface ExpressionScope {
  values: Record<string, unknown>;
  meta: Record<string, unknown>;
  data: Record<string, unknown>;
  services: Record<string, unknown>;
  permissions: PermissionSnapshot;
  args?: Record<string, unknown>;
}

/**
 * Build an empty scope (useful for tests + validators that need a default).
 */
export function emptyExpressionScope(): ExpressionScope {
  return {
    values: {},
    meta: {},
    data: {},
    services: {},
    permissions: {},
    args: {},
  };
}

// ---------------------------------------------------------------------------
// Path grammar + parsing helpers
// ---------------------------------------------------------------------------

/**
 * Path grammar (deterministic, no global access):
 *
 *   path       := root ('.' segment)*
 *   root       := 'values' | 'meta' | 'data' | 'services'
 *               | 'permissions' | 'args'
 *               | '$self' | '$parent' | '$root'
 *   segment    := name | name '[' index ']'
 *   name       := [a-zA-Z_$][a-zA-Z0-9_$]*
 *   index      := [0-9]+ | '$index' | '$self' | '$parent' | '$root'
 *
 * Notes:
 *   - The root may be a sigil (`$self`/`$parent`/`$root`) which resolves to
 *     the nested-store scope keys (ADR-004 S4). `$index` is a valid INDEX
 *     but not a root (it resolves to a number).
 *   - Array access uses bracket notation only: `data.items[0]`,
 *     `data.items[$index]`. Negative indices are rejected.
 *   - No property access on globals, no `__proto__`, no `constructor`,
 *     no `prototype`. These names are rejected as segments.
 */

const NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Forbidden segment names — block prototype-chain traversal. */
const FORBIDDEN_SEGMENTS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * A parsed path: a root + ordered list of accessors (property name or index).
 * `index` accessors carry a non-negative integer. Sigil indices
 * (`$index`/`$self`/`$parent`/`$root`) are resolved by the evaluator against
 * the nested scope, NOT here (this parser is scope-agnostic).
 */
export interface ParsedPath {
  root: ExpressionScopeRoot | '$self' | '$parent' | '$root';
  accessors: Array<{ kind: 'property'; name: string } | { kind: 'index'; value: number | '$index' | '$self' | '$parent' | '$root' }>;
}

export interface PathParseError {
  message: string;
  /** 0-based offset into the original path string where the error begins. */
  position: number;
}

/**
 * Parse a portable expression path. Returns `null` on success (parsed path
 * in the `.value` field via a different shape) — see return type. On error
 * returns `{ error: PathParseError }`.
 *
 * This is a pure function; it does not touch any scope.
 */
export function parsePath(path: string):
  | { ok: true; parsed: ParsedPath }
  | { ok: false; error: PathParseError } {
  if (path.length === 0) {
    return { ok: false, error: { message: 'empty path', position: 0 } };
  }

  // Split root from the rest. Root ends at first '.' or '['.
  let rootEnd = 0;
  while (rootEnd < path.length && path[rootEnd] !== '.' && path[rootEnd] !== '[') {
    rootEnd++;
  }
  const rootStr = path.slice(0, rootEnd);

  // Validate root.
  const isCanonicalRoot = EXPRESSION_SCOPE_ROOTS.has(rootStr as ExpressionScopeRoot);
  const isSigilRoot = rootStr === '$self' || rootStr === '$parent' || rootStr === '$root';
  if (!isCanonicalRoot && !isSigilRoot) {
    return {
      ok: false,
      error: {
        message: `unknown scope root '${rootStr}'`,
        position: 0,
      },
    };
  }
  // `$index` is NOT a valid root.
  if (rootStr === '$index') {
    return {
      ok: false,
      error: { message: "'$index' is not a valid path root", position: 0 },
    };
  }

  const parsed: ParsedPath = {
    root: rootStr as ParsedPath['root'],
    accessors: [],
  };

  let i = rootEnd;
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      // Property segment.
      i++; // consume '.'
      let j = i;
      while (j < path.length && path[j] !== '.' && path[j] !== '[') {
        j++;
      }
      const name = path.slice(i, j);
      if (!NAME_RE.test(name)) {
        return {
          ok: false,
          error: { message: `invalid property name '${name}'`, position: i },
        };
      }
      if (FORBIDDEN_SEGMENTS.has(name)) {
        return {
          ok: false,
          error: { message: `forbidden segment '${name}'`, position: i },
        };
      }
      parsed.accessors.push({ kind: 'property', name });
      i = j;
    } else if (ch === '[') {
      // Index segment.
      const start = i;
      i++; // consume '['
      let j = i;
      while (j < path.length && path[j] !== ']') {
        j++;
      }
      if (j >= path.length) {
        return {
          ok: false,
          error: { message: 'unterminated [', position: start },
        };
      }
      const inner = path.slice(i, j);
      i = j + 1; // consume ']'
      if (inner === '$index' || inner === '$self' || inner === '$parent' || inner === '$root') {
        parsed.accessors.push({ kind: 'index', value: inner });
      } else {
        // Must be a non-negative integer.
        if (!/^[0-9]+$/.test(inner)) {
          return {
            ok: false,
            error: { message: `invalid index '${inner}'`, position: start + 1 },
          };
        }
        const num = Number(inner);
        if (!Number.isSafeInteger(num) || num < 0) {
          return {
            ok: false,
            error: { message: `invalid index '${inner}'`, position: start + 1 },
          };
        }
        parsed.accessors.push({ kind: 'index', value: num });
      }
    } else {
      return {
        ok: false,
        error: { message: `unexpected character '${ch}'`, position: i },
      };
    }
  }

  return { ok: true, parsed };
}

/**
 * Quick structural validity check for a path string. Used by validators.
 */
export function isValidPath(path: string): boolean {
  return parsePath(path).ok;
}
