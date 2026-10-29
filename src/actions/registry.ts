// ============================================================================
// @bitcode/ui-schema — Custom Action Registry / Allowlist (Task 5)
//
// Maps `handlerKey` strings (from HandlerActionSource) to ActionAdapter
// instances. This is the explicit allowlist mechanism for custom actions:
// hosts register named handlers; the runner resolves them by key. Unknown
// keys fail loudly with ACTION_ADAPTER_MISSING.
//
// No auto-discovery. No hidden globals. The host controls exactly which
// handlers are available (Amendment: no hidden globals).
//
// The registry is also the security boundary: a handlerKey not in the
// allowlist CANNOT execute. This prevents arbitrary handler injection from
// untrusted JSON (catalog entries reference handlerKeys; only registered
// keys run).
// ============================================================================

import type { ActionAdapter } from './adapter.ts';

/**
 * Allowlist registry for handler-scoped action adapters. Each entry maps a
 * `handlerKey` to an ActionAdapter. The runner resolves HandlerActionSource
 * through this registry.
 */
export interface CustomActionRegistry {
  /** Register a handler adapter under a key. Throws on duplicate. */
  register(handlerKey: string, adapter: ActionAdapter): void;
  /** Resolve a handler adapter by key. Undefined when not registered. */
  resolve(handlerKey: string): ActionAdapter | undefined;
  /** Whether a handler key is registered. */
  has(handlerKey: string): boolean;
  /** All registered handler keys (for diagnostics). */
  keys(): string[];
}

/**
 * Default in-memory CustomActionRegistry. Throws on duplicate registration
 * to catch accidental key collisions loudly. Hosts may provide their own
 * implementation (e.g. backed by a DI container).
 */
export class InMemoryCustomActionRegistry implements CustomActionRegistry {
  private readonly handlers = new Map<string, ActionAdapter>();

  register(handlerKey: string, adapter: ActionAdapter): void {
    if (this.handlers.has(handlerKey)) {
      throw new Error(
        `CustomActionRegistry: handler '${handlerKey}' is already registered.`,
      );
    }
    if (adapter.kind !== 'handler') {
      throw new Error(
        `CustomActionRegistry: adapter for '${handlerKey}' must have kind 'handler', got '${adapter.kind}'.`,
      );
    }
    this.handlers.set(handlerKey, adapter);
  }

  /** Remove a registered handler (test/demo convenience). */
  unregister(handlerKey: string): boolean {
    return this.handlers.delete(handlerKey);
  }

  resolve(handlerKey: string): ActionAdapter | undefined {
    return this.handlers.get(handlerKey);
  }

  has(handlerKey: string): boolean {
    return this.handlers.has(handlerKey);
  }

  keys(): string[] {
    return Array.from(this.handlers.keys());
  }
}
