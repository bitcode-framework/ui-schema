// ============================================================================
// @bitcode/ui-schema — Actions module barrel (ADR-018 S1-S8)
//
// Re-exports the full action runtime surface: ActionSource variants,
// ActionResult/Error, ActionEffect, lifecycle events, adapter + custom
// registry contracts, runtime context + adapters, effect runner, redaction,
// validators, diagnostic codes, and the ActionRunner.
//
// Pure types + portable runtime. No DOM/Flutter/React globals. The runner
// is platform-agnostic; hosts inject lifecycle emitters + adapters + sinks.
// ============================================================================

// Source model (ADR-018 S1)
export type {
  ActionSource,
  ActionSourceType,
  HandlerActionSource,
  LocalActionSource,
  ModelActionSource,
  UrlActionSource,
} from './source.ts';
export {
  ACTION_SOURCE_TYPES,
  isActionSourceType,
  isHandlerActionSource,
  isLocalActionSource,
  isModelActionSource,
  isUrlActionSource,
} from './source.ts';

// Result + errors (ADR-018 S2)
export type { ActionError, ActionResult, ActionResultStatus } from './result.ts';
export {
  errorResult,
  isValidationError,
  normalizeActionResult,
  successResult,
  validationErrorResult,
} from './result.ts';

// Effects (ADR-018 S4)
export type { ActionEffect, CloseOverlayEffect, EmitEffect, InvalidateKeyEffect, NavigateEffect, RefreshDataSourceEffect, ResetFormEffect, SetErrorEffect, SetMetaEffect, SetValueEffect, ToastEffect } from './effect.ts';
export {
  ACTION_EFFECT_KINDS,
  EFFECT_TIER_ORDER,
  effectTier,
  isActionEffectKind,
} from './effect.ts';

// Lifecycle (ADR-018 S3)
export type { ActionLifecycleEmitter, ActionLifecycleEvent, ActionPhase } from './lifecycle.ts';
export { ACTION_PHASES, buildLifecycleEvent } from './lifecycle.ts';

// Adapters + registries (ADR-018 S1, S7)
export type { ActionAdapter, ActionAdapterRegistry } from './adapter.ts';
export { InMemoryActionAdapterRegistry } from './adapter.ts';
export type { CustomActionRegistry } from './registry.ts';
export { InMemoryCustomActionRegistry } from './registry.ts';

// Runtime context + adapters (ADR-018 S7)
export type {
  ActionAdapterSet,
  ActionRuntimeContext,
  EffectSink,
  I18nAdapter,
  NavigationAdapter,
  PermissionAdapter,
  RedactConfig,
  ToastAdapter,
  UrlPolicy,
} from './runtime-context.ts';

// Effect runner (ADR-018 S4, S8)
export { applyEffects } from './effect-runner.ts';

// Redaction (ADR-018 S9)
export { redactSensitiveFields } from './redact.ts';

// Validators
export type { ActionValidationDiagnostic, SourceValidationResult } from './validate.ts';
export { checkUrlPolicy, validateActionSource, validateRuntimeContext } from './validate.ts';

// Diagnostic codes
export type { ActionDiagnosticCode } from './diagnostic-codes.ts';
export { ACTION_DIAGNOSTIC_CODES, isActionDiagnosticCode } from './diagnostic-codes.ts';

// Runner (ADR-018 S8)
export type { ActionRunnerDeps, ActionRunOptions } from './runner.ts';
export { ActionRunner } from './runner.ts';
