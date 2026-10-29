// ============================================================================
// @bitcode/ui-schema — Block Catalog Shape Validator (ADR-017 §8, plan §7)
//
// P1 scope: minimal shape validation only. This validator checks the
// serializable shape of an entry and enforces Ready-required fields at the
// TYPE level. It does NOT perform cross-package gates (web/Flutter source +
// export checks, demo references, matrix status counts) — those land in P4
// alongside BcBlockRenderer and the catalog validator CLI.
//
// Design:
// - Pure functions: no file I/O, no matrix read, no network.
// - Candidate entries are validated leniently (missing Ready-only fields are
//   `info`/`warning`, never errors).
// - Ready entries are validated strictly (every Ready-required field must be
//   present and non-empty; missing → `error`). A Ready entry passing shape
//   validation is NOT fully Ready — `BLOCK_READY_GATE_INCOMPLETE` reminds
//   callers that cross-package gates are required (P4).
// - Diagnostics are machine-readable for future CLI consumption (plan §7.2).
// ============================================================================

import type {
  BlockCatalogEntry,
  BlockCategory,
  BlockChannel,
  BlockReadiness,
  BlockRenderStrategy,
  CandidateCatalogEntry,
} from './types.ts';
import {
  findCapabilityAliases,
  isCanonicalCapability,
} from './capability.ts';

// ---------------------------------------------------------------------------
// Diagnostic types
// ---------------------------------------------------------------------------

export type BlockDiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Machine-readable diagnostic (plan §7.2). Codes are stable identifiers
 * prefixed `BLOCK_*` so builder tooling can act on them.
 */
export interface BlockCatalogDiagnostic {
  code: string;
  severity: BlockDiagnosticSeverity;
  entryId?: string;
  fieldPath?: string;
  message: string;
  suggestedFix?: string;
}

/**
 * Validation result. `valid === true` only when there are zero `error`
 * diagnostics. `warning` and `info` do not invalidate.
 */
export interface BlockCatalogValidationResult {
  valid: boolean;
  diagnostics: BlockCatalogDiagnostic[];
  entryId?: string;
}

// ---------------------------------------------------------------------------
// Allowed-value sets (mirror the unions for runtime checks)
// ---------------------------------------------------------------------------

const CATEGORIES: ReadonlySet<BlockCategory> = new Set<BlockCategory>([
  'content',
  'data',
  'interaction',
  'commerce',
  'workflow',
  'builder',
  'analytics',
  'navigation',
]);

const CHANNELS: ReadonlySet<BlockChannel> = new Set<BlockChannel>([
  'website',
  'portal',
  'internal',
  'saas',
]);

const READINESS: ReadonlySet<BlockReadiness> = new Set<BlockReadiness>([
  'candidate',
  'ready',
  'deprecated',
]);

const STRATEGIES: ReadonlySet<BlockRenderStrategy> = new Set<BlockRenderStrategy>([
  'schema',
  'component',
]);

const CANDIDATE_DECISIONS: ReadonlySet<string> = new Set([
  'keep',
  'merge',
  'split',
  'alias',
  'exclude',
]);

// ---------------------------------------------------------------------------
// Diagnostic codes
// ---------------------------------------------------------------------------

