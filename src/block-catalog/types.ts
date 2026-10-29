// ============================================================================
// @bitcode/ui-schema — Block Catalog Types (ADR-017)
//
// Canonical, framework-neutral Block Catalog contract. Consumed by:
//   - @bitcode/ui (web catalog source, BcBlockRenderer, validators)
//   - @bitcode/ui-flutter (Dart mirror, BcBlockRenderer equivalent)
//   - Catalog validation tooling (build-time + runtime gates)
//
// Pure types only. No React, DOM, Mitosis, Flutter, engine, provider SDK,
// or runtime imports. Everything is JSON-serializable-friendly.
//
// Ready gate (ADR-017 §4): Ready means production-grade across web and
// Flutter from day one. Candidate entries exist for planning, tests, reports,
// and builder diagnostics — NOT as default runtime input.
// ============================================================================

import type { UiSchema } from '../schema/types.ts';

// ---------------------------------------------------------------------------
// Category, Channel, Capability, Readiness, Render Strategy
// ---------------------------------------------------------------------------

/**
 * Top-level catalog categories (ADR-017 §2). Capability families; do NOT
 * replace the ADR-003 component source taxonomy. `account` is a subcategory,
 * not a top-level category.
 */
export type BlockCategory =
  | 'content'
  | 'data'
  | 'interaction'
  | 'commerce'
  | 'workflow'
  | 'builder'
  | 'analytics'
  | 'navigation';

/**
 * Channels describe where a block is commonly used (ADR-017 §2). They are
 * metadata and filtering hints only — NOT security boundaries.
 */
export type BlockChannel = 'website' | 'portal' | 'internal' | 'saas';

/**
 * Canonical capability tags (ADR-017 §2). Drive validation and runtime
 * requirements. Any capability implying runtime behavior must map to a
 * validator.
 *
 * NOTE: `action-source` is the canonical capability. The accepted matrix
 * (v0.1.0) uses `action-trigger` for some pre-ADR candidates; that token is
 * a pre-ADR alias normalized to `action-source` before Ready validation
 * (see `capability.ts`). The matrix itself is NOT modified in P1.
 *
 * Additional matrix-only capability tokens (e.g. `pagination`, `search`,
 * `form`, `validation`, `rich-text`, `carousel-optional`, `external-link`)
 * are descriptive hints. They are not in this canonical union; entries may
 * still carry them as strings via the open-ended capability representation,
 * but Ready validation reasons about the canonical set below.
 */
export type BlockCapability =
  | 'static'
  | 'data-source'
  | 'action-source'
  | 'reactive'
  | 'permission-aware'
  | 'i18n'
  | 'a11y'
  | 'responsive'
  | 'adapt'
  | 'provider-adapter'
  | 'commerce'
  | 'payment-adapter'
  | 'workflow'
  | 'builder'
  | 'large-data'
  | 'offline'
  | 'sanitize'
  | 'security';

/**
 * Readiness state of a catalog entry (ADR-017 §1, §4).
 *
 * - `candidate` — listed for planning/tests/reports; NOT runtime input.
 * - `ready`     — production-grade across web + Flutter (all gates pass).
 * - `deprecated`— superseded; may carry `deprecatedBy`.
 */
export type BlockReadiness = 'candidate' | 'ready' | 'deprecated';

/**
 * How an entry materializes (ADR-017 §3).
 *
 * - `schema`    — resolves to `UiSchema` and delegates to `BcRenderer`.
 * - `component` — resolves to a registered platform component key.
 */
export type BlockRenderStrategy = 'schema' | 'component';

// ---------------------------------------------------------------------------
// Platform descriptors (used by Required* declarations + adaptive policy)
// ---------------------------------------------------------------------------

/**
 * Platform identifiers used across required-component/function/adapter
 * declarations, function manifests, and migration metadata.
 */
export type BlockPlatform = 'web' | 'flutter' | 'react-native' | 'server';

/**
 * Platform-aware UI family (ADR-011). iOS/macOS favor Cupertino patterns;
 * Android/web/desktop favor Material patterns where no native equivalent
 * exists. A single adaptive policy can declare both behaviors.
 */
export type BlockPlatformFamily = 'cupertino' | 'material';

// ---------------------------------------------------------------------------
// Required declarations (string OR structured for future-proofing)
// ---------------------------------------------------------------------------

/**
 * Declares a required component key. A bare string (e.g. `BcGridView`) is the
 * common case; the structured form adds platform scoping, optionality, and
 * notes for richer validation without forcing every entry to be verbose.
 *
 * Registry keys are canonical component keys (e.g. `BcGridView`), never file
 * paths. Web validates source + export from `packages/ui/src/index.ts`;
 * Flutter validates source + export from `bc_ui_flutter.dart`.
 */
export type RequiredComponent =
  | string
  | {
      key: string;
      platforms?: BlockPlatform[];
      optional?: boolean;
      notes?: string;
    };

/**
 * Declares a required function (built-in or host). Built-ins live under
 * versioned namespaces (`math.*`, `string.*`, ...). Host functions require an
 * explicit manifest entry and fallback policy (ADR-018 §6).
 */
