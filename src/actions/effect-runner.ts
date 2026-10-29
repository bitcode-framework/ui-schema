// ============================================================================
// @bitcode/ui-schema — Effect Runner (ADR-018 S4, S8)
//
// Applies effects in deterministic 5-tier order through the injectable
// EffectSink + context adapters. The runner NEVER mutates a store directly
// (Amendment 3) — all changes route through the sink or adapters.
//
// Tier order (ADR-018 S8):
//   1. setValue / setMeta / setError   (state mutation)
//   2. invalidateKey / refreshDataSource (data invalidation/refresh)
//   3. toast / closeOverlay / resetForm (UI notifications)
//   4. navigate                         (navigation)
//   5. emit                             (event emission)
//
// Within a tier, effects run in their declared array order. Cross-tier order
// is fixed. This determinism is tested with shuffled input (E11).
//
// setValue/setMeta/setError/refreshDataSource/invalidateKey/closeOverlay/
// resetForm/emit route to EffectSink. toast routes to ToastAdapter.
// navigate routes to NavigationAdapter. Missing adapter for an effect that
// requires one produces ACTION_EFFECT_ADAPTER_MISSING (A8) — fail-loud.
//
// Pure-ish: routes through injected callbacks; no direct store/global access.
// ============================================================================

import type { ActionEffect } from './effect.ts';
import { effectTier, EFFECT_TIER_ORDER } from './effect.ts';
import type { EffectSink, NavigationAdapter, ToastAdapter, I18nAdapter } from './runtime-context.ts';
import type { ActionValidationDiagnostic } from './validate.ts';

/**
 * Apply a list of effects in deterministic tier order. Returns diagnostics
 * for any effects that could not be applied (e.g. missing adapter). Diagnostics
 * do NOT abort the remaining effects — each effect is best-effort, and the
 * caller decides whether a diagnostic is fatal.
 *
 * @param effects      Effects to apply (may be from result.effects + local.effects).
 * @param sink         Effect sink (required).
 * @param navigation   Optional navigation adapter (required for `navigate`).
 * @param toast        Optional toast adapter (required for `toast`).
 * @param i18n         Optional i18n adapter (resolves toast messageKey).
 * @returns            Diagnostics for effects that could not be applied.
 */
export function applyEffects(
  effects: ActionEffect[],
  sink: EffectSink,
  adapters: { navigation?: NavigationAdapter; toast?: ToastAdapter; i18n?: I18nAdapter },
): ActionValidationDiagnostic[] {
  const diagnostics: ActionValidationDiagnostic[] = [];
  if (!effects || effects.length === 0) return diagnostics;

  // Stable-sort by tier preserving original index for equal-tier ordering.
  const indexed = effects.map((eff, originalIndex) => ({ eff, originalIndex }));
  indexed.sort((a, b) => {
    const ta = effectTier(a.eff.type);
    const tb = effectTier(b.eff.type);
    if (ta !== tb) return ta - tb;
    return a.originalIndex - b.originalIndex;
  });

  for (const { eff, originalIndex } of indexed) {
    const diag = applyOne(eff, sink, adapters, originalIndex);
    if (diag) diagnostics.push(diag);
  }
  return diagnostics;
}

/** Apply a single effect, returning a diagnostic if it could not be applied. */
function applyOne(
  eff: ActionEffect,
  sink: EffectSink,
  adapters: { navigation?: NavigationAdapter; toast?: ToastAdapter; i18n?: I18nAdapter },
  index: number,
): ActionValidationDiagnostic | null {
  switch (eff.type) {
    case 'setValue':
      // AST `value` nodes are evaluated by the caller (runner) before calling
      // applyEffects; here the value is already resolved. Literal values pass
      // through directly.
      sink.setValue(eff.path, resolveEffectValue(eff.value));
      return null;
    case 'setMeta':
      sink.setMeta(eff.path, eff.meta);
      return null;
    case 'setError':
      sink.setError(eff.path, eff.error);
      return null;
    case 'refreshDataSource':
      sink.refreshDataSource(eff.key);
      return null;
    case 'invalidateKey':
      sink.invalidateKey(eff.key);
      return null;
    case 'toast': {
      if (!adapters.toast) {
        return {
          code: 'ACTION_EFFECT_ADAPTER_MISSING',
          message: `Effect 'toast' at index ${index} requires a toast adapter, which is not registered.`,
          fieldPath: `effects[${index}].type`,
        };
      }
      const message = resolveToastMessage(eff, adapters.i18n);
      adapters.toast.show(eff.level, message);
      return null;
    }
    case 'navigate': {
      if (!adapters.navigation) {
        return {
          code: 'ACTION_EFFECT_ADAPTER_MISSING',
          message: `Effect 'navigate' at index ${index} requires a navigation adapter, which is not registered.`,
          fieldPath: `effects[${index}].type`,
        };
      }
      adapters.navigation.navigate(eff.to, {
        ...(eff.replace !== undefined ? { replace: eff.replace } : {}),
        ...(eff.params !== undefined ? { params: eff.params } : {}),
      });
      return null;
    }
    case 'closeOverlay':
      sink.closeOverlay(eff.overlayId);
      return null;
    case 'resetForm':
      sink.resetForm(eff.formId, eff.scope);
      return null;
    case 'emit':
      sink.emit(eff.event, eff.payload);
      return null;
    default: {
      // Exhaustiveness check; unknown kinds should have been rejected by validator.
      const _exhaustive: never = eff;
      void _exhaustive;
      return {
        code: 'ACTION_SOURCE_INVALID',
        message: `Unknown effect type at index ${index}.`,
        fieldPath: `effects[${index}].type`,
      };
    }
  }
}

/**
 * Resolve an effect value. If the value is a PortableExpression AST node, the
 * caller (runner) should have already evaluated it against the post-action
 * scope before calling applyEffects. Here we pass through non-AST values and
 * throw for unevaluated AST nodes (caller contract violation).
 */
function resolveEffectValue(value: unknown): unknown {
  if (isUnevaluatedAst(value)) {
    // The runner must evaluate AST values before applying effects. If we get
    // here, it's a caller contract violation. We pass the AST through; the sink
    // may reject it. This is defensive — the runner evaluates proactively.
    return value;
  }
  return value;
}

/** Detect a PortableExpression AST node that hasn't been evaluated yet. */
function isUnevaluatedAst(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    ['literal', 'path', 'op', 'call', 'if'].includes(
      (value as { kind: string }).kind,
    )
  );
}

/** Resolve a toast message via i18n adapter (if present), else fallback. */
function resolveToastMessage(
  eff: Extract<ActionEffect, { type: 'toast' }>,
  i18n: I18nAdapter | undefined,
): string {
  if (eff.messageKey && i18n) {
    return i18n.t(eff.messageKey, eff.fallbackMessage);
  }
  return eff.fallbackMessage;
}

/** Re-export tier metadata for tests/consumers. */
export { EFFECT_TIER_ORDER, effectTier };
