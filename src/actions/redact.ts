// ============================================================================
// @bitcode/ui-schema — Redaction (ADR-018 S9)
//
// Redacts sensitive top-level fields from lifecycle event payloads and result
// data before emission. Applied to ActionLifecycleEvent.payload and
// ActionLifecycleEvent.result.data top-level keys.
//
// v1 redacts TOP-LEVEL keys only (documented limitation). Nested redaction is
// deferred to a future hardening pass with a path-based redactor.
//
// CRITICAL: redaction is NEVER applied to the actual adapter invocation.
// Adapters see the full payload — they own auth. Redaction is purely for
// lifecycle observers (logs, event listeners, devtools).
//
// Pure function: returns a new object; never mutates input.
// ============================================================================

import type { RedactConfig } from './runtime-context.ts';

/**
 * Redact sensitive top-level fields from a value.
 *
 * - `remove` mode: deletes matching top-level keys from the cloned object.
 * - `mask` mode: replaces matching values with `'***'`.
 *
 * Non-object values are returned unchanged (no deep walk in v1). Arrays are
 * shallow-copied; their elements are not inspected (v1 limitation).
 */
export function redactSensitiveFields(
  value: unknown,
  config: RedactConfig | undefined,
): unknown {
  if (!config || !config.fields || config.fields.length === 0) {
    return cloneShallow(value);
  }
  if (!isPlainObject(value)) {
    return cloneShallow(value);
  }
  const fieldSet = new Set(config.fields);
  if (config.mode === 'remove') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!fieldSet.has(k)) out[k] = v;
    }
    return out;
  }
  // mask
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = fieldSet.has(k) ? '***' : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Shallow clone that preserves primitives and handles null. */
function cloneShallow(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value; // primitives
  if (Array.isArray(value)) return [...value];
  return { ...(value as Record<string, unknown>) };
}
