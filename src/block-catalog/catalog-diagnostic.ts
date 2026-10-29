// ============================================================================
// @bitcode/ui-schema — Catalog Deep-Validator Diagnostics (ADR-017 §8)
//
// Diagnostic types and codes for the deep Block Catalog validator
// (validate-catalog-deep.ts). These REUSE the existing P1
// `BlockCatalogDiagnostic` shape (extend, never parallel) and add:
//   - optional `source` attribution (which subsystem produced the diagnostic)
//   - a dedicated result type with `ok` (distinct from P1's `valid`)
//   - new BLOCK_* codes for deep checks not covered by P1
//
// Pure types + constants. No framework imports.
// ============================================================================

import type {
  BlockCatalogDiagnostic,
  BlockDiagnosticSeverity,
} from './validate.ts';

// ---------------------------------------------------------------------------
// Source attribution
// ---------------------------------------------------------------------------

/**
 * Which validator subsystem produced a diagnostic. Useful for tooling that
 * needs to route diagnostics to the owning team (shape → catalog team,
 * expression → Agent F, action → Agent G, etc.).
 */
export type CatalogDiagnosticSource =
  | 'shape'         // from P1 validateBlockCatalogEntry / validateCandidateCatalogEntry
  | 'expression'    // from Agent F validateExpression
  | 'action'        // from Agent G validateActionSource
  | 'data-binding'  // deep walk: DataSource structural validity
  | 'nesting'       // deep walk: nesting depth / cycle detection
  | 'serializable'  // deep walk: function / symbol / undefined detection
  | 'component'     // component reference format + registry probe
  | 'capability';   // minimal structural capability gate

// ---------------------------------------------------------------------------
// Diagnostic shape (reuses BlockCatalogDiagnostic — IS-A, not parallel)
// ---------------------------------------------------------------------------

/**
 * A catalog diagnostic produced by the deep validator. This extends the
 * existing `BlockCatalogDiagnostic` with an optional `source` field for
 * attribution. Every `CatalogDiagnostic` is a valid `BlockCatalogDiagnostic`,
 * so consumers that ignore `source` still work unchanged.
 */
export interface CatalogDiagnostic extends BlockCatalogDiagnostic {
  /** Which subsystem produced this diagnostic. Omitted for P1 passthrough. */
  source?: CatalogDiagnosticSource;
}

/**
 * Result of the deep validator. `ok === true` iff there are zero `error`
 * diagnostics. `warning` and `info` do not invalidate.
 *
 * Uses `ok` (not `valid`) to avoid confusion with P1's
 * `BlockCatalogValidationResult.valid`.
 */
export interface CatalogValidationResult {
  ok: boolean;
  diagnostics: CatalogDiagnostic[];
  entryId?: string;
}

// ---------------------------------------------------------------------------
// Deep-validator diagnostic codes
// ---------------------------------------------------------------------------

/**
 * Stable diagnostic codes for the deep catalog validator. Prefixed `BLOCK_*`
 * to stay in the same code space as P1 (they are all catalog-level codes).
 * Distinct from P1's `BLOCK_DIAGNOSTIC_CODES` — no overlap.
 *
 * Policy readiness gates (payment, offline queue, sanitize, large-data perf)
 * are NOT included here — those are owned by Agent L (P4 catalog validator).
 * This module performs only structural, serializability, and minimal
 * adapter-presence checks.
 */
export const CATALOG_DIAGNOSTIC_CODES = {
  // schemaPreset structure
  SCHEMA_KIND_INVALID: 'BLOCK_SCHEMA_KIND_INVALID',
  DUPLICATE_FIELD_NAME: 'BLOCK_DUPLICATE_FIELD_NAME',

  // data binding
  DATA_BINDING_INVALID: 'BLOCK_DATA_BINDING_INVALID',
  DATA_SOURCE_TYPE_UNKNOWN: 'BLOCK_DATA_SOURCE_TYPE_UNKNOWN',
  DATA_SOURCE_URL_EMPTY: 'BLOCK_DATA_SOURCE_URL_EMPTY',
  DATA_SOURCE_MODEL_EMPTY: 'BLOCK_DATA_SOURCE_MODEL_EMPTY',

  // expression / action delegation
  EXPRESSION_INVALID: 'BLOCK_EXPRESSION_INVALID',
  ACTION_SOURCE_INVALID: 'BLOCK_ACTION_SOURCE_INVALID',

  // nesting
  NESTING_TOO_DEEP: 'BLOCK_NESTING_TOO_DEEP',
  NESTING_CYCLE: 'BLOCK_NESTING_CYCLE',

  // serializability
  NON_SERIALIZABLE: 'BLOCK_NON_SERIALIZABLE',

  // component references
  COMPONENT_REFERENCE_INVALID: 'BLOCK_COMPONENT_REFERENCE_INVALID',
  COMPONENT_NOT_REGISTERED: 'BLOCK_COMPONENT_NOT_REGISTERED',

  // minimal capability gate
  CAPABILITY_ADAPTER_MISSING: 'BLOCK_CAPABILITY_ADAPTER_MISSING',

  // internal safety
  VALIDATOR_INTERNAL_ERROR: 'BLOCK_VALIDATOR_INTERNAL_ERROR',
} as const;

/** Canonical set of deep-validator codes (used by tests + tooling). */
export const CATALOG_DIAGNOSTIC_CODE_SET: ReadonlySet<string> = new Set(
  Object.values(CATALOG_DIAGNOSTIC_CODES),
);

// ---------------------------------------------------------------------------
// Severity rank (for deterministic stable sort)
// ---------------------------------------------------------------------------

/**
 * Numeric rank for severity. Lower = more severe. Used as a SECONDARY sort
 * key (primary is fieldPath) to keep diagnostics grouped by location while
 * surfacing the most severe issue first within a location.
 */
export function severityRank(severity: BlockDiagnosticSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}
