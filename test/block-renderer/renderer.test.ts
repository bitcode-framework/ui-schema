// ============================================================================
// BlockRenderer portable engine tests (ADR-017 §3, Agent H).
//
// Covers the full required matrix:
//   - renders simple schema block
//   - renders component block
//   - nested blocks (tree traversal)
//   - unknown block/component -> typed diagnostic
//   - visible=false literal hides block
//   - visible AST expression evaluated
//   - disabled/readOnly propagation to children
//   - action binding produces a plan whose run() invokes ActionRunner
//     (amendment 6: NOT executed at render time)
//   - runtime context validation: missing component/function/adapter
//   - candidate entry: default rejects, allowCandidate renders (amendment 5)
//   - registry metadata-only semantics (amendment 3)
//
// Uses Node's native test runner, matching the ui-schema test convention.
// ============================================================================

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BlockRenderer,
  InMemoryBlockComponentRegistry,
  availabilityFromContext,
  BLOCK_RENDER_DIAGNOSTIC_CODES,
  type BlockRendererDeps,
  type BlockRenderScope,
  type CatalogResolver,
  type ComponentMetadata,
  type RenderPlan,
} from '../../src/block-renderer/index.ts';
import type { BlockCatalogEntry } from '../../src/block-catalog/types.ts';
import type { ExpressionEvaluator } from '../../src/expressions/index.ts';
import type { ExpressionScope } from '../../src/expressions/index.ts';
import {
  ActionRunner,
  InMemoryActionAdapterRegistry,
  InMemoryCustomActionRegistry,
  type ActionLifecycleEvent,
  type ActionRuntimeContext,
  type EffectSink,
} from '../../src/actions/index.ts';
import type { ActionResult } from '../../src/actions/index.ts';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function readySchemaEntry(over: Partial<BlockCatalogEntry> = {}): BlockCatalogEntry {
  return {
    id: 'content.hero',
    version: '1.0.0',
    schemaVersion: '0.1.0',
    labelKey: 'block.content.hero.title',
    fallbackLabel: 'Hero',
    category: 'content',
    channels: ['website'],
    capabilities: ['static', 'responsive'],
    renderStrategy: 'schema',
    schemaPreset: { type: 'section', title: 'Hero', sections: [] },
    requiredComponents: [],
    requiredFunctions: [],
    requiredAdapters: [],
    readiness: 'ready',
    ...over,
  };
}

function readyComponentEntry(over: Partial<BlockCatalogEntry> = {}): BlockCatalogEntry {
  return readySchemaEntry({
    id: 'interaction.notification-center',
    renderStrategy: 'component',
    componentKey: 'BcNotificationCenter',
    schemaPreset: undefined,
    requiredComponents: [{ key: 'BcNotificationCenter', platforms: ['web', 'flutter'] }],
    capabilities: ['data-source', 'action-source'],
    ...over,
  });
}

function mapCatalog(entries: BlockCatalogEntry[]): CatalogResolver {
  const map = new Map<string, BlockCatalogEntry>();
  for (const e of entries) map.set(e.id, e);
  return {
    resolve(id, _version) {
      return map.get(id);
    },
  };
}

function emptyScope(over: Partial<BlockRenderScope> = {}): BlockRenderScope {
  return { values: {}, meta: {}, data: {}, services: {}, ...over };
}

function availability(over: {
  registry?: InMemoryBlockComponentRegistry;
  functions?: string[];
  adapters?: string[];
  platform?: 'web' | 'flutter' | 'react-native' | 'server';
} = {}) {
  const registry = over.registry ?? new InMemoryBlockComponentRegistry();
  return availabilityFromContext(
    registry,
    new Set(over.functions ?? []),
    new Set(over.adapters ?? []),
    over.platform,
  );
}

/** Build a renderer with a stub evaluator that returns scripted values per call. */
function makeRenderer(deps: Partial<BlockRendererDeps> = {}): BlockRenderer {
  return new BlockRenderer({
    catalog: deps.catalog ?? mapCatalog([]),
    componentRegistry: deps.componentRegistry ?? new InMemoryBlockComponentRegistry(),
    evaluator: deps.evaluator,
    actionRunner: deps.actionRunner,
  });
}

