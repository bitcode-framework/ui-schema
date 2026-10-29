// ============================================================================
// @bitcode/ui-schema — BlockRenderer Engine (ADR-017 §3, ADR-006 Pure tier)
//
// The portable block composition engine. Consumes a BlockNode tree + runtime
// context, emits a ResolvedBlockTree of RENDER PLANS. NEVER emits framework
// output (no JSX/React/Mitosis/Flutter widgets) — platform bindings translate
// the plans into actual rendering.
//
// Responsibilities (ADR-017 §3 resolution order):
//   1. Resolve catalog entry by id (+ optional version).
//   2. Readiness gate: reject candidate/deprecated unless allowCandidate.
//   3. Validate runtime requirements (components/functions/adapters).
//   4. Evaluate visible/disabled/readOnly bindings (AST via F evaluator).
//   5. Build permission-filtered expression scope (F API, no reimplementation).
//   6. Strategy switch -> emit SchemaRenderPlan / ComponentRenderPlan /
//      HiddenPlan / DiagnosticPlan.
//   7. Bind actions as deferred ActionHandlerPlan (NOT executed at render).
//   8. Recurse children with inherited disabled/readOnly.
//
// Dependencies are injected (no globals, ADR-018 S7 discipline). The engine
// reads ONLY from the provided deps + context.
//
// Pure-ish: routes through injected evaluator/runner/catalog; no direct
// store/DOM/global access.
// ============================================================================

import type { UiSchema } from '../schema/types.ts';
import type { PortableExpression } from '../expressions/ast.ts';
import type { ExpressionEvaluator } from '../expressions/evaluator.ts';
import type { ExpressionScope } from '../expressions/scope.ts';
import { buildPermissionFilteredScope } from '../expressions/permission-scope.ts';
import type { ActionSource } from '../actions/source.ts';
import type { ActionResult } from '../actions/result.ts';
import type { ActionRuntimeContext } from '../actions/runtime-context.ts';
import type { ActionRunner } from '../actions/runner.ts';
import type { BlockCatalogEntry } from '../block-catalog/types.ts';
import type { BlockCatalogDiagnostic } from '../block-catalog/validate.ts';
import type {
  BlockBindings,
  BlockNode,
  RenderOptions,
  ResolvedBindings,
  ResolvedBlockTree,
  ActionHandlerPlan,
  RenderPlan,
  DiagnosticPlan,
} from './types.ts';
import { BLOCK_RENDER_DIAGNOSTIC_CODES } from './types.ts';
import type { BlockComponentRegistry } from './registry-contract.ts';
import { validateRuntimeRequirements } from './validate-runtime.ts';
import type { RuntimeAvailability } from './validate-runtime.ts';

/**
 * The catalog resolver the engine consults. Hosts provide an implementation
 * backed by their Ready catalog (web: generated index; flutter: Dart map).
 * Returns `undefined` for unknown ids.
 */
export interface CatalogResolver {
  resolve(id: string, version?: string): BlockCatalogEntry | undefined;
}

/**
 * Dependencies the BlockRenderer is constructed with (injected, no globals).
 *
 *   - catalog:           resolves catalog entries by id (+ version).
 *   - componentRegistry:  portable metadata registry (NO component objects).
 *   - evaluator:          optional F expression evaluator (for AST bindings).
 *   - actionRunner:       optional G action runner (wrapped in deferred plans).
 *
 * Optional deps degrade gracefully: without an evaluator, AST bindings cannot
 * be evaluated (emit BLOCK_EXPRESSION_EVAL_FAILED). Without an actionRunner,
 * action bindings produce no-op plans that reject with a typed error when run.
 */
export interface BlockRendererDeps {
  catalog: CatalogResolver;
  componentRegistry: BlockComponentRegistry;
  evaluator?: ExpressionEvaluator;
  actionRunner?: ActionRunner;
}

/**
 * The runtime scope surface the engine reads bindings from + evaluates ASTs
 * against. Built from the host's current state (form values, data snapshots,
 * meta, permissions). The engine builds a permission-filtered copy via the F
 * API before evaluating any expression.
 */
