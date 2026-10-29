// ============================================================================
// @bitcode/ui-schema — Block Renderer Runtime Validator (ADR-017 §8, §5)
//
// Runtime host validation: checks that the RuntimeContext (registry +
// adapters + functions) satisfies a catalog entry's declared requirements
// before dispatch. Emits typed `BLOCK_RENDER_*` diagnostics. Does NOT perform
// build-time cross-package gates (web/flutter source/export) — those are the
// P4 catalog validator's job. This validator only checks the runtime surface.
//
// Pure functions: never throw; return typed diagnostics.
// ============================================================================

import type { BlockCatalogDiagnostic } from '../block-catalog/validate.ts';
import type { BlockCatalogEntry, RequiredComponent, RequiredFunction } from '../block-catalog/types.ts';
import type { BlockComponentRegistry } from './registry-contract.ts';
import type { BlockPlatform } from '../block-catalog/types.ts';
import { BLOCK_RENDER_DIAGNOSTIC_CODES } from './types.ts';

/**
 * The runtime adapter/function availability surface. The host provides this
 * (built from the RuntimeContext + function registry). The validator checks
 * declared requirements against it without coupling to the full RuntimeContext
 * shape (which is action-specific).
 */
export interface RuntimeAvailability {
  /** Portable component registry (for requiredComponents checks). */
  componentRegistry: BlockComponentRegistry;
  /** Registered function names (for requiredFunctions checks). */
  registeredFunctions: ReadonlySet<string>;
  /** Registered adapter names (for requiredAdapters checks). */
  registeredAdapters: ReadonlySet<string>;
  /** The target rendering platform (for platform-support checks). */
  platform?: BlockPlatform;
}

function push(
  diagnostics: BlockCatalogDiagnostic[],
  entryId: string | undefined,
  code: string,
  message: string,
  fieldPath?: string,
  suggestedFix?: string,
): void {
  diagnostics.push({
    code,
    severity: 'error',
    entryId,
    fieldPath,
    message,
    suggestedFix,
  });
}

/** Extract the canonical key from a RequiredComponent union. */
function requiredComponentKey(rc: RequiredComponent): string {
  return typeof rc === 'string' ? rc : rc.key;
}

/** Extract the canonical name from a RequiredFunction union. */
function requiredFunctionName(rf: RequiredFunction): string {
  return typeof rf === 'string' ? rf : rf.name;
}

/**
 * Validate that a catalog entry's declared requirements are satisfied by the
 * runtime availability surface. Returns diagnostics (empty when all satisfied).
 *
 * Checks:
 *   - requiredComponents: each key is registered in the component registry.
 *     When `platform` is provided, the component's supportedPlatforms must
 *     include it (else BLOCK_PLATFORM_UNSUPPORTED).
 *   - requiredFunctions: each name is in the registered function set.
 *   - requiredAdapters: each name is in the registered adapter set.
 *
 * Optional requirements (component-level `optional: true`) do not emit errors
 * when absent; they emit no diagnostic at all (truly optional).
 */
export function validateRuntimeRequirements(
  entry: BlockCatalogEntry,
  availability: RuntimeAvailability,
): BlockCatalogDiagnostic[] {
  const diagnostics: BlockCatalogDiagnostic[] = [];
  const id = entry.id;
  const reg = availability.componentRegistry;
  const platform = availability.platform;

  // Required components.
  if (entry.requiredComponents) {
    for (const rc of entry.requiredComponents) {
      const key = requiredComponentKey(rc);
      const optional = typeof rc === 'object' && rc.optional === true;
      if (optional) continue; // truly optional — skip.
      if (!reg.has(key)) {
        push(
          diagnostics,
          id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.COMPONENT_MISSING,
          `Required component '${key}' is not registered in the block component registry.`,
          'requiredComponents',
          `Register '${key}' in the platform block component registry before rendering this block.`,
        );
        continue;
      }
      // Platform support check.
      if (platform) {
        const meta = reg.resolve(key);
        const supported = meta?.supportedPlatforms;
        if (supported && supported.length > 0 && !supported.includes(platform)) {
          push(
            diagnostics,
            id,
            BLOCK_RENDER_DIAGNOSTIC_CODES.PLATFORM_UNSUPPORTED,
            `Required component '${key}' does not support platform '${platform}' (supports: ${supported.join(', ')}).`,
            'requiredComponents',
            `Provide a '${platform}' implementation for '${key}' or render on a supported platform.`,
          );
        }
      }
    }
  }

  // Required functions.
  if (entry.requiredFunctions) {
    for (const rf of entry.requiredFunctions) {
      const name = requiredFunctionName(rf);
      if (!availability.registeredFunctions.has(name)) {
        push(
          diagnostics,
          id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.FUNCTION_MISSING,
          `Required function '${name}' is not registered.`,
          'requiredFunctions',
          `Register the function in the function registry before rendering this block.`,
        );
      }
    }
  }

  // Required adapters.
  if (entry.requiredAdapters) {
    for (const ra of entry.requiredAdapters) {
      const name = typeof ra === 'string' ? ra : ra.name;
      const optional = typeof ra === 'object' && ra.optional === true;
      if (optional) continue;
      if (!availability.registeredAdapters.has(name)) {
        push(
          diagnostics,
          id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.ADAPTER_MISSING,
          `Required adapter '${name}' is not registered.`,
          'requiredAdapters',
          `Register the adapter in the runtime context before rendering this block.`,
        );
      }
    }
  }

  return diagnostics;
}

/**
 * Build a RuntimeAvailability view from an ActionRuntimeContext + component
 * registry + function set. Convenience for callers that already hold an
 * action context. Adapters are derived from the context's adapter set keys
 * plus the action adapter registry keys passed in.
 */
export function availabilityFromContext(
  componentRegistry: BlockComponentRegistry,
  registeredFunctions: ReadonlySet<string>,
  registeredAdapters: ReadonlySet<string>,
  platform?: BlockPlatform,
): RuntimeAvailability {
  return {
    componentRegistry,
    registeredFunctions,
    registeredAdapters,
    platform,
  };
}

// Suppress unused-import lint for ActionRuntimeContext (kept for future
// availabilityFromContext signature parity; platform bindings pass it through).
export type { ActionRuntimeContext } from '../actions/runtime-context.ts';
