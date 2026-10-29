import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ActionRunner,
  InMemoryActionAdapterRegistry,
  InMemoryCustomActionRegistry,
  type ActionAdapter,
  type ActionLifecycleEvent,
  type ActionRuntimeContext,
  type ActionSource,
  type EffectSink,
} from '../../src/actions/index.ts';
import type { ActionResult } from '../../src/actions/index.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSink(): EffectSink & { calls: string[]; errors: Record<string, string> } {
  const calls: string[] = [];
  const errors: Record<string, string> = {};
  return {
    calls,
    errors,
    setValue: (p, v) => calls.push(`set:${p}=${String(v)}`),
    setMeta: (p) => calls.push(`meta:${p}`),
    setError: (p, e) => { errors[p] = typeof e === 'string' ? e : e.message; calls.push(`err:${p}`); },
    refreshDataSource: (k) => calls.push(`refresh:${k}`),
    invalidateKey: (k) => calls.push(`inv:${k}`),
    closeOverlay: (id) => calls.push(`close:${id ?? ''}`),
    resetForm: (id) => calls.push(`reset:${id ?? ''}`),
    emit: (e) => calls.push(`emit:${e}`),
  };
}

interface ObservedSink extends EffectSink { calls: string[]; errors: Record<string, string>; }

function makeCtx(overrides: Partial<Omit<ActionRuntimeContext, 'effectSink'>> & { effectSink?: ObservedSink } = {}): ActionRuntimeContext & { effectSink: ObservedSink } {
  const effectSink = overrides.effectSink ?? makeSink();
  return {
    values: {},
    meta: {},
    data: {},
    scope: { values: {}, meta: {}, data: {}, services: {}, permissions: {} },
    adapters: {},
    effectSink,
    ...overrides,
  };
}

/** Build a runner + capture lifecycle events. */
function makeRunner(opts: { evaluator?: ActionRuntimeContext } = {}) {
  const adapterRegistry = new InMemoryActionAdapterRegistry();
  const customRegistry = new InMemoryCustomActionRegistry();
  const events: ActionLifecycleEvent[] = [];
  const runner = new ActionRunner({
    adapterRegistry,
    customRegistry,
    emit: (e) => events.push(e),
  });
  return { runner, adapterRegistry, customRegistry, events };
}

/** A mock adapter that returns a fixed result. */
function mockAdapter(result: ActionResult, kind: 'handler' | 'url' | 'model' = 'url'): ActionAdapter {
  return {
    kind,
    execute: async () => result,
  };
}

/** An adapter that throws (to test normalization). */
function throwingAdapter(err: unknown, kind: 'url' | 'model' = 'url'): ActionAdapter {
  return {
    kind,
    execute: async () => { throw err; },
  };
}

/** Extract phase sequence from captured events. */
function phases(events: ActionLifecycleEvent[]): string[] {
  return events.map((e) => e.phase);
}

// ---------------------------------------------------------------------------
// A5: local source with empty effects = no-op success
// ---------------------------------------------------------------------------

test('A5: local source empty effects = start -> success -> settled', async () => {
  const { runner, events } = makeRunner();
  const ctx = makeCtx();
  const source: ActionSource = { type: 'local', effects: [] };
  const result = await runner.run(source, {}, ctx, { actionId: 'a5' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'success');
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
});

test('local source applies effects via sink in tier order', async () => {
  const { runner, events } = makeRunner();
  const ctx = makeCtx();
  const source: ActionSource = {
    type: 'local',
    effects: [
      { type: 'emit', event: 'done' },
      { type: 'setValue', path: 'x', value: 1 },
    ],
  };
  await runner.run(source, {}, ctx, { actionId: 'local-order' });
  // sink calls prove tier reordering: setValue before emit
  assert.deepEqual(ctx.effectSink.calls, ['set:x=1', 'emit:done']);
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
});

// ---------------------------------------------------------------------------
// A1: missing adapter = preflight fail (NO start), error + settled
// ---------------------------------------------------------------------------

test('A1: missing url adapter = preflight fail, no start emitted', async () => {
  const { runner, events } = makeRunner();
  const ctx = makeCtx();
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://x' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a1' });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_ADAPTER_MISSING');
  // NO start phase (preflight failed).
  assert.ok(!phases(events).includes('start'));
  assert.deepEqual(phases(events), ['error', 'settled']);
});

// ---------------------------------------------------------------------------
// A6: handler with unregistered key = preflight fail, no start
// ---------------------------------------------------------------------------

test('A6: handler unregistered key = preflight fail, no start', async () => {
  const { runner, events } = makeRunner();
  const ctx = makeCtx();
  const source: ActionSource = { type: 'handler', handlerKey: 'nope' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a6' });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_ADAPTER_MISSING');
  assert.ok(!phases(events).includes('start'));
  assert.deepEqual(phases(events), ['error', 'settled']);
});

// ---------------------------------------------------------------------------
// A6b: handler with registered key = success
// ---------------------------------------------------------------------------

test('A6b: handler registered key executes successfully', async () => {
  const { runner, customRegistry, events } = makeRunner();
  customRegistry.register('submit', mockAdapter({ ok: true, status: 'success', data: 'done' }, 'handler'));
  const ctx = makeCtx();
  const source: ActionSource = { type: 'handler', handlerKey: 'submit' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a6b' });
  assert.equal(result.ok, true);
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
});

// ---------------------------------------------------------------------------
// A7: url not in allowlist = preflight fail, no start
// ---------------------------------------------------------------------------

test('A7: url rejected by policy = preflight fail, no start', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({ ok: true, status: 'success' }));
  const ctx = makeCtx({
    adapters: { urlPolicy: { isAllowed: () => false } },
  });
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://evil' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a7' });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_URL_NOT_ALLOWED');
  assert.ok(!phases(events).includes('start'));
});