export interface BlockRenderScope {
  values: Record<string, unknown>;
  meta: Record<string, unknown>;
  data: Record<string, unknown>;
  services: Record<string, unknown>;
  permissions?: ExpressionScope['permissions'];
  args?: Record<string, unknown>;
}

function push(
  diagnostics: BlockCatalogDiagnostic[],
  entryId: string | undefined,
  code: string,
  message: string,
  fieldPath?: string,
  suggestedFix?: string,
): void {
  diagnostics.push({ code, severity: 'error', entryId, fieldPath, message, suggestedFix });
}

/**
 * BlockRenderer: portable block composition engine.
 *
 * Construct once, reuse across renders. Each render reads from its own scope
 * + options. Never holds render-specific mutable state.
 */
export class BlockRenderer {
  private readonly deps: BlockRendererDeps;

  constructor(deps: BlockRendererDeps) {
    this.deps = deps;
  }

  /**
   * Read-only access to the renderer's deps. Platform bindings use this to
   * access the component registry when setting up their own resolver slots
   * (e.g., the web BcBlockRenderer reads componentRegistry to resolve
   * framework components for ComponentRenderPlan).
   */
  getDeps(): Readonly<BlockRendererDeps> {
    return this.deps;
  }

  /**
   * Resolve a BlockNode tree into a ResolvedBlockTree of render plans.
   *
   * Never throws: failures are captured as DiagnosticPlan entries + non-fatal
   * diagnostics on the tree. The platform binding translates the tree into
   * rendered output.
   *
   * @param node          Root block node (or undefined -> empty error plan).
   * @param scope         Runtime scope (values/data/meta/permissions).
   * @param availability  Runtime availability (registry/functions/adapters).
   * @param options       Render options (allowCandidate, platform).
   */
  render(
    node: BlockNode | undefined,
    scope: BlockRenderScope,
    availability: RuntimeAvailability,
    options: RenderOptions = {},
  ): ResolvedBlockTree {
    // Null/undefined node -> diagnostic plan (accessible fallback).
    if (!node) {
      const diags: BlockCatalogDiagnostic[] = [];
      push(
        diags,
        undefined,
        BLOCK_RENDER_DIAGNOSTIC_CODES.RENDER_ABORTED,
        'Cannot render an undefined block node.',
      );
      return emptyTree(diagnosticPlan('root', diags), diags);
    }

    // Root inherits default enabled/editable/visible bindings.
    const inherited: ResolvedBindings = { visible: true, disabled: false, readOnly: false };
    return this.renderNode(node, scope, availability, options, inherited, 0);
  }