export const BLOCK_DIAGNOSTIC_CODES = {
  ID_INVALID: 'BLOCK_ID_INVALID',
  VERSION_MISSING: 'BLOCK_VERSION_MISSING',
  SCHEMA_VERSION_MISSING: 'BLOCK_SCHEMA_VERSION_MISSING',
  LABEL_KEY_MISSING: 'BLOCK_LABEL_KEY_MISSING',
  FALLBACK_LABEL_MISSING: 'BLOCK_FALLBACK_LABEL_MISSING',
  CATEGORY_INVALID: 'BLOCK_CATEGORY_INVALID',
  CHANNEL_INVALID: 'BLOCK_CHANNEL_INVALID',
  CHANNEL_EMPTY: 'BLOCK_CHANNEL_EMPTY',
  CAPABILITY_ALIAS: 'BLOCK_CAPABILITY_ALIAS',
  CAPABILITY_UNKNOWN: 'BLOCK_CAPABILITY_UNKNOWN',
  READINESS_INVALID: 'BLOCK_READINESS_INVALID',
  RENDER_STRATEGY_INVALID: 'BLOCK_RENDER_STRATEGY_INVALID',
  SCHEMA_PRESET_MISSING: 'BLOCK_SCHEMA_PRESET_MISSING',
  COMPONENT_KEY_MISSING: 'BLOCK_COMPONENT_KEY_MISSING',
  READY_REQUIRED_FIELD_MISSING: 'BLOCK_READY_REQUIRED_FIELD_MISSING',
  DEPRECATED_WITHOUT_REPLACEMENT: 'BLOCK_DEPRECATED_WITHOUT_REPLACEMENT',
  READY_GATE_INCOMPLETE: 'BLOCK_READY_GATE_INCOMPLETE',
  CANDIDATE_DECISION_INVALID: 'BLOCK_CANDIDATE_DECISION_INVALID',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function push(
  diagnostics: BlockCatalogDiagnostic[],
  entryId: string | undefined,
  code: string,
  severity: BlockDiagnosticSeverity,
  message: string,
  fieldPath?: string,
  suggestedFix?: string,
): void {
  diagnostics.push({ code, severity, entryId, fieldPath, message, suggestedFix });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Minimal slug check for `id`: `namespace.name` style (lowercase, dots,
 * hyphens). Intentionally permissive — the canonical form is enforced by
 * catalog tooling, not by this regex.
 */
const ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;

// ---------------------------------------------------------------------------
// Base shape validation (applies to every entry regardless of readiness)
// ---------------------------------------------------------------------------

function validateBaseShape(
  entry: BlockCatalogEntry,
  diagnostics: BlockCatalogDiagnostic[],
): void {
  const id = entry.id;

  if (!isNonEmptyString(entry.id) || !ID_PATTERN.test(entry.id)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.ID_INVALID,
      'error',
      `Entry id must be a non-empty namespaced slug like 'content.hero' (got '${String(entry.id)}').`,
      'id',
      "Use a lowercase 'category.name' slug.",
    );
  }

  if (!isNonEmptyString(entry.version)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.VERSION_MISSING,
      'error',
      'Entry version is required.',
      'version',
      'Provide a semver-like version, e.g. 0.1.0.',
    );
  }

  if (!isNonEmptyString(entry.schemaVersion)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.SCHEMA_VERSION_MISSING,
      'error',
      'Entry schemaVersion is required.',
      'schemaVersion',
      'Provide the catalog schema version, e.g. 0.1.0.',
    );
  }

  if (!isNonEmptyString(entry.labelKey)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.LABEL_KEY_MISSING,
      'error',
      'Entry labelKey is required.',
      'labelKey',
      'Provide an i18n key, e.g. block.content.hero.title.',
    );
  }

  if (!isNonEmptyString(entry.fallbackLabel)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.FALLBACK_LABEL_MISSING,
      'error',
      'Entry fallbackLabel is required (English fallback).',
      'fallbackLabel',
      'Provide a non-empty English fallback label.',
    );
  }

  if (!CATEGORIES.has(entry.category)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.CATEGORY_INVALID,
      'error',
      `Entry category '${String(entry.category)}' is not a canonical BlockCategory.`,
      'category',
      'Use one of: content, data, interaction, commerce, workflow, builder, analytics, navigation.',
    );
  }

  if (!isNonEmptyArray(entry.channels)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.CHANNEL_EMPTY,
      'error',
      'Entry channels must be a non-empty array.',
      'channels',
      'Provide at least one BlockChannel.',
    );
  } else {
    for (const ch of entry.channels) {
      if (!CHANNELS.has(ch)) {
        push(
          diagnostics,
          id,
          BLOCK_DIAGNOSTIC_CODES.CHANNEL_INVALID,
          'error',
          `Channel '${String(ch)}' is not a canonical BlockChannel.`,
          'channels',
          'Use only: website, portal, internal, saas.',
        );
      }
    }
  }

  // Capability alias detection (informational for Candidate, warning for Ready)
  const aliases = findCapabilityAliases(entry.capabilities as string[]);
  if (aliases.length > 0) {
    const sev: BlockDiagnosticSeverity = entry.readiness === 'ready' ? 'warning' : 'info';
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.CAPABILITY_ALIAS,
      sev,
      `Capabilities contain pre-ADR alias(es): ${aliases.join(', ')}.`,
      'capabilities',
      'Normalize aliases to canonical names (e.g. action-trigger -> action-source) before Ready.',
    );
  }
  // Unknown descriptive hints are informational only.
  const unknownHints = (entry.capabilities as string[]).filter(
    (c) => !isCanonicalCapability(c) && !aliases.includes(c),
  );
  if (unknownHints.length > 0) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.CAPABILITY_UNKNOWN,
      'info',
      `Capabilities include non-canonical descriptive hint(s): ${unknownHints.join(', ')}.`,
      'capabilities',
      'Descriptive hints are allowed but do not satisfy behavioral gates on their own.',
    );
  }

  if (!READINESS.has(entry.readiness)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.READINESS_INVALID,
      'error',
      `Entry readiness '${String(entry.readiness)}' is not a canonical BlockReadiness.`,
      'readiness',
      'Use one of: candidate, ready, deprecated.',
    );
  }

  if (!STRATEGIES.has(entry.renderStrategy)) {
    push(
      diagnostics,
      id,
      BLOCK_DIAGNOSTIC_CODES.RENDER_STRATEGY_INVALID,
      'error',
      `Entry renderStrategy '${String(entry.renderStrategy)}' is not canonical.`,
      'renderStrategy',
      'Use schema or component.',
    );
  }
}