// ---------------------------------------------------------------------------
// Schema-strategy rendering
// ---------------------------------------------------------------------------

test('renders a simple schema block -> SchemaRenderPlan', () => {
  const catalog = mapCatalog([readySchemaEntry()]);
  const r = makeRenderer({ catalog });
  const tree = r.render({ blockId: 'content.hero' }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'schema');
  const p = tree.plan as Extract<RenderPlan, { kind: 'schema' }>;
  assert.equal(p.schema.type, 'section');
  assert.equal(p.disabled, false);
  assert.equal(p.readOnly, false);
  assert.equal(p.key, 'content.hero');
  assert.equal(tree.children.length, 0);
});

test('renders an inline anonymous schema block (no catalog entry)', () => {
  const r = makeRenderer();
  const tree = r.render(
    { schema: { type: 'form', name: 'loginForm', fields: [] } },
    emptyScope(),
    availability(),
  );
  assert.equal(tree.plan.kind, 'schema');
  const p = tree.plan as Extract<RenderPlan, { kind: 'schema' }>;
  assert.equal(p.schema.type, 'form');
  assert.equal(p.key, 'loginForm');
});

// ---------------------------------------------------------------------------
// Component-strategy rendering
// ---------------------------------------------------------------------------

test('renders a component block -> ComponentRenderPlan with componentKey + props', () => {
  const entry = readyComponentEntry();
  const registry = new InMemoryBlockComponentRegistry();
  registry.register({
    componentKey: 'BcNotificationCenter',
    category: 'interaction',
    supportedPlatforms: ['web', 'flutter'],
  });
  const r = makeRenderer({ catalog: mapCatalog([entry]), componentRegistry: registry });
  const tree = r.render(
    { blockId: 'interaction.notification-center', props: { title: 'Inbox' } },
    emptyScope(),
    availability({ registry }),
  );
  assert.equal(tree.plan.kind, 'component');
  const p = tree.plan as Extract<RenderPlan, { kind: 'component' }>;
  assert.equal(p.componentKey, 'BcNotificationCenter');
  assert.equal(p.props.title, 'Inbox');
  assert.equal(p.props.disabled, false);
});

// ---------------------------------------------------------------------------
// Nested blocks (tree traversal)
// ---------------------------------------------------------------------------

test('renders nested blocks depth-first with inherited disabled/readOnly', () => {
  const catalog = mapCatalog([
    readySchemaEntry({ id: 'parent' }),
    readySchemaEntry({ id: 'child' }),
  ]);
  const r = makeRenderer({ catalog });
  const tree = r.render(
    {
      blockId: 'parent',
      bindings: { disabled: true, readOnly: true },
      children: [{ blockId: 'child' }],
    },
    emptyScope(),
    availability(),
  );
  assert.equal(tree.plan.kind, 'schema');
  assert.equal(tree.children.length, 1);
  const child = tree.children[0];
  const cp = child.plan as Extract<RenderPlan, { kind: 'schema' }>;
  assert.equal(cp.disabled, true, 'child inherits parent disabled');
  assert.equal(cp.readOnly, true, 'child inherits parent readOnly');
});

// ---------------------------------------------------------------------------
// Unknown block / component -> typed diagnostics
// ---------------------------------------------------------------------------

test('unknown blockId -> DiagnosticPlan with BLOCK_ENTRY_NOT_FOUND', () => {
  const r = makeRenderer({ catalog: mapCatalog([]) });
  const tree = r.render({ blockId: 'does.not.exist' }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.ENTRY_NOT_FOUND);
});

test('schema entry with missing required component -> BLOCK_COMPONENT_MISSING', () => {
  const entry = readyComponentEntry({
    requiredComponents: [{ key: 'BcMissing', platforms: ['web'] }],
  });
  // component NOT registered.
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.COMPONENT_MISSING);
});

test('component-strategy entry with platform mismatch -> BLOCK_PLATFORM_UNSUPPORTED', () => {
  const entry = readyComponentEntry();
  const registry = new InMemoryBlockComponentRegistry();
  registry.register({ componentKey: 'BcNotificationCenter', supportedPlatforms: ['flutter'] });
  const r = makeRenderer({ catalog: mapCatalog([entry]), componentRegistry: registry });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability({ registry, platform: 'web' }));
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.PLATFORM_UNSUPPORTED);
});