export type RequiredFunction =
  | string
  | {
      name: string;
      version?: string;
      platforms?: BlockPlatform[];
      fallback?: 'error' | 'literal' | 'empty' | 'host';
    };

/**
 * Declares a required adapter (data, action, permission, navigation, ...).
 * Adapters own auth and secrets; catalog schema never embeds credentials.
 */
export type RequiredAdapter =
  | string
  | {
      name: string;
      kind?:
        | 'data'
        | 'action'
        | 'permission'
        | 'navigation'
        | 'toast'
        | 'i18n'
        | 'media'
        | 'model';
      platforms?: BlockPlatform[];
      optional?: boolean;
    };

// ---------------------------------------------------------------------------
// Policies (production-grade, serializable; declared even if "none")
// ---------------------------------------------------------------------------

/**
 * Adaptive policy (ADR-017 §4 adaptive gate, ADR-011 platform awareness).
 * Complex blocks must explicitly cover breakpoints, platform morphing,
 * reduced motion, and loading/empty/error/disabled states.
 */
export interface BlockAdaptivePolicy {
  /** Inherit from another entry id when this block is a variant. */
  inherits?: string;
  /** Explicit breakpoint coverage, or `true` for default set. */
  breakpoints?: boolean | string[];
  /**
   * Platform-aware morphing per ADR-011. Array lists families the block
   * targets (e.g. `['cupertino','material']`); `'inherit'` defers to parent.
   */
  platformMorph?: BlockPlatformFamily[] | 'inherit';
  reducedMotion?: boolean | 'inherit';
  loadingState?: boolean;
  emptyState?: boolean;
  errorState?: boolean;
  disabledState?: boolean;
  notes?: string;
}

/**
 * Security / privacy policy (ADR-017 §4 security gate, ADR-018 §9).
 * Stricter for URL, file, rich text, payment, provider, and action blocks.
 */
export interface BlockSecurityPolicy {
  /** URL allowlist for url/provider/media actions. */
  urlAllowlist?: string[];
  /** Rich text sanitization. Defaults ON; opt-out must be policy-gated. */
  richTextSanitize?: 'on' | 'opt-out-policy' | 'n/a';
  /** File actions policy. */
  filePolicy?: {
    allowedTypes?: string[];
    maxSizeBytes?: number;
    scanning?: boolean;
  };
  /** Payment blocks require a generic payment adapter (no provider secrets). */
  paymentAdapterRequired?: boolean;
  /** Sensitive payload fields to redact from logs/lifecycle events. */
  redactFields?: string[];
  /** External link handling. */
  externalLinks?: 'allow' | 'allowlist' | 'deny';
  notes?: string;
}

/**
 * Cache policy. Must be declared even when `strategy === 'none'`.
 */
export interface BlockCachePolicy {
  strategy: 'none' | 'memory' | 'persisted' | 'inherit';
  ttlSeconds?: number;
  /** Event/keys that invalidate the cache. */
  invalidateOn?: string[];
  notes?: string;
}

/**
 * Offline policy (ADR-018 §9). Must be declared even when unsupported.
 * Read-write support requires durable queue semantics (ADR-018 §6.4).
 */
export interface BlockOfflinePolicy {
  support: 'unsupported' | 'read' | 'read-write';
  /** Required only when `support === 'read-write'` (action-capable offline). */
  queue?: {
    durable?: boolean;
    retryBackoff?: 'fixed' | 'exponential';
    idempotencyKey?: boolean;
    replayOnReconnect?: boolean;
    conflictResolution?: 'last-write-wins' | 'field-merge' | 'manual';
    /** Revalidate permissions before replaying queued actions. */
    permissionRevalidation?: boolean;
  };
  /** Surface visible failure and recovery states to the user. */
  visibleFailureStates?: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Migration, a11y evidence, test references
// ---------------------------------------------------------------------------

/**
 * Versioning and migration metadata. Catalog migration is explicit, never
 * inferred from shape alone (ADR-017 §1).
 */
export interface BlockMigrationMetadata {
  /** Prior version this entry migrated from (optional for initial release). */
  fromVersion?: string;
  /** Current/target version. */
  toVersion: string;
  migrationNotes?: string;
  breakingChanges?: boolean;
  /** Fields removed or renamed in this version. */
  deprecatedFields?: string[];
}

/**
 * Accessibility evidence (ADR-017 §4 a11y gate). Evidence must be linkable
 * from catalog metadata or a generated readiness report — not prose-only.
 */
export interface BlockA11yEvidence {
  /** Documented block-level accessibility contract. */
  contract?: string;
  /** Test artifact reference (e.g. test file path or report id). */
  testReference?: string;
  /** Generated readiness report reference. */
  reportReference?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  notes?: string;
}

/**
 * Test references (ADR-017 §4 test gate). Schema, web render, Flutter render,
 * action mock, and a11y tests as applicable.
 */
export interface BlockTestReference {
  schema?: string;
  web?: string;
  flutter?: string;
  actionMock?: string;
  a11y?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Main entry types
// ---------------------------------------------------------------------------

/**
 * A Block Catalog entry — a metadata descriptor, NOT a new component class.
 * (ADR-017 §1). This is the shared shape for both Ready and Candidate entries.
 *
 * Ready-required fields are marked `[Ready]`. A Candidate may omit them; the
 * validator reports them as `info`/`warning` (not errors). A Ready entry MUST
 * populate every `[Ready]` field AND pass the full cross-package gate
 * (web/Flutter source+export, demos) implemented in P4.
 *
 * Responsibilities (fixed even if field names evolve):
 * - `id` is a namespaced slug such as `content.hero`.
 * - `version` and `schemaVersion` are mandatory.
 * - User-facing labels use `labelKey` + `fallbackLabel`.
 * - `capabilities` use canonical names; pre-ADR aliases are normalized
 *   before Ready validation (see `capability.ts`).
 * - `renderStrategy` is explicit; strategy-specific fields are required.
 */
export interface BlockCatalogEntry {
  /** Namespaced stable slug, e.g. `content.hero`, `commerce.product-grid`. */
  id: string;

