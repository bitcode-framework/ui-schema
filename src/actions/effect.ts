// ============================================================================
// @bitcode/ui-schema — ActionEffect (ADR-018 S4)
//
// Effects are typed, safe, declarative, and intentionally small. No arbitrary
// string command execution is allowed. Effects never embed executable code.
//
// The effect runner (effect-runner.ts) groups effects into 5 deterministic
// tiers and routes each through the injectable EffectSink + context adapters.
// The runner never mutates a store directly (Amendment 3).
//
// Pure types only.
// ============================================================================

import type { PortableExpression } from '../expressions/ast.ts';
import type { ActionError } from './result.ts';

/**
 * A declarative side effect produced by an action (ADR-018 S4).
 *
 * Effect kinds are a closed, governed set for v1. Adding a kind requires
 * updating the deterministic ordering table in effect-runner.ts AND parity
 * tests. New effect kinds must be reviewed (ADR-018 risk: ActionRunner
 * becomes too broad).
 *
 * Effects are declarative: they describe WHAT should happen, not HOW. The
 * how is resolved by the host via EffectSink + adapters.
 */
export type ActionEffect =
  /** Set a value at a path in the host state (form field, cell, etc.). */
  | SetValueEffect
  /** Set metadata at a path (e.g. visibility, loading flags). */
  | SetMetaEffect
  /** Set a field error (validation feedback). */
  | SetErrorEffect
  /** Re-fetch a data source key (re-query). */
  | RefreshDataSourceEffect
  /** Invalidate a cached key (mark stale without immediate refetch). */
  | InvalidateKeyEffect
  /** Show a toast notification. */
  | ToastEffect
  /** Navigate to a route. */
  | NavigateEffect
  /** Close an overlay/dialog/drawer. */
  | CloseOverlayEffect
  /** Reset a form or form scope. */
  | ResetFormEffect
  /** Emit a typed application event (limited, not a shell for commands). */
  | EmitEffect;

export interface SetValueEffect {
  type: 'setValue';
  path: string;
  /**
   * Value to set. May be a literal (applied directly) or a PortableExpression
   * (evaluated by the host against the post-action scope). The effect runner
   * evaluates AST values before routing to the sink.
   */
  value: PortableExpression | unknown;
}

export interface SetMetaEffect {
  type: 'setMeta';
  path: string;
  meta: Record<string, unknown>;
}

export interface SetErrorEffect {
  type: 'setError';
  path: string;
  error: string | ActionError;
}

export interface RefreshDataSourceEffect {
  type: 'refreshDataSource';
  key: string;
}

export interface InvalidateKeyEffect {
  type: 'invalidateKey';
  key: string;
}

export interface ToastEffect {
  type: 'toast';
  level: 'info' | 'success' | 'warning' | 'error';
  /** i18n key; resolved by the host I18nAdapter. */
  messageKey?: string;
  /** English fallback message (required, per ADR-017 i18n gate). */
  fallbackMessage: string;
}

export interface NavigateEffect {
  type: 'navigate';
  to: string;
  replace?: boolean;
  params?: Record<string, unknown>;
}

export interface CloseOverlayEffect {
  type: 'closeOverlay';
  overlayId?: string;
}

export interface ResetFormEffect {
  type: 'resetForm';
  formId?: string;
  scope?: string;
}

export interface EmitEffect {
  type: 'emit';
  /** Typed application event name (must be declared in host event registry). */
  event: string;
  payload?: unknown;
}

/** All valid effect kinds (used by validators). */
export const ACTION_EFFECT_KINDS: ReadonlySet<ActionEffect['type']> = new Set([
  'setValue',
  'setMeta',
  'setError',
  'refreshDataSource',
  'invalidateKey',
  'toast',
  'navigate',
  'closeOverlay',
  'resetForm',
  'emit',
]);

/** True if `kind` is a known effect kind. */
export function isActionEffectKind(kind: string): kind is ActionEffect['type'] {
  return ACTION_EFFECT_KINDS.has(kind as ActionEffect['type']);
}

// ---------------------------------------------------------------------------
// Deterministic ordering (ADR-018 S8)
// ---------------------------------------------------------------------------

/**
 * Deterministic effect tiers. Effects within a tier run in their declared
 * array order; tiers run in fixed sequence. Rationale (ADR-018 S8):
 *   1. State mutation before data refresh.
 *   2. Data refresh before navigation.
 *   3. UI notifications reflect final state.
 *   4. Navigation is late to avoid losing local state.
 *   5. emit is last so observers see the final snapshot.
 */
export const EFFECT_TIER_ORDER: ReadonlyArray<readonly ActionEffect['type'][]> = [
  ['setValue', 'setMeta', 'setError'], // tier 1: state mutation
  ['invalidateKey', 'refreshDataSource'], // tier 2: data invalidation/refresh
  ['toast', 'closeOverlay', 'resetForm'], // tier 3: UI notifications
  ['navigate'], // tier 4: navigation
  ['emit'], // tier 5: event emission
];

/** Tier index (0-based) for an effect kind. */
export function effectTier(kind: ActionEffect['type']): number {
  for (let i = 0; i < EFFECT_TIER_ORDER.length; i++) {
    if (EFFECT_TIER_ORDER[i].includes(kind)) return i;
  }
  // Unknown kinds should never reach here (validator rejects them), but
  // defensively route to the last tier so they don't jump ahead.
  return EFFECT_TIER_ORDER.length - 1;
}
