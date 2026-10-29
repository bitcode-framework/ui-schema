import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ACTION_PHASES,
  buildLifecycleEvent,
  ActionRunner,
  InMemoryActionAdapterRegistry,
  InMemoryCustomActionRegistry,
  type ActionLifecycleEvent,
  type ActionSource,
  type ActionRuntimeContext,
  type EffectSink,
} from '../../src/actions/index.ts';

function noopSink(): EffectSink {
  return {
    setValue() {}, setMeta() {}, setError() {}, refreshDataSource() {},
    invalidateKey() {}, closeOverlay() {}, resetForm() {}, emit() {},
  };
}

function makeCtx(overrides: Partial<ActionRuntimeContext> = {}): ActionRuntimeContext {
  return {
    values: {}, meta: {}, data: {},
    scope: { values: {}, meta: {}, data: {}, services: {}, permissions: {} },
    adapters: {},
    effectSink: noopSink(),
    ...overrides,
  };
}

test('ACTION_PHASES: contains all 5 phases', () => {
  assert.deepEqual([...ACTION_PHASES], ['start', 'success', 'error', 'validation-error', 'settled']);
});

test('buildLifecycleEvent: builds event with required fields', () => {
  const source: ActionSource = { type: 'local', effects: [] };
  const event = buildLifecycleEvent('id-1', source, 'start', { reason: 'action', source: 'programmatic' });
  assert.equal(event.actionId, 'id-1');
  assert.equal(event.phase, 'start');
  assert.equal(event.source, source);
  assert.equal(event.meta.reason, 'action');
  assert.ok(typeof event.timestamp === 'number');
});

test('buildLifecycleEvent: optional fields included when provided', () => {
  const source: ActionSource = { type: 'local', effects: [] };
  const event = buildLifecycleEvent('id-2', source, 'success', { reason: 'action', source: 'programmatic' }, {
    payload: { x: 1 },
    result: { ok: true, status: 'success' },
    timestamp: 12345,
  });
  assert.deepEqual(event.payload, { x: 1 });
  assert.ok(event.result);
  assert.equal(event.timestamp, 12345);
});

test('emitter injection: runner calls injected emitter (not DOM)', async () => {
  const events: ActionLifecycleEvent[] = [];
  const adapterReg = new InMemoryActionAdapterRegistry();
  adapterReg.register('url', {
    kind: 'url',
    execute: async () => ({ ok: true, status: 'success' }),
  });
  const runner = new ActionRunner({
    adapterRegistry: adapterReg,
    customRegistry: new InMemoryCustomActionRegistry(),
    emit: (e) => events.push(e),
  });
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'inj' },
  );
  assert.equal(events.length, 3);
  assert.equal(events[0].phase, 'start');
  assert.equal(events[1].phase, 'success');
  assert.equal(events[2].phase, 'settled');
});

test('emitter optional: runner works without emitter (headless)', async () => {
  const adapterReg = new InMemoryActionAdapterRegistry();
  adapterReg.register('url', {
    kind: 'url',
    execute: async () => ({ ok: true, status: 'success' }),
  });
  const runner = new ActionRunner({
    adapterRegistry: adapterReg,
    customRegistry: new InMemoryCustomActionRegistry(),
    // no emit provided
  });
  const result = await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'headless' },
  );
  assert.equal(result.ok, true);
});

test('lifecycle order: preflight fail emits error then settled (no start)', async () => {
  const events: ActionLifecycleEvent[] = [];
  const runner = new ActionRunner({
    adapterRegistry: new InMemoryActionAdapterRegistry(), // empty: url adapter missing
    customRegistry: new InMemoryCustomActionRegistry(),
    emit: (e) => events.push(e),
  });
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'pf-fail' },
  );
  const phases = events.map((e) => e.phase);
  assert.deepEqual(phases, ['error', 'settled']);
  assert.ok(!phases.includes('start'));
});

test('lifecycle order: success emits start -> success -> settled', async () => {
  const events: ActionLifecycleEvent[] = [];
  const adapterReg = new InMemoryActionAdapterRegistry();
  adapterReg.register('url', {
    kind: 'url',
    execute: async () => ({ ok: true, status: 'success' }),
  });
  const runner = new ActionRunner({
    adapterRegistry: adapterReg,
    customRegistry: new InMemoryCustomActionRegistry(),
    emit: (e) => events.push(e),
  });
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'order-ok' },
  );
  assert.deepEqual(events.map((e) => e.phase), ['start', 'success', 'settled']);
});

test('lifecycle order: validation-error emits start -> validation-error -> settled (not error)', async () => {
  const events: ActionLifecycleEvent[] = [];
  const adapterReg = new InMemoryActionAdapterRegistry();
  adapterReg.register('url', {
    kind: 'url',
    execute: async () => ({
      ok: false,
      status: 'validation-error',
      errors: { field1: 'bad' },
    }),
  });
  const runner = new ActionRunner({
    adapterRegistry: adapterReg,
    customRegistry: new InMemoryCustomActionRegistry(),
    emit: (e) => events.push(e),
  });
  await runner.run(
    { type: 'url', method: 'POST', url: 'https://x' },
    {},
    makeCtx(),
    { actionId: 'order-ve' },
  );
  const phases = events.map((e) => e.phase);
  assert.deepEqual(phases, ['start', 'validation-error', 'settled']);
  assert.ok(!phases.includes('error'));
});

test('settled exactly once on every path', async () => {
  const scenarios: Array<{ name: string; withAdapter: boolean }> = [
    { name: 'success', withAdapter: true },
    { name: 'preflight-fail', withAdapter: false },
  ];
  for (const { name, withAdapter } of scenarios) {
    const events: ActionLifecycleEvent[] = [];
    const reg = new InMemoryActionAdapterRegistry();
    if (withAdapter) {
      reg.register('url', { kind: 'url', execute: async () => ({ ok: true, status: 'success' }) });
    }
    const runner = new ActionRunner({
      adapterRegistry: reg,
      customRegistry: new InMemoryCustomActionRegistry(),
      emit: (e) => events.push(e),
    });
    await runner.run(
      { type: 'url', method: 'POST', url: 'https://x' },
      {},
      makeCtx(),
      { actionId: `once-${name}` },
    );
    const settledCount = events.filter((e) => e.phase === 'settled').length;
    assert.equal(settledCount, 1, `${name}: settled should fire exactly once`);
  }
});