  /** Semver-like block version. [Ready] */
  version: string;

  /** Catalog schema version (ADR-017 migration). [Ready] */
  schemaVersion: string;

  /** i18n key for the user-facing label. [Ready] */
  labelKey: string;

  /**
   * English fallback label. Ready entries MUST have an English fallback
   * (ADR-017 §4). [Ready]
   */
  fallbackLabel: string;

  /** Top-level category (ADR-017 §2). [Ready] */
  category: BlockCategory;

  /** Optional finer grouping (e.g. `marketing`, `account`). */
  subcategory?: string;

  /**
   * Non-empty array of channels. Filtering hints, not security boundaries.
   * [Ready]
   */
  channels: BlockChannel[];

  /**
   * Capability tags (canonical names). Each behavioral capability maps to a
   * validator. [Ready]
   */
  capabilities: BlockCapability[];

  /** Explicit render strategy. [Ready] */
  renderStrategy: BlockRenderStrategy;

  /**
   * Schema preset for `renderStrategy === 'schema'`. Must contain only
   * serializable values. Required for schema-strategy Ready entries.
   */
  schemaPreset?: UiSchema;

  /**
   * Registered component key for `renderStrategy === 'component'`. String
   * only — never a function/class. Required for component-strategy Ready
   * entries.
   */
  componentKey?: string;

  /**
   * Explicit component keys validated against web + Flutter source/export.
   * [Ready] (non-empty for Ready)
   */
  requiredComponents?: RequiredComponent[];

  /** [Ready] (may be empty array if none required, but field should exist) */
  requiredFunctions?: RequiredFunction[];

  /** [Ready] (may be empty array if none required, but field should exist) */
  requiredAdapters?: RequiredAdapter[];

  /** Adaptive policy, declared or inherited. [Ready] */
  adaptivePolicy?: BlockAdaptivePolicy;

  /** Security policy. [Ready] — declared for all entries. */
  securityPolicy?: BlockSecurityPolicy;

  /** Cache policy. [Ready] — declared even if `none`. */
  cachePolicy?: BlockCachePolicy;

  /** Offline policy. [Ready] — declared even if `unsupported`. */
  offlinePolicy?: BlockOfflinePolicy;

  /** Versioning/migration metadata. [Ready] */
  migration?: BlockMigrationMetadata;

  /** Readiness state. Runtime reads only `ready` entries by default. [Ready] */
  readiness: BlockReadiness;

  /** A11y evidence link. [Ready] */
  a11yEvidence?: BlockA11yEvidence;

  /** Test references. [Ready] */
  tests?: BlockTestReference;

  /** Optional retained aliases for search/reference. */
  aliases?: string[];

  /**
   * For `readiness === 'deprecated'`: the entry id that supersedes this one.
   */
  deprecatedBy?: string;
}

/**
 * A Candidate catalog entry (ADR-017 §1). Carries matrix-only metadata used
 * for planning, reports, builder diagnostics, and Ready-promotion tracking.
 *
 * Runtime MUST NOT consume Candidate entries by default. Candidate fields are
 * a superset of `BlockCatalogEntry` and add planning metadata drawn from the
 * accepted matrix baseline.
 */
export interface CandidateCatalogEntry extends BlockCatalogEntry {
  /** Source references (e.g. `chatgpt:Hero Banner`, `elementor:Slides`). */
  sourceReferences?: string[];

  /** Matrix decision (ADR-017 §4 matrix gate). */
  decision?: 'keep' | 'merge' | 'split' | 'alias' | 'exclude';

  /** Matrix status from the accepted baseline (e.g. `schema-preset-only`). */
  matrixStatus?: string;

  /** Documented gaps blocking Ready promotion. */
  gaps?: string[];

  /** Matrix priority batch (e.g. `content-website`, `erp-data-interaction`). */
  priorityBatch?: string;

  /** Entry ids or work items blocking Ready promotion. */
  blockedBy?: string[];

  /** Optional checklist tracking remaining Ready-promotion work. */
  readyPromotionChecklist?: string[];

  /** Documented change record (when matrix baseline is amended). */
  changeRecord?: string;
}
