// ============================================================================
// @bitcode/ui-schema — Block Renderer Types (ADR-017 §3, ADR-006 Pure tier)
//
// The PORTABLE composition + render-plan surface. The renderer engine in this
// package NEVER emits framework output (no JSX, no React, no Mitosis, no
// Flutter widgets). It emits RENDER PLANS that platform bindings translate
// into actual rendering:
//
//   - SchemaRenderPlan   -> web: <BcRenderer schema=...>; flutter: BcRenderer
//   - ComponentRenderPlan-> web: registry component; flutter: registry widget
//   - HiddenPlan         -> render nothing (visible resolved to false)
//   - DiagnosticPlan     -> accessible fallback + typed diagnostics
//
// Pure types only. No runtime, no framework imports, no DOM/Flutter globals.
// ============================================================================

import type { UiSchema } from '../schema/types.ts';
import type { PortableExpression } from '../expressions/ast.ts';
import type { ActionSource } from '../actions/source.ts';
import type { ActionResult } from '../actions/result.ts';
import type { ActionRuntimeContext } from '../actions/runtime-context.ts';
import type {
  BlockCatalogDiagnostic,
} from '../block-catalog/validate.ts';
import type {
  BlockCategory,
  BlockCapability,
  BlockPlatform,
} from '../block-catalog/types.ts';

// ---------------------------------------------------------------------------
// Block composition tree (the input surface)
// ---------------------------------------------------------------------------

/**
 * A node in the block composition tree (ADR-017 §3 composition surface).
 *
 * A node is EITHER:
 *   - a catalog entry reference (`blockId`), resolved by id+version from the
 *     host's catalog resolver, OR
 *   - an anonymous inline schema (`schema`), the escape hatch for hosts that
 *     compose UiSchema directly without catalog metadata.
 *
 * Children compose a recursive tree. Per-node bindings (visible/disabled/
 * readOnly/values/data) are evaluated by the engine; actions are bound as
 * deferred handler plans (never executed during render — ADR-018 S8 runs
 * actions on events, not during tree resolution).
 *
 * This is the only composition type the engine consumes. It is JSON-
 * serializable-friendly for catalog/page definitions.
 */
export interface BlockNode {
  /**
   * Catalog entry id (e.g. 'content.hero') to resolve from the host catalog.
   * Mutually exclusive with `schema` (inline). When both are present, the
   * catalog entry wins and `schema` is ignored.
   */
  blockId?: string;

  /**
   * Optional version pin for the catalog entry. When omitted, the resolver
   * returns its latest compatible entry.
   */
  version?: string;

  /**
   * Anonymous inline schema (escape hatch). Mutually exclusive with `blockId`.
   * Used when a host composes UiSchema directly without catalog metadata.
   */
  schema?: UiSchema;

  /** Nested child nodes. Composed depth-first; inherited disabled/readOnly. */
  children?: BlockNode[];

  /** Per-node bindings evaluated by the engine against the runtime scope. */
  bindings?: BlockBindings;

  /**
   * Props forwarded to a component-strategy catalog entry. Ignored for
   * schema-strategy entries and anonymous inline schemas. Must be
   * serializable or adapter-resolved (ADR-017 §3 component strategy).
   */
  props?: Record<string, unknown>;

  /**
   * Named action bindings for this node. Each maps a stable trigger name
   * (e.g. 'submit', 'select', 'next') to an ActionSource. The engine binds
   * these as deferred ActionHandlerPlan entries; the platform binding wires
   * them to DOM/widget events. Actions are NEVER executed during render.
   */
  actions?: Record<string, ActionSource>;
}

/**
 * Per-node bindings evaluated by the engine. `visible`/`disabled`/`readOnly`
 * may be a literal boolean or a PortableExpression evaluated against the
 * permission-filtered scope (ADR-018 S5). When absent, the binding inherits
 * from the parent node (or defaults to visible/enabled/editable at the root).
 */
