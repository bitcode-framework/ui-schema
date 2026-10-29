// ============================================================================
// @bitcode/ui-schema — ActionResult + ActionError (ADR-018 S2)
//
// All action paths (local, handler, url, model) normalize to one result shape.
// Adapters MUST return an ActionResult; if an adapter throws, the runner
// normalizes the throw into an error ActionResult (code ACTION_ADAPTER_THREW).
// The runner never propagates raw throws to the caller.
//
// Pure types + a pure normalizer. No I/O, no platform globals.
// ============================================================================

import type { ActionEffect } from './effect.ts';

/**
 * Structured action error with stable code, message, and optional location
 * (field/path) for form validation and machine handling (ADR-018 S2).
 */
export interface ActionError {
  /** Stable error code (e.g. adapter-specific, validation, runtime). */
  code: string;
  /** Human-readable message (i18n-ready via messageKey where applicable). */
  message: string;
  /** Dotted data path for the error, e.g. `items[0].price`. */
  path?: string;
  /** Field name for form-level validation errors. */
  field?: string;
  /** Severity for triage. Defaults to `error`. */
  severity?: 'info' | 'warning' | 'error';
  /** Whether the action can be retried by the user. */
  recoverable?: boolean;
  /** Arbitrary structured details (must not contain secrets). */
  details?: Record<string, unknown>;
}

/**
 * Result status. HTTP-style numeric codes (from url adapter) coexist with
 * semantic lifecycle states used by local/model/handler adapters.
 */
export type ActionResultStatus =
  | number
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'validation-error';

/**
 * Normalized action result (ADR-018 S2). Every action path converges here.
 *
 * - `ok = false` with `errors`/`errorList` carrying validation entries triggers
 *   the `validation-error` lifecycle phase, not the generic `error` phase.
 * - `errors` is a convenience map for form validation (field → message(s)).
 * - `errorList` is the structured canonical list for machine handling.
 * - Adapters must never throw raw network/library errors past the runner.
 */
export interface ActionResult<T = unknown> {
  /** Whether the action succeeded. Authoritative; `status` is advisory. */
  ok: boolean;
  /** Status code or semantic state. */
  status: ActionResultStatus;
  /** Returned data on success. */
  data?: T;
  /** Top-level human message (may be i18n-resolved by the host). */
  message?: string;
  /**
   * Convenience map of field paths to error message(s). Drives form-level
   * validation UI. When present with ok=false, the lifecycle is
   * `validation-error` rather than generic `error`.
   */
  errors?: Record<string, string | string[]>;
  /** Structured canonical error list for machine handling. */
  errorList?: ActionError[];
  /**
   * Effects produced by the adapter, applied in addition to any local source
   * effects. Merged + ordered by the effect runner (ADR-018 S8).
   */
  effects?: ActionEffect[];
  /** Arbitrary metadata (must not contain secrets; redaction applies). */
  meta?: Record<string, unknown>;
}

/**
 * Normalize an adapter's raw return value into a well-formed ActionResult.
 *
 * Adapters SHOULD return a complete ActionResult, but to be defensive the
 * runner normalizes any partial/missing fields:
 *   - Non-object or missing `ok` → `ok: false`, `status: 'error'`.
 *   - Missing `status` → inferred from `ok` (`success` / `error`).
 *   - `errors` present but no `errorList` → `errorList` synthesized.
 *   - `errorList` present but no `errors` → `errors` not auto-derived
 *     (errorList entries may not map 1:1 to field keys).
 *
 * This never throws; it always returns a valid ActionResult.
 */
