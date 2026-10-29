// ============================================================================
// @bitcode/ui-schema — ReactiveStore (ADR-004)
//
// Headless, per-instance, framework-agnostic reactive engine.
// Responsibilities:
//   - Store named cells (values) and per-field metadata (visible/disabled/...).
//   - Maintain a reaction dependency graph.
//   - Re-run reactions when cells change (topological, batched per set()).
//   - Emit change events to subscribers.
//
// Constraints (from ADR-004):
//   - No singleton — each form/scope has its own store (SSR-safe).
//   - No `eval()` — effects are pure functions.
//   - No platform globals (window/document) — safe in Node/SSR/RN.
//
// Extracted from @bitcode/ui per ADR-012.
// ============================================================================

import type {
  DataEffect,
  Effect,
  Evaluator,
  FieldMeta,
  FieldPath,
  Reaction,
  ReactiveScopeLike,
  ReactiveStoreOptions,
  Snapshot,
  UiEffect,
  ValidationEffect,
  ValidationRule,
  ValueEffect,
} from './types.ts';

const DEFAULT_META: FieldMeta = {
  visible: true,
  disabled: false,
  required: false,
};

export type Listener = (snapshot: Snapshot) => void;

export class ReactiveStore implements ReactiveScopeLike {
  private values: Map<FieldPath, unknown>;
  private meta: Map<FieldPath, FieldMeta>;
  private reactions: Reaction[];
  private onChange?: (path: FieldPath, value: unknown) => void;
  private listeners: Set<Listener> = new Set();
  private parent: ReactiveScopeLike | null;
  private index: number | undefined;
  private evaluator: Evaluator | null;

  constructor(opts: ReactiveStoreOptions = {}) {
    this.values = new Map(Object.entries(opts.initialValues ?? {}));
    this.reactions = opts.reactions ?? [];
    this.onChange = opts.onChange;
    this.meta = new Map();
    this.parent = opts.parent ?? null;
    this.index = opts.index;
    this.evaluator = opts.evaluator ?? null;
  }

  // ── Scope linkage (ADR-004 §4) ──────────────────────────────────────────

  /**
   * Walk to the topmost ancestor. Used to resolve `$root` in nested scopes.
   * Returns `this` when the store has no parent.
   */
  getRoot(): ReactiveScopeLike {
    let cursor: ReactiveScopeLike = this;
    // Cap traversal to defend against pathological cycles in test mocks.
    for (let i = 0; i < 64; i += 1) {
      const next = (cursor as ReactiveStore).parent ?? null;
      if (!next) return cursor;
      cursor = next;
    }
    return cursor;
  }

  /** Attach (or detach with `null`) a string-expression evaluator at runtime. */
  setEvaluator(evaluator: Evaluator | null): void {
    this.evaluator = evaluator;
  }

  getEvaluator(): Evaluator | null {
    return this.evaluator;
  }

  // ── Read / write cells ──────────────────────────────────────────────────

  get(path: FieldPath): unknown {
    return this.values.get(path);
  }

  set(path: FieldPath, value: unknown): void {
    const old = this.values.get(path);
    if (Object.is(old, value)) return;
    this.values.set(path, value);
    this.onChange?.(path, value);
    this.runAffected(path);
    this.notify();
  }

  setMany(patch: Record<string, unknown>): void {
    let changed = false;
    const affected = new Set<FieldPath>();
    for (const [k, v] of Object.entries(patch)) {
      const old = this.values.get(k);
      if (Object.is(old, v)) continue;
      this.values.set(k, v);
      this.onChange?.(k, v);
      affected.add(k);
      changed = true;
    }
    if (!changed) return;
    for (const k of affected) this.runAffected(k);
    this.notify();
  }

  // ── Metadata ────────────────────────────────────────────────────────────

  getMeta(path: FieldPath): FieldMeta {
    return this.meta.get(path) ?? { ...DEFAULT_META };
  }

  private setMeta(path: FieldPath, patch: Partial<FieldMeta>): void {
    const prev = this.getMeta(path);
    const next = { ...prev, ...patch };
    if (JSON.stringify(prev) === JSON.stringify(next)) return;
    this.meta.set(path, next);
  }

  // ── Snapshot ────────────────────────────────────────────────────────────