export interface BlockBindings {
  /** Form/page values merged into the schema values + expression scope. */
  values?: Record<string, unknown>;
  /**
   * Visibility. Literal boolean or AST evaluated against the filtered scope.
   * When resolved to false, the node AND its subtree become HiddenPlan.
   */
  visible?: PortableExpression | boolean;
  /** Disabled propagation. Resolved and inherited by the subtree. */
  disabled?: PortableExpression | boolean;
  /** Read-only propagation. Resolved and inherited by the subtree. */
  readOnly?: PortableExpression | boolean;
  /**
   * Data snapshots merged into the expression scope `data` root. Useful for
   * record lists / lookups backing inline schema blocks.
   */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Render plans (the portable OUTPUT — never framework objects)
// ---------------------------------------------------------------------------

/**
 * Discriminated union of render plans. The engine emits these; platform
 * bindings translate them into actual rendered output.
 *
 * This is intentionally a closed set: adding a kind is a schema-version bump
 * and requires parity on every supported platform.
 */
export type RenderPlan =
  | SchemaRenderPlan
  | ComponentRenderPlan
  | HiddenPlan
  | DiagnosticPlan;

/**
 * A schema-strategy plan. The engine materialized the catalog entry's
 * `schemaPreset` (or the inline `schema`) and merged bindings.values into it.
 * The platform binding renders this via its schema renderer (BcRenderer on
 * web, BcRenderer on Flutter). The engine does NOT render — it only prepares.
 */
export interface SchemaRenderPlan {
  kind: 'schema';
  /** Materialized, ready-to-render UiSchema. */
  schema: UiSchema;
  /** Merged form/page values for the schema renderer. */
  values: Record<string, unknown>;
  /** Resolved disabled flag (inherited or evaluated). */
  disabled: boolean;
  /** Resolved read-only flag (inherited or evaluated). */
  readOnly: boolean;
  /**
   * Stable key for the platform binding's reconciliation (derived from
   * blockId/version or inline schema name/position).
   */
  key: string;
}

/**
 * A component-strategy plan. The engine resolved the catalog entry's
 * `componentKey` and prepared the props. The platform binding resolves the
 * actual framework component from its OWN registry (the portable registry in
 * ui-schema stores metadata only — never a component object, per amendment 3).
 */
export interface ComponentRenderPlan {
  kind: 'component';
  /** Canonical component key resolved from the catalog entry. */
  componentKey: string;
  /** Resolved props (catalog defaults + node props merged). */
  props: Record<string, unknown>;
  /** Resolved disabled flag (forwarded as a prop when supported). */
  disabled: boolean;
  /** Stable key for reconciliation. */
  key: string;
}

/**
 * A hidden plan. `visible` resolved to false for this node. The subtree is
 * pruned (children are NOT rendered).
 */
export interface HiddenPlan {
  kind: 'hidden';
  /** Why the node is hidden (literal false vs evaluated false). */
  reason: 'literal' | 'evaluated';
  /** Stable key for reconciliation. */
  key: string;
}

/**
 * A diagnostic plan. Resolution failed (entry not found, not ready, runtime
 * validation failed, or an expression evaluation threw). The platform binding
 * renders an accessible, diagnostic fallback — NEVER silent null.
 */
export interface DiagnosticPlan {
  kind: 'error';
  diagnostics: BlockCatalogDiagnostic[];
  /** Stable key for reconciliation. */
  key: string;
}

/**
 * A resolved block tree node: the render plan for this node plus resolved
 * children, deferred action plans, and any non-fatal diagnostics. The engine
 * returns this shape from `BlockRenderer.render()`.
 */
export interface ResolvedBlockTree {
  /** The render plan for this node. */
  plan: RenderPlan;
  /** Resolved children (depth-first; empty for hidden/error/leaf nodes). */
  children: ResolvedBlockTree[];
  /**
   * Deferred action handler plans, keyed by trigger name. The platform
   * binding wires these to DOM/widget events; calling `run()` invokes the
   * ActionRunner. NEVER executed during render.
   */
  actions?: Record<string, ActionHandlerPlan>;
  /** Non-fatal diagnostics (e.g. a child that failed but the tree continued). */
  diagnostics: BlockCatalogDiagnostic[];
  /** Stable key for reconciliation (mirrors the plan key). */
  key: string;
}

// ---------------------------------------------------------------------------
// Deferred action handler (bound, NOT executed, at render time)
// ---------------------------------------------------------------------------

/**
 * A deferred action handler. Produced at render time so the platform binding
 * can attach it to DOM/widget events. `run()` is called when the user triggers
 * the action — it invokes the ActionRunner (ADR-018 S8). The engine NEVER
 * calls `run()` during tree resolution.
 */
export interface ActionHandlerPlan {
  /** Stable trigger name (e.g. 'submit', 'select'). */
  name: string;
  /** The bound action source (local/handler/url/model). */
  source: ActionSource;
  /**
   * Execute the action via the ActionRunner. Called by the platform binding on
   * a user event. Returns the normalized ActionResult.
   */
  run: (payload: unknown, ctx: ActionRuntimeContext) => Promise<ActionResult>;
}

// ---------------------------------------------------------------------------
// Render options + context
// ---------------------------------------------------------------------------

/**
 * Options for `BlockRenderer.render()`.
 *
 * - `allowCandidate`: by default the engine rejects `candidate`/`deprecated`
 *   entries (ADR-017 §4: runtime reads only Ready entries). Set this to true
 *   for builder/dev/diagnostic tooling that needs to inspect candidates.
 *   Production rendering leaves it false.
 * - `platform`: the rendering platform. Affects `BLOCK_PLATFORM_UNSUPPORTED`
 *   diagnostics when a required component lacks support for the target.
 */
export interface RenderOptions {
  allowCandidate?: boolean;
  platform?: BlockPlatform;
}

/**
 * Resolved binding flags after evaluating visible/disabled/readOnly. The
 * engine computes these once per node and propagates them to children.
 */
export interface ResolvedBindings {
  visible: boolean;
  disabled: boolean;
  readOnly: boolean;
}

// ---------------------------------------------------------------------------
// Registry metadata (portable — component object lives in the platform binding)
// ---------------------------------------------------------------------------

/**
 * Portable metadata about a registered component. The portable registry in
 * ui-schema stores ONLY this metadata (never a framework component object,
 * per amendment 3). Platform bindings (web/flutter) maintain a parallel
 * registry mapping `componentKey` to the actual framework component/widget.
 */
export interface ComponentMetadata {
  /** Canonical component key (e.g. 'BcGridView'). */
  componentKey: string;
  /** Catalog category the component serves (for filtering/diagnostics). */
  category?: BlockCategory;
  /** Capabilities the component provides (for capability validation). */
  capabilities?: BlockCapability[];
  /** Platforms where the component is implemented. */
  supportedPlatforms?: BlockPlatform[];
  /**
   * Optional reference to a host adapter (for components backed by a service
   * adapter rather than a direct framework object). Metadata only.
   */
  adapterRef?: string;
}

// ---------------------------------------------------------------------------
// Diagnostic codes (runtime block renderer layer)
// ---------------------------------------------------------------------------

/**
 * Stable runtime diagnostic codes produced by the block renderer. Separate
 * code space from the catalog shape validator (`BLOCK_*` shape codes live in
 * block-catalog/validate.ts) and action codes (`ACTION_*`). These are
 * renderer-specific resolution/runtime failures.
 *
 * Codes are prefixed `BLOCK_RENDER_*` to keep the renderer layer distinct.
 */
export const BLOCK_RENDER_DIAGNOSTIC_CODES = {
  ENTRY_NOT_FOUND: 'BLOCK_ENTRY_NOT_FOUND',
  ENTRY_NOT_READY: 'BLOCK_ENTRY_NOT_READY',
  COMPONENT_MISSING: 'BLOCK_COMPONENT_MISSING',
  FUNCTION_MISSING: 'BLOCK_FUNCTION_MISSING',
  ADAPTER_MISSING: 'BLOCK_ADAPTER_MISSING',
  PLATFORM_UNSUPPORTED: 'BLOCK_PLATFORM_UNSUPPORTED',
  SCHEMA_INVALID: 'BLOCK_SCHEMA_INVALID',
  RENDER_STRATEGY_INVALID: 'BLOCK_RENDER_STRATEGY_INVALID',
  EXPRESSION_EVAL_FAILED: 'BLOCK_EXPRESSION_EVAL_FAILED',
  RENDER_ABORTED: 'BLOCK_RENDER_ABORTED',
} as const;

export type BlockRenderDiagnosticCode =
  | 'BLOCK_ENTRY_NOT_FOUND'
  | 'BLOCK_ENTRY_NOT_READY'
  | 'BLOCK_COMPONENT_MISSING'
  | 'BLOCK_FUNCTION_MISSING'
  | 'BLOCK_ADAPTER_MISSING'
  | 'BLOCK_PLATFORM_UNSUPPORTED'
  | 'BLOCK_SCHEMA_INVALID'
  | 'BLOCK_RENDER_STRATEGY_INVALID'
  | 'BLOCK_EXPRESSION_EVAL_FAILED'
  | 'BLOCK_RENDER_ABORTED';