export function normalizeActionResult(raw: unknown): ActionResult {
  if (!isPlainObject(raw)) {
    return errorResult('ACTION_RESULT_MALFORMED', 'Adapter returned a non-object result.');
  }
  const r = raw as Record<string, unknown>;
  const okKnown = typeof r.ok === 'boolean';
  const ok = okKnown ? (r.ok as boolean) : false;
  const hasValidationErrors =
    (r.errors !== undefined && isNonEmpty(r.errors)) ||
    (Array.isArray(r.errorList) && (r.errorList as unknown[]).length > 0);

  let status: ActionResultStatus;
  if (r.status !== undefined && isValidStatus(r.status)) {
    status = r.status as ActionResultStatus;
  } else {
    // Infer status from ok + presence of validation errors.
    status = ok ? 'success' : hasValidationErrors ? 'validation-error' : 'error';
  }

  const result: ActionResult = {
    ok,
    status,
  };
  if (r.data !== undefined) result.data = r.data as unknown;
  if (typeof r.message === 'string') result.message = r.message;
  if (r.errors !== undefined && isPlainObject(r.errors)) {
    result.errors = r.errors as Record<string, string | string[]>;
  }
  if (Array.isArray(r.errorList)) {
    result.errorList = (r.errorList as unknown[]).filter(isActionErrorShape) as ActionError[];
  }
  // Synthesize errorList from errors when missing and ok=false.
  if (
    !ok &&
    !result.errorList &&
    result.errors
  ) {
    result.errorList = synthesizeErrorList(result.errors);
  }
  if (Array.isArray(r.effects)) {
    result.effects = r.effects as ActionEffect[];
  }
  if (r.meta !== undefined && isPlainObject(r.meta)) {
    result.meta = r.meta as Record<string, unknown>;
  }
  return result;
}

/** Build a success ActionResult with optional data + effects. */
export function successResult<T>(
  data?: T,
  opts: { effects?: ActionEffect[]; meta?: Record<string, unknown>; message?: string; status?: ActionResultStatus } = {},
): ActionResult<T> {
  const r: ActionResult<T> = { ok: true, status: opts.status ?? 'success' };
  if (data !== undefined) r.data = data;
  if (opts.effects) r.effects = opts.effects;
  if (opts.meta) r.meta = opts.meta;
  if (opts.message) r.message = opts.message;
  return r;
}

/** Build an error ActionResult with a single diagnostic entry. */
export function errorResult(
  code: string,
  message: string,
  opts: {
    recoverable?: boolean;
    field?: string;
    path?: string;
    details?: Record<string, unknown>;
    status?: ActionResultStatus;
    effects?: ActionEffect[];
  } = {},
): ActionResult {
  const err: ActionError = {
    code,
    message,
    ...(opts.field !== undefined ? { field: opts.field } : {}),
    ...(opts.path !== undefined ? { path: opts.path } : {}),
    recoverable: opts.recoverable ?? false,
    severity: 'error',
    ...(opts.details !== undefined ? { details: opts.details } : {}),
  };
  return {
    ok: false,
    status: opts.status ?? 'error',
    errorList: [err],
    ...(opts.effects ? { effects: opts.effects } : {}),
  };
}

/** Build a validation-error ActionResult from a field→message map. */
export function validationErrorResult(
  errors: Record<string, string | string[]>,
  opts: { message?: string; status?: ActionResultStatus } = {},
): ActionResult {
  return {
    ok: false,
    status: opts.status ?? 'validation-error',
    errors,
    errorList: synthesizeErrorList(errors),
    ...(opts.message ? { message: opts.message } : {}),
  };
}

/** True if a result is a validation-error (ok=false + field errors). */
export function isValidationError(result: ActionResult): boolean {
  if (result.ok) return false;
  if (result.status === 'validation-error') return true;
  return Boolean(
    (result.errors && isNonEmpty(result.errors)) ||
      (result.errorList && result.errorList.some((e) => e.field !== undefined)),
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmpty(obj: unknown): boolean {
  return isPlainObject(obj) && Object.keys(obj).length > 0;
}

function isValidStatus(s: unknown): boolean {
  if (typeof s === 'number') return true;
  return (
    s === 'idle' ||
    s === 'loading' ||
    s === 'success' ||
    s === 'error' ||
    s === 'validation-error'
  );
}

function isActionErrorShape(v: unknown): v is ActionError {
  if (!isPlainObject(v)) return false;
  return typeof v.code === 'string' && typeof v.message === 'string';
}

function synthesizeErrorList(errors: Record<string, string | string[]>): ActionError[] {
  const out: ActionError[] = [];
  for (const [field, msg] of Object.entries(errors)) {
    if (Array.isArray(msg)) {
      for (const m of msg) {
        out.push({ code: 'VALIDATION_ERROR', message: String(m), field, severity: 'error' });
      }
    } else {
      out.push({ code: 'VALIDATION_ERROR', message: String(msg), field, severity: 'error' });
    }
  }
  return out;
}
