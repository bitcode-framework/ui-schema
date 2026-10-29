// ============================================================================
// @bitcode/ui-schema — Action Validation (ADR-018 S1, S7)
//
// Pure validators for ActionSource + runtime context. Runs BEFORE the runner
// emits `start` (preflight). Failures here mean the action never began —
// the runner emits `error` + `settled` but NOT `start` (Amendment 2).
//
// NO Ready-promotion logic here (Amendment 6). Ready gating is owned by the
// catalog validator (P4). This module validates action shape + context
// readiness only.
//
// Pure functions: never throw; return typed diagnostics.
// ============================================================================

import type { ActionSource } from './source.ts';
import { ACTION_SOURCE_TYPES, isActionSourceType } from './source.ts';
import type { UrlActionSource, ModelActionSource, HandlerActionSource } from './source.ts';
import type { ActionRuntimeContext } from './runtime-context.ts';
import type { ActionAdapterRegistry } from './adapter.ts';
import type { CustomActionRegistry } from './registry.ts';
import type { UrlPolicy } from './runtime-context.ts';

/** A validation diagnostic (typed, no secrets). */
export interface ActionValidationDiagnostic {
  code: string;
  message: string;
  /** Offending field path, e.g. `source.url` or `source.type`. */
  fieldPath?: string;
}

/** Result of validating an ActionSource structurally. */
export interface SourceValidationResult {
  valid: boolean;
  diagnostics: ActionValidationDiagnostic[];
}

/**
 * Validate an ActionSource structurally. Checks:
 *   - `type` is a known variant.
 *   - `local` has a non-null effects array.
 *   - `handler` has a non-empty handlerKey.
 *   - `url` has a non-empty url + valid method.
 *   - `model` has a non-empty model + valid operation; custom requires customOperation.
 */
export function validateActionSource(source: unknown): SourceValidationResult {
  const diagnostics: ActionValidationDiagnostic[] = [];
  if (!isPlainObject(source)) {
    return {
      valid: false,
      diagnostics: [
        { code: 'ACTION_SOURCE_INVALID', message: 'ActionSource must be a plain object.' },
      ],
    };
  }
  const s = source as Record<string, unknown>;
  const t = s.type;
  if (typeof t !== 'string' || !isActionSourceType(t)) {
    diagnostics.push({
      code: 'ACTION_SOURCE_INVALID',
      message: `Unknown action source type '${String(t)}'. Expected one of: ${Array.from(ACTION_SOURCE_TYPES).join(', ')}.`,
      fieldPath: 'source.type',
    });
    return { valid: false, diagnostics };
  }
  switch (t) {
    case 'local':
      validateLocal(s, diagnostics);
      break;
    case 'handler':
      validateHandler(s as unknown as HandlerActionSource, diagnostics);
      break;
    case 'url':
      validateUrl(s as unknown as UrlActionSource, diagnostics);
      break;
    case 'model':
      validateModel(s as unknown as ModelActionSource, diagnostics);
      break;
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

/** Validate that required context pieces exist for a given source type. */
export function validateRuntimeContext(
  source: ActionSource,
  ctx: ActionRuntimeContext,
  adapterRegistry: ActionAdapterRegistry,
  customRegistry: CustomActionRegistry,
): ActionValidationDiagnostic[] {
  const diags: ActionValidationDiagnostic[] = [];
  if (!ctx) {
    diags.push({ code: 'ACTION_SOURCE_INVALID', message: 'Runtime context is missing.' });
    return diags;
  }
  if (!ctx.effectSink) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: 'Runtime context is missing effectSink (required for all sources).',
      fieldPath: 'ctx.effectSink',
    });
  }
  switch (source.type) {
    case 'local':
      // local needs only the sink (checked above).
      break;
    case 'handler': {
      if (!customRegistry.has(source.handlerKey)) {
        diags.push({
          code: 'ACTION_ADAPTER_MISSING',
          message: `No handler registered for handlerKey '${source.handlerKey}'.`,
          fieldPath: 'source.handlerKey',
        });
      }
      break;
    }
    case 'url': {
      const key = 'url';
      if (!adapterRegistry.has(key)) {
        diags.push({
          code: 'ACTION_ADAPTER_MISSING',
          message: `No adapter registered for url actions (key '${key}').`,
          fieldPath: 'adapters.url',
        });
      }
      break;
    }
    case 'model': {
      const key = source.adapter ?? 'model';
      if (!adapterRegistry.has(key)) {
        diags.push({
          code: 'ACTION_ADAPTER_MISSING',
          message: `No adapter registered for model actions (key '${key}').`,
          fieldPath: `adapters.${key}`,
        });
      }
      break;
    }
  }
  return diags;
}

/** Preflight URL allowlist check (Amendment 5). */
export function checkUrlPolicy(
  source: UrlActionSource,
  policy: UrlPolicy | undefined,
): ActionValidationDiagnostic[] {
  if (!policy) return []; // absent policy = host responsibility, allowed by default.
  if (!policy.isAllowed(source.url, source.method)) {
    return [
      {
        code: 'ACTION_URL_NOT_ALLOWED',
        message: `URL '${source.url}' (${source.method}) is not allowed by the url policy.`,
        fieldPath: 'source.url',
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Per-variant structural validation
// ---------------------------------------------------------------------------

function validateLocal(s: Record<string, unknown>, diags: ActionValidationDiagnostic[]): void {
  if (!Array.isArray(s.effects)) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: "local action source requires an 'effects' array.",
      fieldPath: 'source.effects',
    });
  }
}

function validateHandler(
  s: HandlerActionSource,
  diags: ActionValidationDiagnostic[],
): void {
  if (typeof s.handlerKey !== 'string' || s.handlerKey.length === 0) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: 'handler action source requires a non-empty handlerKey.',
      fieldPath: 'source.handlerKey',
    });
  }
}

function validateUrl(s: UrlActionSource, diags: ActionValidationDiagnostic[]): void {
  if (typeof s.url !== 'string' || s.url.length === 0) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: 'url action source requires a non-empty url.',
      fieldPath: 'source.url',
    });
  }
  const validMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!validMethods.has(s.method)) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: `url action source method must be one of POST|PUT|PATCH|DELETE, got '${String(s.method)}'.`,
      fieldPath: 'source.method',
    });
  }
}

function validateModel(s: ModelActionSource, diags: ActionValidationDiagnostic[]): void {
  if (typeof s.model !== 'string' || s.model.length === 0) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: 'model action source requires a non-empty model name.',
      fieldPath: 'source.model',
    });
  }
  const validOps = new Set(['create', 'update', 'delete', 'upsert', 'restore', 'custom']);
  if (!validOps.has(s.operation)) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: `model action source operation must be one of create|update|delete|upsert|restore|custom, got '${String(s.operation)}'.`,
      fieldPath: 'source.operation',
    });
  }
  if (s.operation === 'custom' && (typeof s.customOperation !== 'string' || s.customOperation.length === 0)) {
    diags.push({
      code: 'ACTION_SOURCE_INVALID',
      message: "model action source with operation 'custom' requires a non-empty customOperation.",
      fieldPath: 'source.customOperation',
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
