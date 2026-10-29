// ============================================================================
// @bitcode/ui-schema — Root barrel
//
// Standalone UI schema definitions — domain-agnostic, framework-neutral types
// for schema-driven UI. Consumed by:
//   - @bitcode/ui (React/Vue/RN via Mitosis)
//   - @bitcode/ui-flutter (Dart port, Phase 5a)
//   - BitCode engine (optional mapping from domain models to UiSchema)
//   - Any standalone consumer (JsonForms-style usage)

export * from './expressions/index.ts';
// ============================================================================
// Action Runtime (ADR-018 S1-S8)
// ============================================================================

export * from './actions/index.ts';
//
// Zero framework dependency. Zero platform globals. Safe in Node/SSR/RN/Dart.
// ============================================================================

// Core types
export type {
  BcChangeHandler,
  BcChangeMeta,
  BcEventBase,
  BcEventSource,
  BcKey,
  BcSelection,
  ComponentSize,
  ComponentVariant,
  DataSource,
  FetchParams,
  FetchResult,
  FieldBlurEvent,
  FieldChangeEvent,
  FieldClearEvent,
  FieldInputEvent,
  FieldKeyEvent,
  FieldValidateEvent,
  InputSize,
  InputType,
  ModelAdapter,
  ResolvedTheme,
  ThemeMode,
  ValidationStatus,
} from './types.ts';

// Reactive engine
export { ReactiveStore } from './reactive/store.ts';
export type { Listener } from './reactive/store.ts';
export type {
  CompiledExpr,
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
} from './reactive/types.ts';

// Schema + resolver
export type {
  BcRendererProps,
  FieldNode,
  FieldType,
  UiAction,
  UiSchema,
  UiSchemaKind,
  WizardStepSchema,
  WizardValidationMode,
} from './schema/types.ts';

export {
  defaultFieldResolver,
  resolveField,
  resolveFieldType,
  resolveFields,
} from './schema/resolver.ts';

export type {
  FieldResolver,
  ResolvedFormField,
} from './schema/resolver.ts';

// ============================================================================
// Block Catalog (ADR-017)
// ============================================================================

export type {
  BlockAdaptivePolicy,
  BlockA11yEvidence,
  BlockCachePolicy,
  BlockCapability,
  BlockCatalogEntry,
  BlockCategory,
  BlockChannel,
  BlockMigrationMetadata,
  BlockOfflinePolicy,
  BlockPlatform,
  BlockPlatformFamily,
  BlockReadiness,
  BlockRenderStrategy,
  BlockSecurityPolicy,
  BlockTestReference,
  CandidateCatalogEntry,
  RequiredAdapter,
  RequiredComponent,
  RequiredFunction,
} from './block-catalog/index.ts';

export {
  BLOCK_CAPABILITY_ALIASES,
  CANONICAL_BLOCK_CAPABILITIES,
  findCapabilityAliases,
  isCanonicalCapability,
  isKnownCapabilityAlias,
  normalizeCapability,
  normalizeCapabilities,
} from './block-catalog/index.ts';

export {
  BLOCK_DIAGNOSTIC_CODES,
  validateBlockCatalogEntry,
  validateCandidateCatalogEntry,
} from './block-catalog/index.ts';
export type {
  BlockCatalogDiagnostic,
  BlockCatalogValidationResult,
  BlockDiagnosticSeverity,
} from './block-catalog/index.ts';

// Candidate fixtures (@internal - not a Ready catalog)
export {
  candidateContentHero,
  candidateFixtures,
  candidateInteractionNotificationCenter,
} from './block-catalog/index.ts';

// Ready promotions — the first production-Ready catalog entries (ADR-017/018).
export {
  READY_CATALOG_ENTRIES,
  READY_COUNT,
  getReadyEntryById,
} from './block-catalog/index.ts';

// ============================================================================
// Deep Block Catalog Validator (ADR-017 §8, plan §7, Agent I)
//
// Composes P1 shape validator + Agent F expression validator + Agent G action
// validator. Adds schemaPreset deep walk, serializability, nesting, minimal
// capability gates, and component reference checks. Reuses the existing
// BlockCatalogDiagnostic shape. Never throws. No Ready promotion.
// ============================================================================
export type {
  CatalogDiagnostic,
  CatalogDiagnosticSource,
  CatalogValidationResult,
} from './block-catalog/index.ts';
export {
  CATALOG_DIAGNOSTIC_CODES,
  CATALOG_DIAGNOSTIC_CODE_SET,
  severityRank,
} from './block-catalog/index.ts';
export type {
  CatalogValidationOptions,
  ComponentRegistryProbe,
} from './block-catalog/index.ts';
export {
  isActionSourceLike,
  isPortableExpressionLike,
  validateBlockCatalogEntryDeep,
  validateCatalogEntryDeep,
  validateEmbeddedActionSources,
} from './block-catalog/index.ts';

// ============================================================================
// Policy validators (ADR-017/018, Agent L)
//
// Compose over the shape validator. Same diagnostic model, separate
// BLOCK_POLICY_* code space. Never flip readiness (no Ready promotion).
// ============================================================================
export {
  DEFAULT_POLICY_CONFIG,
  gateSeverity,
  hasAnyCapability,
  hasCapability,
  isDeprecatedEntry,
  isReadyEntry,
  mergeResults,
  POLICY_DIAGNOSTIC_CODES,
  policyDiagnostic,
  resolvePolicyConfig,
  resultFromDiagnostics,
  validateAccessibilityPolicy,
  validateAdaptivePolicy,
  validateBlockCatalogPolicies,
  validateOfflinePolicy,
  validatePerformancePolicy,
  validateSecurityPolicy,
} from './block-catalog/index.ts';
export type {
  PolicyConfig,
  PolicyResult,
  ResolvedPolicyConfig,
} from './block-catalog/index.ts';

// ============================================================================
// Block Renderer (ADR-017 §3, Agent H)
//
// Portable block composition engine. Emits RENDER PLANS only — never framework
// output. Platform bindings translate plans into actual rendering. The
// registry stores COMPONENT METADATA only (no framework component objects).
// ============================================================================
export type {
  ActionHandlerPlan,
  BlockBindings,
  BlockNode,
  BlockRenderDiagnosticCode,
  BlockRenderScope,
  BlockRendererDeps,
  CatalogResolver,
  ComponentMetadata,
  ComponentRenderPlan,
  DiagnosticPlan,
  HiddenPlan,
  RenderOptions,
  RenderPlan,
  ResolvedBindings,
  ResolvedBlockTree,
  RuntimeAvailability,
  SchemaRenderPlan,
} from './block-renderer/index.ts';

export {
  BLOCK_RENDER_DIAGNOSTIC_CODES,
  BlockRenderer,
  InMemoryBlockComponentRegistry,
  availabilityFromContext,
  validateRuntimeRequirements,
} from './block-renderer/index.ts';
export type { BlockComponentRegistry } from './block-renderer/index.ts';
