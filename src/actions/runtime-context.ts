// ============================================================================
// @bitcode/ui-schema — ActionRuntimeContext + Adapters (ADR-018 S7)
//
// The explicit, per-instance context the ActionRunner reads from. No mutable
// singleton registry is required (ADR-018 S7). The runner reads ONLY from the
// passed context. Host apps may seed the context from a singleton, but the
// runner never reaches into globals.
//
// Amendment 3: EffectSink is injectable — the runner never mutates a store.
// Amendment 4: PermissionAdapter is OPTIONAL. The runner reads
//   scope.permissions (from F's ExpressionScope) as the permission source.
//   PermissionAdapter is only for host-side async enrichment.
// Amendment 5: UrlPolicy is host-injected, never hardcoded/global.
//
// Pure types. No platform globals.
// ============================================================================

import type { ExpressionScope, PermissionSnapshot } from '../expressions/scope.ts';
import type { ActionError } from './result.ts';

/**
 * Sink for declarative effects. The host implements this to route effects to
 * its state layer (ReactiveStore on web, ChangeNotifier on Flutter, etc.).
 *
 * The runner calls these methods in deterministic tier order (effect-runner.ts).
 * The sink is responsible for applying the change; the runner never mutates
 * state directly (Amendment 3).
 *
 * All methods are synchronous-by-contract: effect application is a committed
 * state change, not an async operation. If a sink needs async work (e.g.
 * refetch after invalidateKey), it should trigger it fire-and-forget and
 * return immediately.
 */
export interface EffectSink {
  setValue(path: string, value: unknown): void;
  setMeta(path: string, meta: Record<string, unknown>): void;
  setError(path: string, error: string | ActionError): void;
  refreshDataSource(key: string): void;
  invalidateKey(key: string): void;
  closeOverlay(overlayId?: string): void;
  resetForm(formId?: string, scope?: string): void;
  emit(event: string, payload?: unknown): void;
}

/**
 * Optional host-side adapters. Each is optional; the runner degrades
 * gracefully (fail-loud with ACTION_EFFECT_ADAPTER_MISSING only when an effect
 * requires a missing adapter).
 */
export interface ActionAdapterSet {
  /** Permission enrichment (optional — Amendment 4). */
  permission?: PermissionAdapter;
  /** Navigation (required for `navigate` effect). */
  navigation?: NavigationAdapter;
  /** Toast (required for `toast` effect). */
  toast?: ToastAdapter;
  /** i18n (required for toast messageKey resolution). */
  i18n?: I18nAdapter;
  /** URL allowlist policy (optional — Amendment 5). */
  urlPolicy?: UrlPolicy;
}

/**
 * Optional permission adapter. Used ONLY for host-side async permission
 * enrichment before evaluation (Amendment 4). The runner does NOT require
 * this; it reads scope.permissions directly.
 */
export interface PermissionAdapter {
  /** Build/enrich a permission-filtered scope for the current session. */
  enrichScope(scope: ExpressionScope): Promise<ExpressionScope>;
  /** Re-evaluate permissions at replay time (offline, ADR-018 S9). */
  revalidate(scope: ExpressionScope): Promise<PermissionSnapshot>;
}

/** Navigation adapter (host-injected router). */
export interface NavigationAdapter {
  navigate(to: string, opts?: { replace?: boolean; params?: Record<string, unknown> }): void;
}

/** Toast adapter (host-injected notification surface). */
export interface ToastAdapter {
  show(level: 'info' | 'success' | 'warning' | 'error', message: string): void;
}

/** i18n adapter (host-injected translation). */
export interface I18nAdapter {
  t(key: string, fallback: string, vars?: Record<string, unknown>): string;
  locale(): string;
}

/**
 * Host-injected URL allowlist policy (Amendment 5). When present, url actions
 * are checked against `isAllowed` in preflight. When absent, url actions are
 * allowed by default (host responsibility to inject policy for safety).
 */
export interface UrlPolicy {
  isAllowed(url: string, method: string): boolean;
}

/**
 * Redaction configuration. Applied to lifecycle event payload + result.data
 * top-level keys before emission (ADR-018 S9).
 */
export interface RedactConfig {
  /** Field paths (top-level keys) to redact. */
  fields: string[];
  /** `remove` deletes; `mask` replaces with '***'. */
  mode: 'remove' | 'mask';
}

/**
 * The explicit, per-instance runtime context. The runner reads only from this
 * object. No globals, no singletons required (ADR-018 S7).
 *
 * Construction is the host's responsibility. The runner validates required
 * pieces exist before running (validate.ts).
 */
export interface ActionRuntimeContext {
  /** Form/page values (the primary state surface). */
  values: Record<string, unknown>;
  /** Field/record metadata (visibility, loading, ...). */
  meta: Record<string, unknown>;
  /** Data source snapshots (record lists, lookups). */
  data: Record<string, unknown>;
  /**
   * The base expression scope for the action (values/meta/data/services merged
   * with permissions). The runner builds a permission-filtered copy from this
   * via buildPermissionFilteredScope (Agent F) before evaluating payloads.
   */
  scope: ExpressionScope;
  /** Host-side adapter set (all optional individually). */
  adapters: ActionAdapterSet;
  /** Sink for declarative effects (Amendment 3). Required — effects route here. */
  effectSink: EffectSink;
  /** Optional redaction config for lifecycle events. */
  redact?: RedactConfig;
  /** Optional permission snapshot (overrides scope.permissions if present). */
  permissions?: PermissionSnapshot;
}

// Re-export ExpressionScope/PermissionSnapshot types for consumer convenience
// so they don't need a second import path.
export type { ExpressionScope, PermissionSnapshot } from '../expressions/scope.ts';