  /**
   * Resolve a single node. Recurses into children. `inherited` carries the
   * parent's resolved disabled/readOnly flags (visible is per-node, not
   * inherited — a parent hidden node prunes its whole subtree instead).
   */
  private renderNode(
    node: BlockNode,
    scope: BlockRenderScope,
    availability: RuntimeAvailability,
    options: RenderOptions,
    inherited: ResolvedBindings,
    depth: number,
  ): ResolvedBlockTree {
    const key = nodeKey(node, depth);
    const diagnostics: BlockCatalogDiagnostic[] = [];

    // Build the permission-filtered scope once for this node.
    const filteredScope = this.buildFilteredScope(scope, node.bindings);

    // Evaluate visible/disabled/readOnly bindings.
    const resolved = this.resolveBindings(node, filteredScope, inherited, diagnostics, key);

    // visible === false -> HiddenPlan, prune subtree.
    if (!resolved.visible) {
      const reason: 'literal' | 'evaluated' =
        typeof node.bindings?.visible === 'boolean' ? 'literal' : 'evaluated';
      const plan: RenderPlan = { kind: 'hidden', reason, key };
      return { plan, children: [], diagnostics, key };
    }

    // A failed `visible` AST is fatal (we cannot safely render without knowing
    // visibility). Failed `disabled`/`readOnly` ASTs are non-fatal: they fall
    // back to the inherited value and the node still renders.
    if (diagnostics.length > 0 && diagnostics.some((d) => fatalVisibleDiagnostic(d))) {
      return { plan: diagnosticPlan(key, diagnostics), children: [], diagnostics, key };
    }

    // Resolve the catalog entry (if blockId present) and run readiness gate +
    // runtime validation. Inline schemas skip catalog validation entirely.
    let entry: BlockCatalogEntry | undefined;
    if (node.blockId) {
      entry = this.deps.catalog.resolve(node.blockId, node.version);
      if (!entry) {
        push(
          diagnostics,
          node.blockId,
          BLOCK_RENDER_DIAGNOSTIC_CODES.ENTRY_NOT_FOUND,
          `Catalog entry '${node.blockId}'${node.version ? ` (version ${node.version})` : ''} was not found.`,
          'blockId',
          'Ensure the catalog is generated and the id/version are correct.',
        );
        return { plan: diagnosticPlan(key, diagnostics), children: [], diagnostics, key };
      }

      // Readiness gate (amendment 5): reject candidate/deprecated by default.
      if (
        !options.allowCandidate &&
        (entry.readiness === 'candidate' || entry.readiness === 'deprecated')
      ) {
        push(
          diagnostics,
          entry.id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.ENTRY_NOT_READY,
          `Entry '${entry.id}' is '${entry.readiness}', not 'ready'. Runtime reads only ready entries by default.`,
          'readiness',
          'Set RenderOptions.allowCandidate=true for builder/dev/diagnostic tooling, or promote the entry via the P4 catalog validator.',
        );
        return { plan: diagnosticPlan(key, diagnostics), children: [], diagnostics, key };
      }

      // Runtime requirement validation (components/functions/adapters).
      const reqDiags = validateRuntimeRequirements(entry, availability);
      if (reqDiags.length > 0) {
        diagnostics.push(...reqDiags);
        return { plan: diagnosticPlan(key, diagnostics), children: [], diagnostics, key };
      }
    }

    // Strategy switch -> produce a render plan.
    const plan = this.buildPlan(node, entry, filteredScope, resolved, diagnostics, key);

    // Bind actions as deferred plans (NOT executed here — amendment 6).
    const actions = this.bindActions(node, diagnostics);

    // Recurse children with inherited disabled/readOnly.
    const childInherited: ResolvedBindings = {
      visible: true,
      disabled: resolved.disabled,
      readOnly: resolved.readOnly,
    };
    const children = (node.children ?? []).map((child, i) =>
      this.renderNode(child, scope, availability, options, childInherited, depth + 1 + i),
    );

    return { plan, children, actions, diagnostics, key };
  }

  /**
   * Build a permission-filtered expression scope for this node. Merges node
   * bindings (values/data) into the runtime scope, then filters via the F API
   * (buildPermissionFilteredScope — no reimplementation, amendment 7).
   *
   * Permissions are passed through verbatim (NOT coerced to `{}`): when the
   * host declares no permission surface (`undefined`), the F API leaves the
   * scope structurally unchanged. Coercing to `{}` would make F treat it as
   * "present, allow-nothing" and strip all values.
   */
  private buildFilteredScope(
    scope: BlockRenderScope,
    bindings: BlockBindings | undefined,
  ): ExpressionScope {
    const mergedValues = { ...scope.values, ...(bindings?.values ?? {}) };
    const mergedData = { ...scope.data, ...(bindings?.data ?? {}) };
    // When the host declares NO permission surface (undefined), bypass F's
    // filter entirely — F treats `{}` as "present, allow-nothing" and would
    // strip every value. Only run F filtering when permissions are present.
    const base: ExpressionScope = {
      values: mergedValues,
      meta: scope.meta,
      data: mergedData,
      services: scope.services,
      permissions: scope.permissions ?? ({} as ExpressionScope['permissions']),
      args: scope.args,
    };
    if (scope.permissions === undefined) {
      return base; // no permission surface -> F leaves scope unchanged
    }
    return buildPermissionFilteredScope(base);
  }

