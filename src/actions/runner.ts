// ============================================================================
// @bitcode/ui-schema — ActionRunner (ADR-018 S8)
//
// Orchestrates action execution per the ADR-018 S8 state machine:
//
//   1. Preflight: validate source + ctx (Amendment 2: failures do NOT emit start).
//   2. Build permission-filtered scope (Agent F buildPermissionFilteredScope).
//   3. Evaluate PortableExpression AST payloads against filtered scope.
//   4. If all preflight passes + not aborted → emit `start`.
//   5. Invoke adapter (handler/url/model) or run local effects directly.
//   6. Normalize result.
//   7. Apply validation errors (via setError sink routing).
//   8. Apply effects in deterministic tier order (effect-runner.ts).
//   9. Emit success / validation-error / error.
//  10. Emit settled (exactly once, on ALL exit paths).
//  11. Return normalized ActionResult.
//
// Amendments honored:
//   2: preflight failures do NOT emit start; settled fires once on all paths.
//   3: effects route through EffectSink + adapters, never mutate a store.
//   4: PermissionAdapter optional; reads scope.permissions.
//   5: UrlPolicy host-injected, checked in preflight.
//   7: abort (AbortSignal) vs timeout (opts.timeoutMs) are distinct codes.
//
// The runner is portable: no DOM/Flutter/React globals. It calls the injected
// ActionLifecycleEmitter (optional) for lifecycle events.
// ============================================================================

import type { PortableExpression } from '../expressions/ast.ts';
import type { ExpressionScope, ExpressionEvaluator } from '../expressions/index.ts';
import { buildPermissionFilteredScope } from '../expressions/index.ts';
import type { BcChangeMeta } from '../types.ts';

import type { ActionSource } from './source.ts';
import { isUrlActionSource, isLocalActionSource } from './source.ts';
import type { ActionResult } from './result.ts';
import { normalizeActionResult, errorResult, isValidationError } from './result.ts';
import type { ActionLifecycleEmitter } from './lifecycle.ts';
import { buildLifecycleEvent } from './lifecycle.ts';
import type { ActionRuntimeContext } from './runtime-context.ts';
import type { ActionAdapterRegistry } from './adapter.ts';
import type { CustomActionRegistry } from './registry.ts';
import { validateActionSource, validateRuntimeContext, checkUrlPolicy } from './validate.ts';
import { applyEffects } from './effect-runner.ts';
import { redactSensitiveFields } from './redact.ts';

/** Options for ActionRunner.run(). */
export interface ActionRunOptions {
  /** Cooperative cancellation. Aborted signal → ACTION_ABORTED. */
  signal?: AbortSignal;
  /** Timeout in ms (distinct from abort). Exceeded → ACTION_TIMEOUT. */
  timeoutMs?: number;
  /** Stable action id. If provided and in-flight, dedupes (returns same promise). */
  actionId?: string;
}

/** Dependencies the runner needs (injected at construction). */
export interface ActionRunnerDeps {
  adapterRegistry: ActionAdapterRegistry;
  customRegistry: CustomActionRegistry;
  /** Optional AST evaluator (required only when payloads are PortableExpression). */
  evaluator?: ExpressionEvaluator;
  /** Optional lifecycle emitter. If absent, runner skips lifecycle emission. */
  emit?: ActionLifecycleEmitter;
}

/**
 * ActionRunner: portable, platform-agnostic action orchestrator.
 *
 * Construct once, reuse across runs. Each run reads from its own context.
 */
export class ActionRunner {
  private readonly deps: ActionRunnerDeps;
  private readonly inFlight = new Map<string, Promise<ActionResult>>();

  constructor(deps: ActionRunnerDeps) {
    this.deps = deps;
  }

