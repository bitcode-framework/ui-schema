// ============================================================================
// @bitcode/ui-schema — Block Renderer module barrel (ADR-017 §3, Agent H)
//
// Re-exports the portable block composition engine surface: block node tree,
// render plan types, registry contract, runtime validator, and the
// BlockRenderer engine.
//
// IMPORTANT (amendment 2): the engine emits RENDER PLANS only — never
// framework output. Platform bindings translate plans into actual rendering.
//
// IMPORTANT (amendment 3): the registry stores COMPONENT METADATA only —
// never framework component objects.
//
// This module is SEPARATE from the block-catalog/ module (owned by Agent L).
// Agent H owns block-renderer/ exclusively. Do not modify block-catalog/.
// ============================================================================

// Composition + plan types
export type {
  ActionHandlerPlan,
  BlockBindings,
  BlockNode,
  BlockRenderDiagnosticCode,
  ComponentMetadata,
  ComponentRenderPlan,
  DiagnosticPlan,
  HiddenPlan,
  RenderOptions,
  RenderPlan,
  ResolvedBindings,
  ResolvedBlockTree,
  SchemaRenderPlan,
} from './types.ts';

export { BLOCK_RENDER_DIAGNOSTIC_CODES } from './types.ts';

// Registry contract (metadata only)
export type { BlockComponentRegistry } from './registry-contract.ts';
export { InMemoryBlockComponentRegistry } from './registry-contract.ts';

// Runtime validator
export type { RuntimeAvailability } from './validate-runtime.ts';
export {
  availabilityFromContext,
  validateRuntimeRequirements,
} from './validate-runtime.ts';

// Engine
export type {
  BlockRenderScope,
  BlockRendererDeps,
  CatalogResolver,
} from './renderer.ts';
export { BlockRenderer } from './renderer.ts';