// ---------------------------------------------------------------------------
// Ready gate (shape subset only — cross-package gates are P4)
// ---------------------------------------------------------------------------

function requireReadyField(
  entry: BlockCatalogEntry,
  fieldPath: string,
  value: unknown,
  label: string,
  diagnostics: BlockCatalogDiagnostic[],
): void {
  const present =
    (isNonEmptyArray(value)) ||
    (value !== null && value !== undefined && typeof value === 'object');
  if (!present) {
    push(
      diagnostics,
      entry.id,
      BLOCK_DIAGNOSTIC_CODES.READY_REQUIRED_FIELD_MISSING,
      'error',
      `Ready entry is missing required field '${fieldPath}' (${label}).`,
      fieldPath,
      `Populate ${fieldPath} before promoting to Ready.`,
    );
  }
}

function validateReadyShape(
  entry: BlockCatalogEntry,
  diagnostics: BlockCatalogDiagnostic[],
): void {
  // Strategy-specific required fields.
  if (entry.renderStrategy === 'schema') {
    if (!entry.schemaPreset) {
      push(
        diagnostics,
        entry.id,
        BLOCK_DIAGNOSTIC_CODES.SCHEMA_PRESET_MISSING,
        'error',
        "Ready schema-strategy entry must declare a serializable schemaPreset.",
        'schemaPreset',
        'Provide a UiSchema preset containing only serializable values.',
      );
    }
  } else if (entry.renderStrategy === 'component') {
    if (!isNonEmptyString(entry.componentKey)) {
      push(
        diagnostics,
        entry.id,
        BLOCK_DIAGNOSTIC_CODES.COMPONENT_KEY_MISSING,
        'error',
        'Ready component-strategy entry must declare a string componentKey.',
        'componentKey',
        'Reference a registered platform component key, e.g. BcNotificationCenter.',
      );
    }
  }

  requireReadyField(entry, 'requiredComponents', entry.requiredComponents, 'component keys', diagnostics);
  requireReadyField(entry, 'requiredFunctions', entry.requiredFunctions, 'function declarations', diagnostics);
  requireReadyField(entry, 'requiredAdapters', entry.requiredAdapters, 'adapter declarations', diagnostics);
  requireReadyField(entry, 'adaptivePolicy', entry.adaptivePolicy, 'adaptive policy', diagnostics);
  requireReadyField(entry, 'securityPolicy', entry.securityPolicy, 'security policy', diagnostics);
  requireReadyField(entry, 'cachePolicy', entry.cachePolicy, 'cache policy', diagnostics);
  requireReadyField(entry, 'offlinePolicy', entry.offlinePolicy, 'offline policy', diagnostics);
  requireReadyField(entry, 'migration', entry.migration, 'migration metadata', diagnostics);
  requireReadyField(entry, 'a11yEvidence', entry.a11yEvidence, 'a11y evidence', diagnostics);
  requireReadyField(entry, 'tests', entry.tests, 'test references', diagnostics);

  // Remind callers that shape validation alone does not confer Ready status.
  push(
    diagnostics,
    entry.id,
    BLOCK_DIAGNOSTIC_CODES.READY_GATE_INCOMPLETE,
    'info',
    'Shape validation passed, but Ready status additionally requires cross-package gates (web + Flutter source/export, demos, full test gate) enforced by the P4 catalog validator.',
    'readiness',
    'Run the P4 catalog validator before relying on Ready status.',
  );
}