test('A7b: url allowed by policy proceeds to adapter', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({ ok: true, status: 'success' }));
  const ctx = makeCtx({
    adapters: { urlPolicy: { isAllowed: () => true } },
  });
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://ok' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a7b' });
  assert.equal(result.ok, true);
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
});

// ---------------------------------------------------------------------------
// A9: abort before start = preflight fail, no start
// ---------------------------------------------------------------------------

test('A9: abort before start = preflight fail, no start, ACTION_ABORTED', async () => {
  const { runner, events } = makeRunner();
  const ctx = makeCtx();
  const ctrl = new AbortController();
  ctrl.abort();
  const source: ActionSource = { type: 'local', effects: [] };
  const result = await runner.run(source, {}, ctx, { actionId: 'a9', signal: ctrl.signal });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_ABORTED');
  assert.ok(!phases(events).includes('start'));
  assert.deepEqual(phases(events), ['error', 'settled']);
});

// ---------------------------------------------------------------------------
// A10: abort mid-run = exec fail, start was emitted
// ---------------------------------------------------------------------------

test('A10: abort mid-run = exec fail, start emitted, ACTION_ABORTED', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  const ctrl = new AbortController();
  adapterRegistry.register('url', {
    kind: 'url',
    execute: async (_s, _p, _c, signal) => {
      // Simulate async work that gets interrupted by abort.
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        setTimeout(resolve, 5000);
      });
      return { ok: true, status: 'success' };
    },
  });
  const ctx = makeCtx();
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://slow' };
  const runPromise = runner.run(source, {}, ctx, { actionId: 'a10', signal: ctrl.signal });
  // Abort after start is emitted.
  await new Promise((r) => setTimeout(r, 10));
  ctrl.abort();
  const result = await runPromise;
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_ABORTED');
  // start WAS emitted (abort happened mid-run, after preflight passed).
  assert.ok(phases(events).includes('start'));
  assert.deepEqual(phases(events), ['start', 'error', 'settled']);
});

// ---------------------------------------------------------------------------
// A11: timeout = ACTION_TIMEOUT (distinct from abort)
// ---------------------------------------------------------------------------

test('A11: timeout exceeded = ACTION_TIMEOUT', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', {
    kind: 'url',
    execute: async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return { ok: true, status: 'success' };
    },
  });
  const ctx = makeCtx();
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://slow' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a11', timeoutMs: 30 });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_TIMEOUT');
  assert.equal(result.errorList![0].recoverable, true);
  assert.ok(phases(events).includes('start'));
});

// ---------------------------------------------------------------------------
// A12: adapter throws raw error = normalized to ACTION_ADAPTER_THREW
// ---------------------------------------------------------------------------

test('A12: adapter throws raw error = ACTION_ADAPTER_THREW', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', throwingAdapter(new Error('network down')));
  const ctx = makeCtx();
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://x' };
  const result = await runner.run(source, {}, ctx, { actionId: 'a12' });
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_ADAPTER_THREW');
  assert.match(result.errorList![0].message, /network down/);
  assert.deepEqual(phases(events), ['start', 'error', 'settled']);
});

test('A12b: adapter throws non-Error = still normalized', async () => {
  const { runner, adapterRegistry } = makeRunner();
  adapterRegistry.register('url', throwingAdapter('string error'));
  const ctx = makeCtx();
  const result = await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    ctx,
    { actionId: 'a12b' },
  );
  assert.equal(result.errorList![0].code, 'ACTION_ADAPTER_THREW');
  assert.match(result.errorList![0].message, /string error/);
});

// ---------------------------------------------------------------------------
// A4: adapter returns malformed result = normalized to ok:false
// ---------------------------------------------------------------------------