test('missing required function -> BLOCK_FUNCTION_MISSING', () => {
  const entry = readySchemaEntry({ requiredFunctions: ['string.fancy'] });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability({ functions: [] }));
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.FUNCTION_MISSING);
});

test('missing required adapter -> BLOCK_ADAPTER_MISSING', () => {
  const entry = readySchemaEntry({ requiredAdapters: ['model'] });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability({ adapters: [] }));
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.ADAPTER_MISSING);
});

// ---------------------------------------------------------------------------
// visible=false hides block (literal + AST)
// ---------------------------------------------------------------------------

test('visible=false literal -> HiddenPlan, subtree pruned', () => {
  const r = makeRenderer();
  const tree = r.render(
    {
      schema: { type: 'section', name: 'hidden' },
      bindings: { visible: false },
      children: [{ schema: { type: 'form', name: 'child' } }],
    },
    emptyScope(),
    availability(),
  );
  assert.equal(tree.plan.kind, 'hidden');
  const p = tree.plan as Extract<RenderPlan, { kind: 'hidden' }>;
  assert.equal(p.reason, 'literal');
  assert.equal(tree.children.length, 0, 'hidden node prunes subtree');
});

test('visible AST expression evaluated false -> HiddenPlan reason=evaluated', () => {
  const evaluator: ExpressionEvaluator = {
    evaluate(_expr, _scope) {
      return false;
    },
  };
  const r = makeRenderer({ evaluator });
  const tree = r.render(
    {
      schema: { type: 'section', name: 'cond' },
      bindings: {
        visible: { kind: 'path', path: 'values.flag' },
      },
    },
    emptyScope({ values: { flag: false } }),
    availability(),
  );
  assert.equal(tree.plan.kind, 'hidden');
  const p = tree.plan as Extract<RenderPlan, { kind: 'hidden' }>;
  assert.equal(p.reason, 'evaluated');
});

test('visible AST expression evaluated true -> renders normally', () => {
  const evaluator: ExpressionEvaluator = { evaluate: () => true };
  const r = makeRenderer({ evaluator });
  const tree = r.render(
    {
      schema: { type: 'section', name: 'cond' },
      bindings: { visible: { kind: 'path', path: 'values.flag' } },
    },
    emptyScope(),
    availability(),
  );
  assert.equal(tree.plan.kind, 'schema');
});

test('AST visible without evaluator -> BLOCK_EXPRESSION_EVAL_FAILED, fatal (safe default)', () => {
  const r = makeRenderer(); // no evaluator
  const tree = r.render(
    {
      schema: { type: 'section', name: 'cond' },
      bindings: { visible: { kind: 'path', path: 'values.flag' } },
    },
    emptyScope(),
    availability(),
  );
  // No evaluator -> visible eval fails -> fatal DiagnosticPlan (we cannot
  // safely render without knowing visibility). This is the production-safe
  // default; disabled/readOnly eval failures are non-fatal.
  assert.equal(tree.plan.kind, 'error');
  assert.ok(
    tree.diagnostics.some((d) => d.code === BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED),
  );
});

test('AST disabled without evaluator -> non-fatal diagnostic, renders with fallback', () => {
  const r = makeRenderer(); // no evaluator
  const tree = r.render(
    {
      schema: { type: 'section', name: 'cond' },
      bindings: { disabled: { kind: 'path', path: 'values.locked' } },
    },
    emptyScope(),
    availability(),
  );
  // disabled eval failure is non-fatal -> renders, diagnostic emitted.
  assert.equal(tree.plan.kind, 'schema');
  assert.ok(
    tree.diagnostics.some((d) => d.code === BLOCK_RENDER_DIAGNOSTIC_CODES.EXPRESSION_EVAL_FAILED),
  );
});

// ---------------------------------------------------------------------------
// disabled/readOnly propagation
// ---------------------------------------------------------------------------

