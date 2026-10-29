// ============================================================================
// @bitcode/ui-schema — Action Diagnostic Codes (ADR-018)
//
// Stable action diagnostic codes for the ActionRunner, adapter registry, and
// action validators. Prefixed `ACTION_*` to keep a separate code space from
// `BLOCK_*` (ADR-017) and `EXPR_*` (ADR-018 expressions, Agent F).
//
// No Ready-promotion logic here (Amendment 6). Ready gating is owned by the
// catalog validator (P4), not by the action runtime.
// ============================================================================

/**
 * Stable diagnostic codes produced by the action runtime. Each code maps to a
 * distinct failure mode in the ActionRunner state machine. Callers and
 * lifecycle observers may switch on these codes for typed error handling.
 */
export type ActionDiagnosticCode =
  /** ActionSource is structurally invalid (bad type, missing required field). */
  | 'ACTION_SOURCE_INVALID'
  /** Required adapter not registered for handler/url/model source. */
  | 'ACTION_ADAPTER_MISSING'
  /** Adapter threw a raw (un-normalized) error instead of returning ActionResult. */
  | 'ACTION_ADAPTER_THREW'
  /** URL action rejected by host-injected UrlPolicy (preflight). */
  | 'ACTION_URL_NOT_ALLOWED'
  /** An effect references an adapter that is missing (e.g. navigate with no NavigationAdapter). */
  | 'ACTION_EFFECT_ADAPTER_MISSING'
  /** Action cancelled via AbortSignal (distinct from timeout). */
  | 'ACTION_ABORTED'
  /** Action exceeded opts.timeoutMs (distinct from abort). */
  | 'ACTION_TIMEOUT'
  /** Adapter returned a result that is malformed (missing ok, wrong status type). */
  | 'ACTION_RESULT_MALFORMED'
  /** Duplicate actionId: a run with the same id is already in-flight. */
  | 'ACTION_DUPLICATE_ACTION_ID';

/** Canonical set of action diagnostic codes (used by validators). */
export const ACTION_DIAGNOSTIC_CODES: ReadonlySet<ActionDiagnosticCode> = new Set([
  'ACTION_SOURCE_INVALID',
  'ACTION_ADAPTER_MISSING',
  'ACTION_ADAPTER_THREW',
  'ACTION_URL_NOT_ALLOWED',
  'ACTION_EFFECT_ADAPTER_MISSING',
  'ACTION_ABORTED',
  'ACTION_TIMEOUT',
  'ACTION_RESULT_MALFORMED',
  'ACTION_DUPLICATE_ACTION_ID',
]);

/** True if `code` is a known action diagnostic code. */
export function isActionDiagnosticCode(code: string): code is ActionDiagnosticCode {
  return ACTION_DIAGNOSTIC_CODES.has(code as ActionDiagnosticCode);
}
