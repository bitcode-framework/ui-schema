// ============================================================================
// @bitcode/ui-schema - Permission-Filtered Scope Builder (ADR-018 S5, S7)
//
// Builds a NEW scope with unauthorized fields/services REMOVED (not hidden)
// before expression evaluation. The evaluator never sees denied data.
// Pure function: never mutates input. No I/O, no globals.
//
// Rules (ADR-018 S5/S7):
//   - values.<field>  dropped unless <field> in allowedValueFields (or superuser)
//   - data.<key>      dropped unless <key>   in allowedDataKeys    (or superuser)
//   - services.<name> dropped unless <name>  in allowedServices    (or superuser)
//   - permissions.facts ALWAYS survive (it IS the permission surface)
//   - args ALWAYS survive (caller-controlled, already authorized by caller)
//   - meta: permissive by default (UI metadata, not sensitive records).
//     Hosts may tighten by passing a custom filter; this builder keeps meta
//     intact to avoid breaking visibility/disabled reactions that read meta.
//   - superuser bypass: removes all filtering. Host adapters only; never set
//     by catalog JSON.
// ============================================================================

import type { ExpressionScope, PermissionSnapshot } from './scope.ts';

/**
 * Build a permission-filtered copy of `scope`. Returns a new object; the
 * input is never mutated.
 *
 * If `scope.permissions` is absent (no permission surface declared), the
 * scope is returned structurally unchanged (a shallow copy). This is the
 * permissive default for hosts that have not wired a permission adapter.
 */
export function buildPermissionFilteredScope(
  scope: ExpressionScope,
): ExpressionScope {
  const perm = scope.permissions;
  if (!perm || perm.superuser === true) {
    return { ...scope };
  }

  return {
    ...scope,
    values: filterRecord(scope.values, perm.allowedValueFields),
    data: filterRecord(scope.data, perm.allowedDataKeys),
    services: filterRecord(scope.services, perm.allowedServices),
    // permissions.facts always survives; args always survives; meta intact.
  };
}

/**
 * Reports whether a root path segment is authorized under the given snapshot.
 * Used by validators to emit EXPR_PATH_UNAUTHORIZED vs EXPR_PATH_MISSING
 * diagnostics before evaluation.
 *
 * Returns:
 *   - 'allowed'   the segment is permitted
 *   - 'denied'    the segment is explicitly filtered out
 *   - 'neutral'   no allowlist governs this namespace (meta, args, facts)
 */
export function pathAuthorization(
  root: 'values' | 'data' | 'services' | 'meta' | 'args' | 'permissions',
  segment: string,
  perm: PermissionSnapshot | undefined,
): 'allowed' | 'denied' | 'neutral' {
  if (!perm || perm.superuser === true) return 'allowed';
  switch (root) {
    case 'values':
      return authorizeSegment(perm.allowedValueFields, segment);
    case 'data':
      return authorizeSegment(perm.allowedDataKeys, segment);
    case 'services':
      return authorizeSegment(perm.allowedServices, segment);
    default:
      return 'neutral';
  }
}

function authorizeSegment(
  allowed: Set<string> | undefined,
  segment: string,
): 'allowed' | 'denied' {
  if (allowed === undefined) return 'denied'; // absent allowlist = deny all
  return allowed.has(segment) ? 'allowed' : 'denied';
}

function filterRecord(
  record: Record<string, unknown>,
  allowed: Set<string> | undefined,
): Record<string, unknown> {
  if (allowed === undefined) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) out[key] = record[key];
  }
  return out;
}
