// ============================================================================
// @bitcode/ui-schema — Block Component Registry Contract (ADR-017 §5, §8)
//
// The PORTABLE registry interface. Stores COMPONENT METADATA ONLY — never a
// framework component object (amendment 3: the portable layer must not be
// tainted by framework references). Platform bindings (web/flutter) maintain
// a parallel registry that maps `componentKey` to the actual framework
// component/widget.
//
// The renderer engine consults this registry to validate that required
// components are registered (ADR-017 §4 web/flutter component gates) and to
// emit `BLOCK_COMPONENT_MISSING` diagnostics when they are absent. It never
// instantiates a component from here.
//
// Pure types + a default in-memory implementation. No framework deps.
// ============================================================================

import type { ComponentMetadata } from './types.ts';

/**
 * Portable block component registry. Stores metadata keyed by canonical
 * component key. Implementations:
 *   - `InMemoryBlockComponentRegistry` (here) — default for tests/simple hosts.
 *   - Web registry in packages/ui — wraps this AND maps key to component.
 *   - Flutter registry in packages/ui-flutter — wraps this AND maps key to widget.
 *
 * Duplicate registration throws by default (catches accidental key collisions
 * loudly). Hosts may provide an implementation that allows replacement in
 * test/demo mode if they need hot-swap semantics.
 */
export interface BlockComponentRegistry {
  /** Register component metadata under its canonical key. Throws on duplicate. */
  register(meta: ComponentMetadata): void;
  /** Resolve metadata by canonical key. Undefined when not registered. */
  resolve(componentKey: string): ComponentMetadata | undefined;
  /** Whether a canonical key is registered. */
  has(componentKey: string): boolean;
  /** All registered canonical keys (for diagnostics). */
  keys(): string[];
}

/**
 * Default in-memory registry. Throws on duplicate registration to surface key
 * collisions loudly (ADR-017 §5.2: registry must fail loudly on duplicate keys
 * unless replacement is explicitly allowed in test/demo mode).
 */
export class InMemoryBlockComponentRegistry implements BlockComponentRegistry {
  private readonly components = new Map<string, ComponentMetadata>();

  register(meta: ComponentMetadata): void {
    if (!meta || typeof meta.componentKey !== 'string' || meta.componentKey.length === 0) {
      throw new Error(
        'BlockComponentRegistry.register: metadata.componentKey must be a non-empty string.',
      );
    }
    if (this.components.has(meta.componentKey)) {
      throw new Error(
        `BlockComponentRegistry: component '${meta.componentKey}' is already registered. ` +
          `Call unregister first or use a different key.`,
      );
    }
    this.components.set(meta.componentKey, { ...meta });
  }

  /** Remove a registered component (test/demo convenience). */
  unregister(componentKey: string): boolean {
    return this.components.delete(componentKey);
  }

  resolve(componentKey: string): ComponentMetadata | undefined {
    return this.components.get(componentKey);
  }

  has(componentKey: string): boolean {
    return this.components.has(componentKey);
  }

  keys(): string[] {
    return Array.from(this.components.keys());
  }
}
