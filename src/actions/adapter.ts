// ============================================================================
// @bitcode/ui-schema — ActionAdapter + Registry (ADR-018 S1, S7)
//
// Action adapters execute the actual mutation for handler/url/model sources.
// The `local` source does NOT use an adapter — it runs effects directly via
// the effect runner.
//
// Contract (ADR-018 S2): adapters MUST normalize all errors into ActionResult.
// They must NEVER throw raw network/library errors past the runner. If an
// adapter throws, the runner catches and normalizes it (ACTION_ADAPTER_THREW).
//
// Pure types. Implementations are host-injected (web/Flutter/RN).
// ============================================================================

import type { ActionSource } from './source.ts';
import type { ActionResult } from './result.ts';
import type { ActionRuntimeContext } from './runtime-context.ts';

/**
 * Action adapter contract. Each adapter handles one or more source types.
 *
 * Implementations:
 *   - handler: resolves HandlerActionSource by handlerKey.
 *   - url:     executes UrlActionSource via fetch/XHR (web) or http (Flutter).
 *   - model:   delegates ModelActionSource to a model provider.
 *
 * All implementations receive an AbortSignal for cooperative cancellation.
 * They should check signal.aborted at await points and stop promptly.
 */
export interface ActionAdapter {
  /**
   * The source type this adapter handles.
   * - 'handler' adapters are registered under specific handlerKeys (CustomActionRegistry).
   * - 'url' adapters are registered under the 'url' key (default).
   * - 'model' adapters are registered under 'model' or a named adapter key.
   */
  readonly kind: 'handler' | 'url' | 'model';

  /**
   * Execute the action. MUST return a normalized ActionResult. Throwing is a
   * contract violation; the runner catches throws and normalizes them to
   * ACTION_ADAPTER_THREW (ADR-018 S2).
   *
   * @param source  The action source (already validated by the runner).
   * @param payload The resolved input payload (AST payloads already evaluated
   *                by the runner in preflight; literals passed through).
   * @param ctx     The runtime context (adapters, sink, scope).
   * @param signal  Cooperative cancellation signal. Check at await points.
   */
  execute(
    source: ActionSource,
    payload: unknown,
    ctx: ActionRuntimeContext,
    signal: AbortSignal,
  ): Promise<ActionResult>;
}

/**
 * Registry mapping adapter keys to ActionAdapter instances. Used for url/model
 * adapters. Handler adapters use CustomActionRegistry (handlerKey-scoped).
 */
export interface ActionAdapterRegistry {
  /** Register an adapter under a key (e.g. 'url', 'model', 'my-custom-model'). */
  register(key: string, adapter: ActionAdapter): void;
  /** Resolve an adapter by key. Undefined when not registered. */
  resolve(key: string): ActionAdapter | undefined;
  /** Whether a key is registered. */
  has(key: string): boolean;
  /** All registered keys (for diagnostics). */
  keys(): string[];
}

/**
 * Default in-memory ActionAdapterRegistry implementation. Hosts may provide
 * their own; this is a convenience for tests and simple setups.
 */
export class InMemoryActionAdapterRegistry implements ActionAdapterRegistry {
  private readonly adapters = new Map<string, ActionAdapter>();

  register(key: string, adapter: ActionAdapter): void {
    if (this.adapters.has(key)) {
      throw new Error(
        `ActionAdapterRegistry: adapter '${key}' is already registered. ` +
          `Call unregister first or use a different key.`,
      );
    }
    this.adapters.set(key, adapter);
  }

  /** Remove a registered adapter (test/demo convenience). */
  unregister(key: string): boolean {
    return this.adapters.delete(key);
  }

  resolve(key: string): ActionAdapter | undefined {
    return this.adapters.get(key);
  }

  has(key: string): boolean {
    return this.adapters.has(key);
  }

  keys(): string[] {
    return Array.from(this.adapters.keys());
  }
}