// ---------------------------------------------------------------------------
// Deprecated checks
// ---------------------------------------------------------------------------

function validateDeprecatedShape(
  entry: BlockCatalogEntry,
  diagnostics: BlockCatalogDiagnostic[],
): void {
  if (!isNonEmptyString(entry.deprecatedBy)) {
    push(
      diagnostics,
      entry.id,
      BLOCK_DIAGNOSTIC_CODES.DEPRECATED_WITHOUT_REPLACEMENT,
      'warning',
      'Deprecated entry does not declare deprecatedBy replacement id.',
      'deprecatedBy',
      'Provide the entry id that supersedes this one (or document why none exists).',
    );
  }
}

// ---------------------------------------------------------------------------
// Candidate-only checks (matrix-only metadata sanity)
// ---------------------------------------------------------------------------

function validateCandidateFields(
  entry: CandidateCatalogEntry,
  diagnostics: BlockCatalogDiagnostic[],
): void {
  if (
    entry.decision !== undefined &&
    !CANDIDATE_DECISIONS.has(entry.decision)
  ) {
    push(
      diagnostics,
      entry.id,
      BLOCK_DIAGNOSTIC_CODES.CANDIDATE_DECISION_INVALID,
      'warning',
      `Candidate decision '${String(entry.decision)}' is not canonical.`,
      'decision',
      'Use one of: keep, merge, split, alias, exclude.',
    );
  }
  // matrixStatus cross-check against the matrix file is intentionally deferred
  // to P4 (no matrix file read in P1 — this validator is pure shape only).
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a `BlockCatalogEntry` shape.
 *
 * Candidate entries are validated leniently (Ready-only fields missing →
 * `info`/`warning`). Ready entries are validated strictly (Ready-only fields
 * missing → `error`). Deprecated entries get a replacement-id warning.
 *
 * NOTE: This is the P1 shape validator only. A `valid` result for a Ready
 * entry does NOT mean the block is Ready — cross-package gates (web/Flutter
 * source + export, demos, full test gate) are enforced by the P4 catalog
 * validator. See `BLOCK_READY_GATE_INCOMPLETE`.
 */
export function validateBlockCatalogEntry(
  entry: BlockCatalogEntry,
): BlockCatalogValidationResult {
  const diagnostics: BlockCatalogDiagnostic[] = [];

  validateBaseShape(entry, diagnostics);

  // Base errors short-circuit deeper readiness checks: if readiness itself is
  // invalid we cannot meaningfully run readiness-specific rules.
  const hasReadinessError = diagnostics.some(
    (d) => d.code === BLOCK_DIAGNOSTIC_CODES.READINESS_INVALID,
  );

  if (!hasReadinessError) {
    if (entry.readiness === 'ready') {
      validateReadyShape(entry, diagnostics);
    } else if (entry.readiness === 'deprecated') {
      validateDeprecatedShape(entry, diagnostics);
    }
    // candidate: no additional strict checks at the base-entry level.
  }

  const valid = !diagnostics.some((d) => d.severity === 'error');
  return { valid, diagnostics, entryId: entry.id };
}

/**
 * Validate a `CandidateCatalogEntry`. Runs the base entry validator, then
 * adds candidate-only metadata sanity checks (decision canonicality, etc.).
 */
export function validateCandidateCatalogEntry(
  entry: CandidateCatalogEntry,
): BlockCatalogValidationResult {
  const diagnostics: BlockCatalogDiagnostic[] = [];

  validateBaseShape(entry, diagnostics);
  validateCandidateFields(entry, diagnostics);

  const hasReadinessError = diagnostics.some(
    (d) => d.code === BLOCK_DIAGNOSTIC_CODES.READINESS_INVALID,
  );
  if (!hasReadinessError && entry.readiness === 'ready') {
    validateReadyShape(entry, diagnostics);
  } else if (!hasReadinessError && entry.readiness === 'deprecated') {
    validateDeprecatedShape(entry, diagnostics);
  }

  const valid = !diagnostics.some((d) => d.severity === 'error');
  return { valid, diagnostics, entryId: entry.id };
}