  /**
   * Run an action. Never throws to the caller: all failures normalize to an
   * ActionResult with ok=false. `settled` fires exactly once on all paths.
   */
  /**
   * Run an action. Never throws to the caller: all failures normalize to an
   * ActionResult with ok=false. `settled` fires exactly once on all paths.
   *
   * This method is intentionally NON-async: the dedup path returns the exact
   * stored Promise reference (not an async-wrapper copy) so callers comparing
   * references (or awaiting in parallel) get the identical in-flight promise.
   */
  run(
    action: ActionSource,
    payload: unknown,
    ctx: ActionRuntimeContext,
    opts: ActionRunOptions = {},
  ): Promise<ActionResult> {
    const actionId = opts.actionId ?? `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Dedup by actionId (E14): return the EXACT in-flight promise reference.
    if (opts.actionId && this.inFlight.has(opts.actionId)) {
      return this.inFlight.get(opts.actionId)!;
    }

    const runPromise = this.execute(action, payload, ctx, opts, actionId);
    if (opts.actionId) {
      const dedupId = opts.actionId;
      this.inFlight.set(dedupId, runPromise);
      // Clean up after settle regardless of outcome.
      void runPromise.finally(() => {
        this.inFlight.delete(dedupId);
      });
    }
    return runPromise;
  }

  /** The real execution path. */
  private async execute(
    action: ActionSource,
    payload: unknown,
    ctx: ActionRuntimeContext,
    opts: ActionRunOptions,
    actionId: string,
  ): Promise<ActionResult> {
    const meta: BcChangeMeta = { reason: 'action', source: 'programmatic' };
    const emit = this.deps.emit;
    const redact = ctx.redact;

    // Helper to emit + settle. Always returns the result so callers can `return`.
    const failPreflight = (result: ActionResult): ActionResult => {
      emit?.(buildLifecycleEvent(actionId, action, 'error', meta, {
        result: redactResult(result, redact),
      }));
      emit?.(buildLifecycleEvent(actionId, action, 'settled', meta));
      return result;
    };

    // ── Preflight ──────────────────────────────────────────────────────────

    // Abort-before-start check (Amendment 7: distinct from timeout).
    if (opts.signal?.aborted) {
      return failPreflight(errorResult('ACTION_ABORTED', 'Action was aborted before it started.', { recoverable: true }));
    }

    // 1. Validate source structure.
    const sourceResult = validateActionSource(action);
    if (!sourceResult.valid) {
      const msg = sourceResult.diagnostics.map((d) => d.message).join(' ');
      return failPreflight(errorResult('ACTION_SOURCE_INVALID', msg));
    }

    // 1b. Validate context readiness (adapter registration).
    const ctxDiags = validateRuntimeContext(action, ctx, this.deps.adapterRegistry, this.deps.customRegistry);
    if (ctxDiags.length > 0) {
      // Use the first diagnostic's code; concat messages.
      const first = ctxDiags[0];
      return failPreflight(errorResult(first.code, ctxDiags.map((d) => d.message).join(' ')));
    }

    // 1c. URL allowlist check (Amendment 5).
    if (isUrlActionSource(action)) {
      const urlDiags = checkUrlPolicy(action, ctx.adapters.urlPolicy);
      if (urlDiags.length > 0) {
        return failPreflight(errorResult(urlDiags[0].code, urlDiags[0].message));
      }
    }

    // 2. Build permission-filtered scope (Agent F).
    const baseScope = ctx.permissions
      ? { ...ctx.scope, permissions: ctx.permissions }
      : ctx.scope;
    const filteredScope = buildPermissionFilteredScope(baseScope);

    // 3. Evaluate AST payloads against filtered scope.
    let resolvedPayload = payload;
    try {
      resolvedPayload = await this.resolvePayload(action, payload, filteredScope);
    } catch (err) {
      // Expression errors surface here (e.g. EXPR_PATH_MISSING).
      const message = isExpressionError(err) ? err.message : String(err);
      return failPreflight(errorResult('ACTION_SOURCE_INVALID', `Payload expression evaluation failed: ${message}`));
    }

    // ── All preflight passed → emit start ──────────────────────────────────
    emit?.(buildLifecycleEvent(actionId, action, 'start', meta, {
      payload: redactPayload(resolvedPayload, redact),
    }));

    // ── Execute ────────────────────────────────────────────────────────────

    let rawResult: unknown;
    try {
      if (isLocalActionSource(action)) {
        // local source: run effects directly, return success.
        rawResult = await this.runLocal(action, resolvedPayload, ctx, opts, actionId, meta);
      } else {
        rawResult = await this.runAdapter(action, resolvedPayload, ctx, opts);
      }
    } catch (err) {
      // Adapter threw (contract violation) OR abort/timeout surfaced as throw.
      const result = this.classifyThrow(err, opts);
      this.finishRun(action, actionId, meta, emit, redact, ctx, result);
      return result;
    }

    // ── Normalize + settle ─────────────────────────────────────────────────

    const result = normalizeActionResult(rawResult);
    this.finishRun(action, actionId, meta, emit, redact, ctx, result);
    return result;
  }

  /** Run a local action: apply its effects directly, return success. */
  private async runLocal(
    action: Extract<ActionSource, { type: 'local' }>,
    payload: unknown,
    ctx: ActionRuntimeContext,
    opts: ActionRunOptions,
    actionId: string,
    meta: BcChangeMeta,
  ): Promise<ActionResult> {
    // Apply local effects in deterministic order. Effects are applied HERE,
    // not included in the result, so finishRun() will NOT re-apply them
    // (finishRun only applies result.effects from adapter responses).
    const diags = applyEffects(action.effects, ctx.effectSink, ctx.adapters);
    const result: ActionResult = {
      ok: true,
      status: 'success',
      ...(diags.length === 0
        ? {}
        : {
            errorList: diags.map((d) => ({ code: d.code, message: d.message, severity: 'warning' as const })),
            message: 'Action completed with effect warnings.',
          }),
    };
    void payload;
    void opts;
    void actionId;
    void meta;
    return result;
  }

  /** Run a handler/url/model action via its adapter, with timeout race. */
  private async runAdapter(
    action: ActionSource,
    payload: unknown,
    ctx: ActionRuntimeContext,
    opts: ActionRunOptions,
  ): Promise<unknown> {
    const adapter = this.resolveAdapter(action);
    const signal = opts.signal ?? undefined;

    if (opts.timeoutMs !== undefined && opts.timeoutMs > 0) {
      // Race the adapter call against a timeout (Amendment 7: distinct from abort).
      return await this.raceWithTimeout(
        () => adapter!.execute(action, payload, ctx, signal ?? new AbortController().signal),
        opts.timeoutMs,
        signal,
      );
    }
    return await adapter!.execute(action, payload, ctx, signal ?? new AbortController().signal);
  }

  /** Race a promise against a timeout, returning ACTION_TIMEOUT on expiry. */
  private async raceWithTimeout(
    fn: () => Promise<unknown>,
    timeoutMs: number,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ActionTimeoutError(timeoutMs));
      }, timeoutMs);

      const onAbort = () => {
        clearTimeout(timer);
        reject(new ActionAbortedError());
      };
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new ActionAbortedError());
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      fn()
        .then((v) => {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(e);
        });
    });
  }

  /** Resolve the adapter for a non-local action. */
  private resolveAdapter(action: ActionSource) {
    if (action.type === 'handler') {
      return this.deps.customRegistry.resolve(action.handlerKey)!;
    }
    if (action.type === 'url') {
      return this.deps.adapterRegistry.resolve('url')!;
    }
    if (action.type === 'model') {
      return this.deps.adapterRegistry.resolve(action.adapter ?? 'model')!;
    }
    throw new Error(`resolveAdapter: unsupported source type '${(action as { type: string }).type}'.`);
  }

  /** Evaluate PortableExpression payloads against the filtered scope. */
  private async resolvePayload(
    action: ActionSource,
    payload: unknown,
    scope: ExpressionScope,
  ): Promise<unknown> {
    // Resolve url.body / model.id / model.payload if they are AST nodes.
    const evaluator = this.deps.evaluator;
    if (!evaluator) {
      // No evaluator: payloads that are AST nodes are a contract violation.
      // Pass through literal payloads; throw for unevaluated AST nodes.
      this.assertNoAst(action, payload);
      return payload;
    }

    // url body
    if (action.type === 'url' && action.body !== undefined) {
      const body = action.body;
      if (isAstNode(body)) {
        const evaluated = evaluator.evaluate(body as PortableExpression, scope);
        return { ...(typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}), __body: evaluated };
      }
    }
    // model id + payload
    if (action.type === 'model') {
      let resolvedId: unknown = action.id;
      let resolvedPayload: unknown = action.payload;
      if (resolvedId !== undefined && isAstNode(resolvedId)) {
        resolvedId = evaluator.evaluate(resolvedId as PortableExpression, scope);
      }
      if (resolvedPayload !== undefined && isAstNode(resolvedPayload)) {
        resolvedPayload = evaluator.evaluate(resolvedPayload as PortableExpression, scope);
      }
      // Merge resolved id/payload into the runtime payload record.
      const base = typeof payload === 'object' && payload !== null ? { ...(payload as Record<string, unknown>) } : {};
      if (resolvedId !== undefined) base.__id = resolvedId;
      if (resolvedPayload !== undefined) base.__payload = resolvedPayload;
      return base;
    }
    this.assertNoAst(action, payload);
    return payload;
  }

  /** Throw if a payload or source field is an unevaluated AST node with no evaluator. */
  private assertNoAst(action: ActionSource, payload: unknown): void {
    if (action.type === 'url' && isAstNode(action.body)) {
      throw new Error('url action body is a PortableExpression but no evaluator is registered.');
    }
    if (action.type === 'model' && (isAstNode(action.id) || isAstNode(action.payload))) {
      throw new Error('model action id/payload is a PortableExpression but no evaluator is registered.');
    }
    if (isAstNode(payload)) {
      throw new Error('payload is a PortableExpression but no evaluator is registered.');
    }
  }

  /** Classify a thrown error into abort / timeout / adapter-threw. */
  private classifyThrow(err: unknown, opts: ActionRunOptions): ActionResult {
    if (err instanceof ActionAbortedError || opts.signal?.aborted) {
      return errorResult('ACTION_ABORTED', 'Action was aborted.', { recoverable: true });
    }
    if (err instanceof ActionTimeoutError) {
      return errorResult('ACTION_TIMEOUT', `Action exceeded timeout of ${err.timeoutMs}ms.`, { recoverable: true });
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResult('ACTION_ADAPTER_THREW', `Adapter threw an un-normalized error: ${message}`);
  }

  /** Finish a run: emit phases + settle exactly once. */
  private finishRun(
    action: ActionSource,
    actionId: string,
    meta: BcChangeMeta,
    emit: ActionLifecycleEmitter | undefined,
    redact: ActionRuntimeContext['redact'],
    ctx: ActionRuntimeContext,
    result: ActionResult,
  ): void {
    const redacted = redactResult(result, redact);

    // 7. Apply validation errors via setError sink routing.
    if (!result.ok && result.errors) {
      for (const [field, msg] of Object.entries(result.errors)) {
        const message = Array.isArray(msg) ? msg.join('; ') : msg;
        ctx.effectSink.setError(field, message);
      }
    }

    // 8. Apply result effects in deterministic order.
    if (result.effects && result.effects.length > 0) {
      applyEffects(result.effects, ctx.effectSink, ctx.adapters);
    }

    // 9. Emit success / validation-error / error.
    const phase = result.ok
      ? 'success'
      : isValidationError(result)
        ? 'validation-error'
        : 'error';
    emit?.(buildLifecycleEvent(actionId, action, phase, meta, {
      result: redacted,
    }));

    // 10. Emit settled exactly once.
    emit?.(buildLifecycleEvent(actionId, action, 'settled', meta));
  }
}

// ---------------------------------------------------------------------------
// Sentinel error classes (for classifyThrow discrimination)
// ---------------------------------------------------------------------------

class ActionAbortedError extends Error {
  readonly kind = 'aborted' as const;
  constructor() {
    super('Action aborted.');
    this.name = 'ActionAbortedError';
  }
}

class ActionTimeoutError extends Error {
  readonly kind = 'timeout' as const;
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Action timed out after ${timeoutMs}ms.`);
    this.name = 'ActionTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

function redactPayload(payload: unknown, redact: ActionRuntimeContext['redact']): unknown {
  return redactSensitiveFields(payload, redact);
}

function redactResult(result: ActionResult, redact: ActionRuntimeContext['redact']): ActionResult {
  if (!redact || !result.data) return result;
  return { ...result, data: redactSensitiveFields(result.data, redact) as unknown };
}

// ---------------------------------------------------------------------------
// AST detection + expression error detection
// ---------------------------------------------------------------------------

function isAstNode(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    ['literal', 'path', 'op', 'call', 'if'].includes(
      (value as { kind: string }).kind,
    )
  );
}

function isExpressionError(err: unknown): err is { message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  );
}