  /**
   * Plain values record for *this* store. No scope keys, no parent walk.
   * Used by `snapshot()` and exposed to children via `ReactiveScopeLike`.
   */
  private localSnapshot(): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    this.values.forEach((v, k) => {
      self[k] = v;
    });
    return self;
  }

  /**
   * Build the scope passed to reaction predicates / effects (ADR-004 §4).
   *
   * Includes scope keys when the store is nested:
   *   - `$self`   : the local values record.
   *   - `$parent` : the parent's local values (plain — no nested $self/$root).
   *   - `$root`   : the topmost ancestor's local values.
   *   - `$index`  : the row index when set by a repeater.
   *
   * Top-level keys are mirrored alongside `$self.*` so the common case
   * (`(s) => s.qty * s.harga`) keeps working without changing call sites.
   */
  snapshot(): Snapshot {
    const self = this.localSnapshot();
    const s: Snapshot = { ...self };
    s.$self = self;
    if (this.index !== undefined) s.$index = this.index;
    if (this.parent) {
      // Parent may be a `ReactiveStore` (preferred path uses localSnapshot)
      // or a generic `ReactiveScopeLike` mock that only provides snapshot().
      // For the latter, we accept whatever it returns — tests opt in.
      const parentLocal =
        this.parent instanceof ReactiveStore
          ? (this.parent as ReactiveStore).localSnapshot()
          : this.parent.snapshot();
      s.$parent = parentLocal;
      const root = this.parent.getRoot();
      const rootLocal =
        root === this.parent
          ? parentLocal
          : root instanceof ReactiveStore
            ? (root as ReactiveStore).localSnapshot()
            : root.snapshot();
      s.$root = rootLocal;
    } else {
      // Root store: `$root` points at its own local values for symmetry.
      s.$root = self;
    }
    return s;
  }

  // ── Expression helper (ADR-004 §3) ──────────────────────────────────────

  /**
   * Evaluate a string expression using the attached `Evaluator`. Throws if
   * no evaluator is present — fail-fast semantics keep silent no-ops out of
   * production reactions. Use the function form of reactions when no
   * evaluator is configured.
   */
  evaluate(expr: string, scope?: Snapshot): unknown {
    if (!this.evaluator) {
      throw new Error(
        'ReactiveStore.evaluate: no evaluator attached. Pass `evaluator` in options or use the function form of reactions.',
      );
    }
    return this.evaluator.evaluate(expr, scope ?? this.snapshot());
  }

  // ── Subscription ────────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Symmetric unsubscribe — remove a previously-subscribed listener by
   * reference. Mirrors the DOM EventTarget add/removeEventListener pattern
   * so callers that store the listener function (not the returned disposer)
   * can clean up deterministically.
   *
   * Required by Mitosis components whose onUnMount closure would otherwise
   * capture a stale disposer (BC-024): storing the listener reference in
   * useStore state keeps it stable across re-renders, while the disposer
   * returned by subscribe would be null in the cleanup closure that deps [].
   *
   * No-op when the listener was never subscribed or already removed.
   */
  unsubscribe(listener: Listener): void {
    this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  // ── Reaction runner ─────────────────────────────────────────────────────

  /**
   * Propagate changes through the reaction graph using a work queue.
   * A reaction's effect may change another value (VALUE effect, or DATA
   * clearOnChange), which is enqueued so transitive cascades fire
   * (provinsi -> kabupaten -> kecamatan -> desa). Natural fixpoint: a target
   * is only re-enqueued when its value actually changes (Object.is guard in
   * applyValue/clear), preventing infinite loops in stable graphs. An
   * iteration cap guards against pathological cycles.
   */
  private propagate(initial: FieldPath[]): void {
    const queue: FieldPath[] = [...initial];
    let iterations = 0;
    const MAX_ITERATIONS = 10000;
    while (queue.length > 0) {
      if (++iterations > MAX_ITERATIONS) {
        throw new Error('ReactiveStore: reaction cycle detected (iteration cap exceeded)');
      }
      const source = queue.shift() as FieldPath;
      for (const reaction of this.reactions) {
        const when = Array.isArray(reaction.when) ? reaction.when : [reaction.when];
        if (!when.includes(source)) continue;

        const scope = this.snapshot();
        if (reaction.condition && !reaction.condition(scope)) continue;

        const valueChanged = this.applyEffect(reaction.target, reaction.effect, scope);
        if (valueChanged) queue.push(reaction.target);
      }
    }
  }

  private runAffected(source: FieldPath): void {
    this.propagate([source]);
  }

  /**
   * Recompute all reactions (used on initialization so UI meta starts correct).
   */
  runAll(): void {
    const scope = this.snapshot();
    for (const reaction of this.reactions) {
      if (reaction.condition && !reaction.condition(scope)) continue;
      this.applyEffect(reaction.target, reaction.effect, scope);
    }
  }

  /** Returns true if the effect changed the target's VALUE (triggers cascade). */
  private applyEffect(target: FieldPath, effect: Effect, scope: Snapshot): boolean {
    switch (effect.kind) {
      case 'ui':
        this.applyUi(target, effect.ui, scope);
        return false;
      case 'value':
        return this.applyValue(target, effect.value, scope);
      case 'validation':
        this.applyValidation(target, effect.validation, scope);
        return false;
      case 'data':
        return this.applyData(target, effect.data, scope);
    }
  }

  private applyUi(target: FieldPath, ui: UiEffect, scope: Snapshot): void {
    const patch: Partial<FieldMeta> = {};
    if (ui.visible !== undefined) {
      patch.visible = typeof ui.visible === 'function' ? !!ui.visible(scope) : !!ui.visible;
    }
    if (ui.disabled !== undefined) {
      patch.disabled = typeof ui.disabled === 'function' ? !!ui.disabled(scope) : !!ui.disabled;
    }
    if (ui.required !== undefined) {
      patch.required = typeof ui.required === 'function' ? !!ui.required(scope) : !!ui.required;
    }
    this.setMeta(target, patch);
  }

  private applyValue(target: FieldPath, value: ValueEffect, scope: Snapshot): boolean {
    if (!value.expr) return false;
    const next = value.expr(scope);
    const old = this.values.get(target);
    if (Object.is(old, next)) return false;
    this.values.set(target, next);
    this.onChange?.(target, next);
    return true;
  }

  private applyValidation(
    target: FieldPath,
    validation: ValidationEffect,
    scope: Snapshot,
  ): void {
    const rules: ValidationRule[] =
      typeof validation.rules === 'function' ? validation.rules(scope) : validation.rules;
    this.setMeta(target, { rules });
  }

  /**
   * DATA effect. Returns true if the target VALUE was cleared (clearOnChange),
   * which triggers transitive cascade. The async re-query updates options/meta
   * but does not itself drive the synchronous cascade.
   */
  private applyData(target: FieldPath, data: DataEffect, scope: Snapshot): boolean {
    let valueChanged = false;
    if (data.clearOnChange) {
      const old = this.values.get(target);
      if (old !== undefined) {
        this.values.set(target, undefined);
        this.onChange?.(target, undefined);
        valueChanged = true;
      }
    }

    this.setMeta(target, { loading: true });
    const fetcher = this.buildFetcher(data, scope);
    if (!fetcher) {
      this.setMeta(target, { loading: false, options: [] });
      return valueChanged;
    }

    // Fire-and-forget async re-query; updates options/meta when resolved.
    void Promise.resolve()
      .then(() => fetcher())
      .then((options) => {
        this.setMeta(target, { loading: false, options });
      })
      .catch((err) => {
        this.setMeta(target, { loading: false, options: [], error: String(err) });
      });

    return valueChanged;
  }

  private buildFetcher(data: DataEffect, scope: Snapshot): (() => Promise<unknown[]>) | null {
    switch (data.source.type) {
      case 'local':
        return async () => data.source.data ?? [];
      case 'fetcher':
        return data.source.fetcher ? () => data.source.fetcher!(scope) : null;
      case 'url':
        if (!data.source.url) return null;
        return async () => {
          const res = await fetch(data.source.url!);
          if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
          return (await res.json()) as unknown[];
        };
      case 'model':
        return null;
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  dispose(): void {
    this.listeners.clear();
    this.reactions = [];
    this.values.clear();
    this.meta.clear();
    // Drop ancestor link so a disposed child cannot keep a parent pinned in
    // memory through closures held by reaction authors.
    this.parent = null;
    this.evaluator = null;
  }
}