  /**
   * Resolve the visible/disabled/readOnly bindings for a node. Literal
   * booleans are used directly; AST expressions are evaluated against the
   * filtered scope via the F evaluator. Evaluation failures emit
   * BLOCK_EXPRESSION_EVAL_FAILED diagnostics (fatal for the affected flag).
   */
  private resolveBindings(
    node: BlockNode,
    filteredScope: ExpressionScope,
    inherited: ResolvedBindings,
    diagnostics: BlockCatalogDiagnostic[],
    key: string,
  ): ResolvedBindings {
    const b = node.bindings;

    // visible: default true (not inherited — a hidden parent prunes subtree).
    const visible = evalFlag(b?.visible, true, filteredScope, this.deps.evaluator, diagnostics, key, 'visible');

    // disabled: inherits parent's disabled; AST may override.
    const disabledInherit = inherited.disabled;
    const disabled = evalFlag(
      b?.disabled,
      disabledInherit,
      filteredScope,
      this.deps.evaluator,
      diagnostics,
      key,
      'disabled',
    );

    // readOnly: inherits parent's readOnly; AST may override.
    const readOnlyInherit = inherited.readOnly;
    const readOnly = evalFlag(
      b?.readOnly,
      readOnlyInherit,
      filteredScope,
      this.deps.evaluator,
      diagnostics,
      key,
      'readOnly',
    );

    return { visible, disabled, readOnly };
  }

  /**
   * Strategy switch (ADR-017 §3): produce a SchemaRenderPlan, ComponentRenderPlan,
   * or DiagnosticPlan. NEVER renders — only prepares the plan.
   */
  private buildPlan(
    node: BlockNode,
    entry: BlockCatalogEntry | undefined,
    filteredScope: ExpressionScope,
    resolved: ResolvedBindings,
    diagnostics: BlockCatalogDiagnostic[],
    key: string,
  ): RenderPlan {
    // Inline anonymous schema (escape hatch) -> schema plan regardless of entry.
    if (!entry) {
      if (!node.schema) {
        push(
          diagnostics,
          undefined,
          BLOCK_RENDER_DIAGNOSTIC_CODES.SCHEMA_INVALID,
          'Block node has neither a blockId nor an inline schema; cannot produce a render plan.',
        );
        return diagnosticPlan(key, diagnostics);
      }
      return {
        kind: 'schema',
        schema: node.schema,
        values: filteredScope.values,
        disabled: resolved.disabled,
        readOnly: resolved.readOnly,
        key,
      };
    }

    // Catalog entry: dispatch by renderStrategy.
    if (entry.renderStrategy === 'schema') {
      const preset = entry.schemaPreset;
      if (!preset) {
        push(
          diagnostics,
          entry.id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.SCHEMA_INVALID,
          `Schema-strategy entry '${entry.id}' has no schemaPreset.`,
          'schemaPreset',
        );
        return diagnosticPlan(key, diagnostics);
      }
      return {
        kind: 'schema',
        schema: preset,
        values: { ...presetValues(preset), ...filteredScope.values },
        disabled: resolved.disabled,
        readOnly: resolved.readOnly,
        key,
      };
    }

    if (entry.renderStrategy === 'component') {
      const componentKey = entry.componentKey;
      if (!componentKey) {
        push(
          diagnostics,
          entry.id,
          BLOCK_RENDER_DIAGNOSTIC_CODES.COMPONENT_MISSING,
          `Component-strategy entry '${entry.id}' declares no componentKey.`,
          'componentKey',
          'Set componentKey on the catalog entry.',
        );
        return diagnosticPlan(key, diagnostics);
      }
      return {
        kind: 'component',
        componentKey,
        props: { ...(node.props ?? {}), disabled: resolved.disabled },
        disabled: resolved.disabled,
        key,
      };
    }

    push(
      diagnostics,
      entry.id,
      BLOCK_RENDER_DIAGNOSTIC_CODES.RENDER_STRATEGY_INVALID,
      `Entry '${entry.id}' has unknown renderStrategy '${entry.renderStrategy}'.`,
      'renderStrategy',
      'Use schema or component.',
    );
    return diagnosticPlan(key, diagnostics);
  }