test('disabled AST overrides and propagates to children', () => {
  const evaluator: ExpressionEvaluator = { evaluate: () => true };
  const catalog = mapCatalog([readySchemaEntry({ id: 'p' }), readySchemaEntry({ id: 'c' })]);
  const r = makeRenderer({ catalog, evaluator });
  const tree = r.render(
    {
      blockId: 'p',
      bindings: { disabled: { kind: 'literal', value: true } },
      children: [{ blockId: 'c' }],
    },
    emptyScope(),
    availability(),
  );
  const pp = tree.plan as Extract<RenderPlan, { kind: 'schema' }>;
  const cp = tree.children[0].plan as Extract<RenderPlan, { kind: 'schema' }>;
  assert.equal(pp.disabled, true);
  assert.equal(cp.disabled, true, 'child inherits resolved disabled');
});

// ---------------------------------------------------------------------------
// Action binding: produces deferred plan, NOT executed at render (amendment 6)
// ---------------------------------------------------------------------------

test('action binding produces ActionHandlerPlan; runner NOT invoked at render', async () => {
  const events: ActionLifecycleEvent[] = [];
  const adapterRegistry = new InMemoryActionAdapterRegistry();
  const customRegistry = new InMemoryCustomActionRegistry();
  const runner = new ActionRunner({
    adapterRegistry,
    customRegistry,
    emit: (e) => events.push(e),
  });
  let runCalled = false;
  // Register a handler adapter so the runner can resolve it.
  customRegistry.register('submit-handler', {
    kind: 'handler',
    async execute(_source, _payload, _ctx, _signal): Promise<ActionResult> {
      runCalled = true;
      return { ok: true, status: 'success' };
    },
  });

  const r = makeRenderer({ actionRunner: runner });
  const tree = r.render(
    {
      schema: { type: 'form', name: 'f' },
      actions: {
        submit: { type: 'handler', handlerKey: 'submit-handler' },
      },
    },
    emptyScope(),
    availability(),
  );

  // The plan was produced (not executed).
  assert.equal(tree.plan.kind, 'schema');
  assert.ok(tree.actions && tree.actions.submit, 'action plan bound');
  assert.equal(runCalled, false, 'runner NOT invoked during render');

  // Now invoke the deferred plan: runner runs.
  const sink: EffectSink = {
    setValue() {}, setMeta() {}, setError() {}, refreshDataSource() {},
    invalidateKey() {}, closeOverlay() {}, resetForm() {}, emit() {},
  };
  const ctx: ActionRuntimeContext = {
    values: {}, meta: {}, data: {},
    scope: { values: {}, meta: {}, data: {}, services: {}, permissions: {} },
    adapters: {}, effectSink: sink,
  };
  const result = await tree.actions!.submit.run(undefined, ctx);
  assert.equal(runCalled, true, 'runner invoked when plan.run() called');
  assert.equal(result.ok, true);
});

test('action plan without runner rejects with typed error when run', async () => {
  const r = makeRenderer(); // no actionRunner
  const tree = r.render(
    { schema: { type: 'form' }, actions: { go: { type: 'local', effects: [] } } },
    emptyScope(),
    availability(),
  );
  assert.ok(tree.actions && tree.actions.go);
  await assert.rejects(
    () => tree.actions!.go.run(undefined, {} as ActionRuntimeContext),
    /no ActionRunner is registered/,
  );
});

// ---------------------------------------------------------------------------
// candidate entry: default rejects, allowCandidate renders (amendment 5)
// ---------------------------------------------------------------------------

test('candidate entry rejected by default -> BLOCK_ENTRY_NOT_READY', () => {
  const entry = readySchemaEntry({ readiness: 'candidate' });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.ENTRY_NOT_READY);
});

test('candidate entry renders with allowCandidate=true', () => {
  const entry = readySchemaEntry({ readiness: 'candidate' });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render(
    { blockId: entry.id },
    emptyScope(),
    availability(),
    { allowCandidate: true },
  );
  assert.equal(tree.plan.kind, 'schema');
});

test('deprecated entry rejected by default; allowCandidate bypasses', () => {
  const entry = readySchemaEntry({ readiness: 'deprecated', deprecatedBy: 'content.hero2' });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const rejected = r.render({ blockId: entry.id }, emptyScope(), availability());
  assert.equal(rejected.plan.kind, 'error');
  const allowed = r.render(
    { blockId: entry.id },
    emptyScope(),
    availability(),
    { allowCandidate: true },
  );
  assert.equal(allowed.plan.kind, 'schema');
});

