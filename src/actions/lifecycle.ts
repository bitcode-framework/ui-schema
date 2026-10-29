// ============================================================================
// @bitcode/ui-schema — Action Lifecycle (ADR-018 S3)
//
// Standardized action lifecycle events. The runner emits these through an
// injectable ActionLifecycleEmitter function (platform-agnostic).
//
// On web, the host bridges the emitter to CustomEvents (bc-action-*).
// On Flutter, the host bridges to a Stream<ActionLifecycleEvent>.
// On RN, the host bridges to an EventEmitter.
//
// The runner itself never touches DOM/Flutter globals — it only calls the
// injected emitter. This keeps the runner portable (Amendment 3 + task scope).
//
// State machine (Amendment 2):
//   - Preflight failures do NOT emit `start`. They emit `error` + `settled`.
//   - `settled` fires exactly once on ALL exit paths.
//   - `start` fires at most once, only when preflight passes.
//
// Pure types + emitter contract.
// ============================================================================

import type { BcChangeMeta } from '../types.ts';
import type { ActionSource } from './source.ts';
import type { ActionResult } from './result.ts';
import type { ActionError } from './result.ts';

/** Lifecycle phase. Order matches the ADR-018 S3 event sequence. */
export type ActionPhase =
  | 'start'
  | 'success'
  | 'error'
  | 'validation-error'
  | 'settled';

/** Canonical phase order for the happy path + error paths. */
export const ACTION_PHASES: ReadonlyArray<ActionPhase> = [
  'start',
  'success',
  'error',
  'validation-error',
  'settled',
];

/**
 * Lifecycle event payload (ADR-018 S3). Field-for-field parity across web
 * CustomEvent detail and Dart/Flutter stream payloads.
 *
 * `payload` and `result.data` are redacted (via redact.ts) before emission
 * when ctx.redact is configured. Adapters see the full payload; lifecycle
 * observers see only redacted fields.
 */
export interface ActionLifecycleEvent {
  /** Stable action id (caller-provided via opts.actionId). */
  actionId: string;
  /** The action source that was run. */
  source: ActionSource;
  /** Current lifecycle phase. */
  phase: ActionPhase;
  /** Redacted input payload (present on start). */
  payload?: unknown;
  /** Redacted result (present on success/validation-error/error). */
  result?: ActionResult;
  /** Structured error (present on error/validation-error when applicable). */
  error?: ActionError;
  /** Change metadata (reason, source, nativeEvent). */
  meta: BcChangeMeta;
  /** Monotonic timestamp (ms since epoch). */
  timestamp: number;
}

/**
 * Injectable lifecycle emitter. The host provides an implementation that
 * bridges to the platform event system. The runner calls `emit(event)` for
 * each phase transition.
 *
 * The emitter is OPTIONAL: if the host passes `undefined`, the runner skips
 * lifecycle emission entirely (useful for headless tests). The runner still
 * enforces `settled`-exactly-once semantics internally regardless.
 */
export type ActionLifecycleEmitter = (event: ActionLifecycleEvent) => void;

/**
 * Build a lifecycle event with sensible defaults. Keeps runner call sites terse.
 */
export function buildLifecycleEvent(
  actionId: string,
  source: ActionSource,
  phase: ActionPhase,
  meta: BcChangeMeta,
  opts: {
    payload?: unknown;
    result?: ActionResult;
    error?: ActionError;
    timestamp?: number;
  } = {},
): ActionLifecycleEvent {
  const event: ActionLifecycleEvent = {
    actionId,
    source,
    phase,
    meta,
    timestamp: opts.timestamp ?? Date.now(),
  };
  if (opts.payload !== undefined) event.payload = opts.payload;
  if (opts.result !== undefined) event.result = opts.result;
  if (opts.error !== undefined) event.error = opts.error;
  return event;
}