test('A4: adapter returns malformed (missing ok) = normalized to ok:false', async () => {
  const { runner, adapterRegistry } = makeRunner();
  adapterRegistry.register('url', mockAdapter({ status: 200 } as unknown as ActionResult));
  const ctx = makeCtx();
  const result = await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    ctx,
    { actionId: 'a4' },
  );
  // Missing `ok` defaults to false (defensive normalization).
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// E10: validation error result = validation-error phase + errors applied to sink
// ---------------------------------------------------------------------------

test('E10: validation-error result fires validation-error phase + setError on sink', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({
    ok: false,
    status: 'validation-error',
    errors: { email: 'invalid format', name: 'required' },
  }));
  const ctx = makeCtx();
  const result = await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    ctx,
    { actionId: 'e10' },
  );
  assert.equal(result.ok, false);
  assert.equal(phases(events).includes('validation-error'), true);
  assert.ok(!phases(events).includes('error'), 'should NOT fire generic error for validation');
  // Errors applied to sink via setError.
  assert.equal(ctx.effectSink.errors['email'], 'invalid format');
  assert.equal(ctx.effectSink.errors['name'], 'required');
});

// ---------------------------------------------------------------------------
// E14: repeated submit with same actionId = dedup (same promise)
// ---------------------------------------------------------------------------

test('E14: duplicate actionId returns in-flight promise', async () => {
  const { runner, adapterRegistry } = makeRunner();
  let resolveFirst!: (v: ActionResult) => void;
  adapterRegistry.register('url', {
    kind: 'url',
    execute: () => new Promise((resolve) => { resolveFirst = resolve; }),
  });
  const ctx = makeCtx();
  const source: ActionSource = { type: 'url', method: 'POST', url: 'https://x' };
  const p1 = runner.run(source, {}, ctx, { actionId: 'dup' });
  const p2 = runner.run(source, {}, ctx, { actionId: 'dup' });
  // Same promise reference (deduped).
  assert.equal(p1, p2);
  // Wait for the async execute body to run (it assigns resolveFirst).
  await new Promise((r) => setTimeout(r, 0));
  resolveFirst({ ok: true, status: 'success' });
  const result = await p1;
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Success path: url adapter success + result effects applied
// ---------------------------------------------------------------------------

test('success path: url adapter returns success + result effects applied', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({
    ok: true,
    status: 'success',
    effects: [
      { type: 'toast', level: 'success', fallbackMessage: 'saved' },
      { type: 'setValue', path: 'savedAt', value: 'now' },
    ],
  }));
  const ctx = makeCtx({
    adapters: { toast: { show: () => {} } },
  });
  const result = await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    ctx,
    { actionId: 'success' },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
  // Result effects applied in tier order: setValue (1) before toast (3).
  assert.deepEqual(ctx.effectSink.calls, ['set:savedAt=now']);
});

// ---------------------------------------------------------------------------
// A8: effect with missing adapter = diagnostic but run still settles
// ---------------------------------------------------------------------------

test('A8: result effect with missing adapter produces warning, run settles', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({
    ok: true,
    status: 'success',
    effects: [{ type: 'navigate', to: '/next' }], // no navigation adapter
  }));
  const ctx = makeCtx();
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    ctx,
    { actionId: 'a8' },
  );
  // Run still completes with start -> success -> settled.
  assert.deepEqual(phases(events), ['start', 'success', 'settled']);
});

// ---------------------------------------------------------------------------
// settled-exactly-once on all exit paths
// ---------------------------------------------------------------------------

test('settled fires exactly once on preflight failure', async () => {
  const { runner, events } = makeRunner();
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' }, // no adapter
    {},
    makeCtx(),
    { actionId: 'settle1' },
  );
  const settledCount = events.filter((e) => e.phase === 'settled').length;
  assert.equal(settledCount, 1);
});

test('settled fires exactly once on success', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', mockAdapter({ ok: true, status: 'success' }));
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'settle2' },
  );
  assert.equal(events.filter((e) => e.phase === 'settled').length, 1);
});

test('settled fires exactly once on adapter throw', async () => {
  const { runner, adapterRegistry, events } = makeRunner();
  adapterRegistry.register('url', throwingAdapter(new Error('boom')));
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'settle3' },
  );
  assert.equal(events.filter((e) => e.phase === 'settled').length, 1);
});

// ---------------------------------------------------------------------------
// runner never throws to caller (all failures normalize)
// ---------------------------------------------------------------------------

test('runner.run never throws to caller: invalid source returns result', async () => {
  const { runner } = makeRunner();
  const result = await runner.run(
    { type: 'teleport' } as unknown as ActionSource,
    {},
    makeCtx(),
    { actionId: 'no-throw' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.errorList![0].code, 'ACTION_SOURCE_INVALID');
});
