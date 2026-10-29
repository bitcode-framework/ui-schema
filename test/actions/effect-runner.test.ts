import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { applyEffects, EFFECT_TIER_ORDER, effectTier } from '../../src/actions/index.ts';
import type { ActionEffect, EffectSink } from '../../src/actions/index.ts';

/** A recording sink that captures every call in order, for assertions. */
function recordingSink(): EffectSink & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    setValue: (p, v) => calls.push(`setValue:${p}=${String(v)}`),
    setMeta: (p) => calls.push(`setMeta:${p}`),
    setError: (p) => calls.push(`setError:${p}`),
    refreshDataSource: (k) => calls.push(`refresh:${k}`),
    invalidateKey: (k) => calls.push(`invalidate:${k}`),
    closeOverlay: (id) => calls.push(`close:${id ?? ''}`),
    resetForm: (id) => calls.push(`reset:${id ?? ''}`),
    emit: (e) => calls.push(`emit:${e}`),
  };
}

test('effect-runner: applies effects in deterministic 5-tier order (E11)', () => {
  const sink = recordingSink();
  // Deliberately shuffled — emit first, setValue last. Runner must reorder.
  const effects: ActionEffect[] = [
    { type: 'emit', event: 'done' },          // tier 5
    { type: 'navigate', to: '/home' },        // tier 4 (no adapter -> diag)
    { type: 'toast', level: 'success', fallbackMessage: 'ok' }, // tier 3 (no adapter -> diag)
    { type: 'refreshDataSource', key: 'list' },// tier 2
    { type: 'setValue', path: 'name', value: 'x' }, // tier 1
  ];
  const diags = applyEffects(effects, sink, {});
  // Sink calls only include routed effects (toast/navigate need adapters).
  // Order proves tier reordering: setValue (1) -> refresh (2) -> emit (5).
  assert.deepEqual(sink.calls, [
    'setValue:name=x',
    'refresh:list',
    'emit:done',
  ]);
  // toast + navigate produced diagnostics (no adapters provided).
  assert.equal(diags.length, 2);
  assert.equal(diags[0].code, 'ACTION_EFFECT_ADAPTER_MISSING'); // toast
  assert.equal(diags[1].code, 'ACTION_EFFECT_ADAPTER_MISSING'); // navigate
});

test('effect-runner: within-tier order preserved', () => {
  const sink = recordingSink();
  const effects: ActionEffect[] = [
    { type: 'setValue', path: 'a', value: 1 }, // tier 1, index 0
    { type: 'setValue', path: 'b', value: 2 }, // tier 1, index 1
    { type: 'setMeta', path: 'a', meta: {} },   // tier 1, index 2
  ];
  applyEffects(effects, sink, {});
  assert.deepEqual(sink.calls, ['setValue:a=1', 'setValue:b=2', 'setMeta:a']);
});

test('effect-runner: toast without adapter returns diagnostic', () => {
  const sink = recordingSink();
  const effects: ActionEffect[] = [
    { type: 'toast', level: 'info', fallbackMessage: 'hi' },
  ];
  const diags = applyEffects(effects, sink, {}); // no toast adapter
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, 'ACTION_EFFECT_ADAPTER_MISSING');
  assert.match(diags[0].message, /toast/);
});

test('effect-runner: toast WITH adapter routes correctly', () => {
  const sink = recordingSink();
  const toasts: Array<{ level: string; message: string }> = [];
  const diags = applyEffects(
    [{ type: 'toast', level: 'success', fallbackMessage: 'done' }],
    sink,
    { toast: { show: (level, message) => toasts.push({ level, message }) } },
  );
  assert.equal(diags.length, 0);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].level, 'success');
  assert.equal(toasts[0].message, 'done');
});

test('effect-runner: navigate without adapter returns diagnostic', () => {
  const sink = recordingSink();
  const diags = applyEffects([{ type: 'navigate', to: '/x' }], sink, {});
  assert.equal(diags[0].code, 'ACTION_EFFECT_ADAPTER_MISSING');
});

test('effect-runner: navigate WITH adapter routes correctly', () => {
  const sink = recordingSink();
  const navs: string[] = [];
  const diags = applyEffects(
    [{ type: 'navigate', to: '/home', replace: true }],
    sink,
    { navigation: { navigate: (to, opts) => navs.push(`${to}?r=${opts?.replace}`) } },
  );
  assert.equal(diags.length, 0);
  assert.equal(navs[0], '/home?r=true');
});

test('effect-runner: empty effects is a no-op', () => {
  const sink = recordingSink();
  const diags = applyEffects([], sink, {});
  assert.equal(diags.length, 0);
  assert.equal(sink.calls.length, 0);
});

test('effect-runner: toast messageKey resolved via i18n when present', () => {
  const sink = recordingSink();
  const toasts: string[] = [];
  applyEffects(
    [{ type: 'toast', level: 'error', messageKey: 'err.x', fallbackMessage: 'fallback' }],
    sink,
    {
      toast: { show: (_l, m) => toasts.push(m) },
      i18n: { t: (key, fallback) => (key === 'err.x' ? 'TRANSLATED' : fallback), locale: () => 'en' },
    },
  );
  assert.equal(toasts[0], 'TRANSLATED');
});

test('effectTier: returns correct tier index for each kind', () => {
  assert.equal(effectTier('setValue'), 0);
  assert.equal(effectTier('setMeta'), 0);
  assert.equal(effectTier('setError'), 0);
  assert.equal(effectTier('invalidateKey'), 1);
  assert.equal(effectTier('refreshDataSource'), 1);
  assert.equal(effectTier('toast'), 2);
  assert.equal(effectTier('closeOverlay'), 2);
  assert.equal(effectTier('resetForm'), 2);
  assert.equal(effectTier('navigate'), 3);
  assert.equal(effectTier('emit'), 4);
});

test('EFFECT_TIER_ORDER: has exactly 5 tiers', () => {
  assert.equal(EFFECT_TIER_ORDER.length, 5);
});
