// ============================================================================
// @bitcode/ui-schema — ActionSource (ADR-018 S1)
//
// ActionSource is the write/mutation mirror of DataSource (ADR-002 read
// contract). It is a serializable, portable mutation descriptor consumed by
// the ActionRunner. Four variants cover the full mutation surface:
//
//   - local:   resolved entirely by the runtime (setValue, navigate, emit, ...).
//   - handler: host-injected code resolved by handlerKey (NOT serializable
//              for Ready Catalog JSON; allowed in application code).
//   - url:     invokes an HTTP endpoint via a registered action adapter.
//   - model:   delegates to a registered model adapter (BitCode, REST, GraphQL,
//              SQLite, mock, ...). Permission checks are adapter-owned, not
//              hardcoded RBAC in catalog schema.
//
// GET-like reads remain DataSource, not ActionSource. Secrets/tokens/api-keys
// must never be embedded here; auth belongs to adapters.
//
// Pure types + type guards.
// ============================================================================

import type { PortableExpression } from '../expressions/ast.ts';
import type { ActionEffect } from './effect.ts';

/** Discriminator for the four ActionSource variants. */
export type ActionSourceType = 'local' | 'handler' | 'url' | 'model';

/**
 * ActionSource discriminated union (ADR-018 S1). Tagged via `type`.
 */
export type ActionSource =
  | LocalActionSource
  | HandlerActionSource
  | UrlActionSource
  | ModelActionSource;

/** Serializable action resolved by the runtime. Used for set/reset/navigate/emit. */
export interface LocalActionSource {
  type: 'local';
  /** Declarative effects applied in deterministic order by the effect runner. */
  effects: ActionEffect[];
}

/**
 * Host-injected action resolved by `handlerKey` through the action adapter
 * registry (CustomActionRegistry).
 *
 * Rules (ADR-018 S1):
 *   - Ready Catalog JSON cannot include function bodies.
 *   - A Ready block may require a named handler only through requiredAdapters
 *     with an explicit manifest + fallback policy.
 *   - Missing handler registration is a runtime validation error.
 */
export interface HandlerActionSource {
  type: 'handler';
  /** Resolved via CustomActionRegistry. Must be registered by the host. */
  handlerKey: string;
}

/**
 * Invokes an HTTP endpoint through a registered url action adapter.
 *
 * Rules (ADR-018 S1):
 *   - GET-like reads remain DataSource.
 *   - URL actions require URL allowlist validation (host-injected UrlPolicy).
 *   - Secrets/bearer tokens/API keys must not be embedded; auth belongs to adapters.
 *   - Abort + timeout must be supported by the adapter.
 */
export interface UrlActionSource {
  type: 'url';
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  /** May be a PortableExpression (evaluated preflight) or a literal record. */
  body?: PortableExpression | Record<string, unknown>;
  /** Idempotency key for safe retries (adapter injects header). */
  idempotencyKey?: string;
}

/**
 * Delegates to a registered model adapter. General-purpose, not BitCode-specific.
 * The adapter decides backend (BitCode engine, REST, GraphQL, SQLite, mock).
 *
 * Rules (ADR-018 S1):
 *   - Permission checks are adapter/runtime responsibilities.
 *   - `custom` operations must be named + declared in requiredAdapters.
 */
export interface ModelActionSource {
  type: 'model';
  /** Model name (e.g. `crm.contact`). */
  model: string;
  operation: 'create' | 'update' | 'delete' | 'upsert' | 'restore' | 'custom';
  /** Record id (for update/delete/upsert/restore). May be a PortableExpression. */
  id?: PortableExpression;
  /** Payload (for create/update/upsert). May be a PortableExpression or literal. */
  payload?: PortableExpression | Record<string, unknown>;
  /** Named adapter; default `model`. Resolved via ActionAdapterRegistry. */
  adapter?: string;
  /** Required for `custom` operations (named + documented). */
  customOperation?: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isLocalActionSource(s: ActionSource): s is LocalActionSource {
  return s.type === 'local';
}

export function isHandlerActionSource(s: ActionSource): s is HandlerActionSource {
  return s.type === 'handler';
}

export function isUrlActionSource(s: ActionSource): s is UrlActionSource {
  return s.type === 'url';
}

export function isModelActionSource(s: ActionSource): s is ModelActionSource {
  return s.type === 'model';
}

/** All valid action source types (used by validators). */
export const ACTION_SOURCE_TYPES: ReadonlySet<ActionSourceType> = new Set([
  'local',
  'handler',
  'url',
  'model',
]);

/** True if `t` is a known action source type. */
export function isActionSourceType(t: string): t is ActionSourceType {
  return ACTION_SOURCE_TYPES.has(t as ActionSourceType);
}