  /**
   * Bind node actions as deferred ActionHandlerPlan entries. The runner is
   * captured in a closure; `run()` invokes it on a user event (NOT here).
   * Without a runner, plans reject with a typed error when called.
   */
  private bindActions(
    node: BlockNode,
    _diagnostics: BlockCatalogDiagnostic[],
  ): Record<string, ActionHandlerPlan> | undefined {
    if (!node.actions) return undefined;
    const runner = this.deps.actionRunner;
    const out: Record<string, ActionHandlerPlan> = {};
    for (const [name, source] of Object.entries(node.actions)) {
      out[name] = makeActionHandler(name, source, runner);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a binding flag. Literal booleans pass through; AST expressions are
 * evaluated against the filtered scope. On evaluation failure, emits a fatal
 * diagnostic and returns the fallback (so the node renders with the safe
 * default rather than crashing).
 */
function evalFlag(
  raw: PortableExpression | boolean | undefined,
  fallback: boolean,
  scope: ExpressionScope,
  evaluator: ExpressionEvaluator | undefined,
  diagnostics: BlockCatalogDiagnostic[],
  key: string,
  flagName: 'visible' | 'disabled' | 'readOnly',
): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === 'boolean') return raw;
  // AST expression.
  if (!evaluator) {
    push(
      diagnostics,
      undefined,
      BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED,
      `Cannot evaluate '${flagName}' AST on node '${key}': no ExpressionEvaluator is registered.`,
      `bindings.${flagName}`,
      'Register an ExpressionEvaluator (F contract) on the BlockRenderer deps.',
    );
    return fallback;
  }
  try {
    const v = evaluator.evaluate(raw, scope);
    if (typeof v === 'boolean') return v;
    // Non-boolean result: treat as fatal for this flag; return safe fallback.
    push(
      diagnostics,
      undefined,
      BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED,
      `'${flagName}' expression on node '${key}' returned non-boolean value (got ${typeof v}).`,
      `bindings.${flagName}`,
      'Ensure the expression evaluates to a boolean.',
    );
    return fallback;
  } catch (err) {
    push(
      diagnostics,
      undefined,
      BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED,
      `'${flagName}' expression on node '${key}' failed: ${errMsg(err)}.`,
      `bindings.${flagName}`,
    );
    return fallback;
  }
}

/**
 * Build a deferred ActionHandlerPlan. Captures the runner; `run()` invokes it
 * on a user event. Without a runner, rejects with a typed error (the binding
 * surfaces the failure rather than silently no-op'ing).
 */
function makeActionHandler(
  name: string,
  source: ActionSource,
  runner: ActionRunner | undefined,
): ActionHandlerPlan {
  return {
    name,
    source,
    run: (_payload: unknown, _ctx: ActionRuntimeContext): Promise<ActionResult> => {
      if (!runner) {
        return Promise.reject(
          new Error(
            `ActionHandlerPlan.run('${name}'): no ActionRunner is registered on the BlockRenderer deps.`,
          ),
        );
      }
      return runner.run(source, _payload, _ctx);
    },
  };
}

/** Stable key for a node: prefer blockId/version, else schema name, else depth. */
function nodeKey(node: BlockNode, depth: number): string {
  if (node.blockId) return node.version ? `${node.blockId}@${node.version}` : node.blockId;
  if (node.schema?.name) return node.schema.name;
  if (node.schema?.type) return `${node.schema.type}-${depth}`;
  return `node-${depth}`;
}

/** Extract default values from a schema preset (if it carries field defaults). */
function presetValues(_schema: UiSchema): Record<string, unknown> {
  // The schema preset itself does not carry runtime values; defaults are
  // host-supplied via the scope. This hook exists for future schema-level
  // default extraction without changing the signature.
  return {};
}

/** Build a DiagnosticPlan for a key + diagnostics. */
function diagnosticPlan(key: string, diagnostics: BlockCatalogDiagnostic[]): DiagnosticPlan {
  return { kind: 'error', diagnostics, key };
}

/** Build an empty ResolvedBlockTree (used for the null-node case). */
function emptyTree(plan: RenderPlan, diagnostics: BlockCatalogDiagnostic[]): ResolvedBlockTree {
  return { plan, children: [], diagnostics, key: 'root' };
}

/** True if a diagnostic represents a fatal `visible`-binding failure. Only
 *  visible failures are fatal — a disabled/readOnly evaluation failure is
 *  non-fatal (the node renders with the inherited fallback). */
function fatalVisibleDiagnostic(d: BlockCatalogDiagnostic): boolean {
  return (
    d.code === BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED &&
    d.fieldPath === 'bindings.visible'
  );
}

/** Safe error message extraction. */
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Re-export types the platform bindings need for ergonomic single-import usage.
export type { ComponentMetadata } from './types.ts';
export type { BlockPlatform } from '../block-catalog/types.ts';