// ---------------------------------------------------------------------------
// Registry metadata-only semantics (amendment 3)
// ---------------------------------------------------------------------------

test('registry stores metadata only; resolve returns metadata without component field', () => {
  const reg = new InMemoryBlockComponentRegistry();
  const meta: ComponentMetadata = {
    componentKey: 'BcButton',
    category: 'interaction',
    capabilities: ['action-source'],
    supportedPlatforms: ['web', 'flutter'],
  };
  reg.register(meta);
  const resolved = reg.resolve('BcButton');
  assert.deepEqual(resolved, meta);
  assert.equal('component' in (resolved ?? {}), false, 'no framework component field');
  assert.equal(reg.has('BcButton'), true);
  assert.equal(reg.has('BcMissing'), false);
  assert.deepEqual(reg.keys(), ['BcButton']);
});

test('registry throws on duplicate registration', () => {
  const reg = new InMemoryBlockComponentRegistry();
  reg.register({ componentKey: 'BcButton' });
  assert.throws(() => reg.register({ componentKey: 'BcButton' }), /already registered/);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('undefined node -> DiagnosticPlan with BLOCK_RENDER_ABORTED', () => {
  const r = makeRenderer();
  const tree = r.render(undefined, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.RENDER_ABORTED);
});

test('schema-strategy entry without schemaPreset -> BLOCK_SCHEMA_INVALID', () => {
  const entry = readySchemaEntry({ schemaPreset: undefined });
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.SCHEMA_INVALID);
});

test('component-strategy entry without componentKey -> BLOCK_COMPONENT_MISSING', () => {
  const entry = readyComponentEntry({ componentKey: undefined });
  // No requiredComponents to trigger earlier gate; renderStrategy is component.
  entry.requiredComponents = [];
  const r = makeRenderer({ catalog: mapCatalog([entry]) });
  const tree = r.render({ blockId: entry.id }, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.COMPONENT_MISSING);
});

test('node without blockId or schema -> BLOCK_SCHEMA_INVALID', () => {
  const r = makeRenderer();
  const tree = r.render({} as never, emptyScope(), availability());
  assert.equal(tree.plan.kind, 'error');
  assert.equal(tree.diagnostics[0].code, BLOCK_RENDER_DIAGNOSTIC_CODES.SCHEMA_INVALID);
});

test('bindings.values merged into schema plan values', () => {
  const r = makeRenderer();
  const tree = r.render(
    { schema: { type: 'form', name: 'f' }, bindings: { values: { a: 1 } } },
    emptyScope({ values: { b: 2 } }),
    availability(),
  );
  const p = tree.plan as Extract<RenderPlan, { kind: 'schema' }>;
  assert.equal(p.values.a, 1, 'binding values merged');
  assert.equal(p.values.b, 2, 'scope values preserved');
});

test('bindings.data merged into expression scope data', () => {
  let seenData: unknown = undefined;
  const evaluator: ExpressionEvaluator = {
    evaluate(_e, scope) {
      seenData = scope.data;
      return true;
    },
  };
  const r = makeRenderer({ evaluator });
  r.render(
    {
      schema: { type: 'section', name: 's' },
      bindings: { data: { items: [1, 2] }, visible: { kind: 'path', path: 'values.x' } },
    },
    emptyScope(),
    availability(),
  );
  assert.deepEqual((seenData as Record<string, unknown>).items, [1, 2], 'binding data merged into scope');
});

test('permission filtering applied: unauthorized values removed before eval', () => {
  let seenValues: Record<string, unknown> = {};
  const evaluator: ExpressionEvaluator = {
    evaluate(_e, scope) {
      seenValues = scope.values;
      return true;
    },
  };
  const r = makeRenderer({ evaluator });
  r.render(
    {
      schema: { type: 'section', name: 's' },
      bindings: {
        visible: { kind: 'path', path: 'values.secret' },
      },
    },
    emptyScope({
      values: { secret: 'sensitive', public: 'ok' },
      permissions: { allowedValueFields: new Set(['public']) },
    }),
    availability(),
  );
  assert.equal(seenValues.public, 'ok');
  assert.equal('secret' in seenValues, false, 'unauthorized value removed by F permission filter');
});
