// ============================================================================
// @bitcode/ui-schema — Block Catalog Policy Types (ADR-017/018, Agent L)
//
// Shared infrastructure for the policy validator layer. Policies compose over
// Agent I's shape validator (`validateBlockCatalogEntry`): they never replace
// it and never flip `readiness` (Amendment 6 — no Ready promotion).
//
// Design rules:
//   - Pure functions only. No file I/O, no network, no matrix read.
//   - Same diagnostic model as `BlockCatalogDiagnostic` so results compose
//     via `mergeResults`. Policy codes live in their own space
//     (`BLOCK_POLICY_*`) — they never collide with Agent I's `BLOCK_*` shape
//     codes.
//   - Severity scales with readiness: a Ready-blocking violation is `error`
//     on Ready entries, `warning` on Candidate entries, and skipped on
//     Deprecated entries (deprecation is a terminal state).
//   - Deterministic: same entry + config => identical diagnostics, in stable
//     code-then-fieldPath order.
//
// No React/DOM/Flutter/engine/provider deps. Schema-package clean.
// ============================================================================

import type {
  BlockCatalogDiagnostic,
  BlockDiagnosticSeverity,
} from '../validate.ts';
import type { BlockCatalogEntry } from '../types.ts';

// ---------------------------------------------------------------------------
// Result + config
// ---------------------------------------------------------------------------

/**
 * A policy validation result. Identical shape to
 * `BlockCatalogValidationResult` so callers can `mergeResults` shape-validator
 * output with policy-validator output uniformly.
 */
export interface PolicyResult {
  valid: boolean;
  diagnostics: BlockCatalogDiagnostic[];
  entryId?: string;
}

/**
 * Configurable thresholds. All optional; sensible ADR-aligned defaults live
 * in `DEFAULT_POLICY_CONFIG`. Pass overrides via `validateBlockCatalogPolicies`
 * so catalog tooling (P4 CLI) can tune limits without editing policy code.
 */
export interface PolicyConfig {
  /** Max nested `schemaPreset.sections` depth. Default 8. */
  maxNestingDepth?: number;
  /** Max total requiredComponents + requiredFunctions + requiredAdapters. Default 30. */
  maxDependencyCount?: number;
  /** Max PortableExpression AST depth before a complexity warning. Default 12. */
  maxExpressionDepth?: number;
  /**
   * Label substrings known-safe to suppress secret-pattern false positives
   * (e.g. "Password reset"). Pattern matching is anchored to call/assignment
   * forms, but this allowlist is a second line of defense for builder prose.
   */
  knownSafeLabels?: string[];
}

/** Resolved config (all fields filled). */
export type ResolvedPolicyConfig = Required<PolicyConfig>;

/**
 * Defaults are intentionally conservative: warnings fire on everyone, errors
 * fire only when `isReadyEntry(entry)` AND a strong capability is present.
 * This keeps small Candidates unblocked while protecting Ready status.
 */
export const DEFAULT_POLICY_CONFIG: ResolvedPolicyConfig = {
  maxNestingDepth: 8,
  maxDependencyCount: 30,
  maxExpressionDepth: 12,
  knownSafeLabels: [
    'password reset',
    'password help',
    'forgot password',
    'reset password',
    'change password',
  ],
};

/** Merge caller config over defaults. */
export function resolvePolicyConfig(config?: PolicyConfig): ResolvedPolicyConfig {
  if (!config) return { ...DEFAULT_POLICY_CONFIG };
  return {
    maxNestingDepth: config.maxNestingDepth ?? DEFAULT_POLICY_CONFIG.maxNestingDepth,
    maxDependencyCount: config.maxDependencyCount ?? DEFAULT_POLICY_CONFIG.maxDependencyCount,
    maxExpressionDepth: config.maxExpressionDepth ?? DEFAULT_POLICY_CONFIG.maxExpressionDepth,
    knownSafeLabels:
      config.knownSafeLabels && config.knownSafeLabels.length > 0
        ? [...config.knownSafeLabels]
        : [...DEFAULT_POLICY_CONFIG.knownSafeLabels],
  };
}

// ---------------------------------------------------------------------------
// Readiness helper (defensive — no hardcoded status enum)
// ---------------------------------------------------------------------------

/**
 * True only when the entry's `readiness` is exactly `'ready'`. The committed
 * `BlockReadiness` union is `candidate | ready | deprecated`; this helper
 * reads the literal field value so policy severity scaling stays correct
 * even if the union grows. Deprecated entries are a terminal state and are
 * skipped by the orchestrator.
 */
export function isReadyEntry(entry: BlockCatalogEntry): boolean {
  return entry?.readiness === 'ready';
}

/** True when entry is deprecated (terminal — orchestrator skips). */
export function isDeprecatedEntry(entry: BlockCatalogEntry): boolean {
  return entry?.readiness === 'deprecated';
}

// ---------------------------------------------------------------------------
// Diagnostic codes (separate space: BLOCK_POLICY_*)
// ---------------------------------------------------------------------------

export const POLICY_DIAGNOSTIC_CODES = {
  // Security
  SECRET_FOUND: 'BLOCK_POLICY_SECRET_FOUND',
  UNSAFE_URL: 'BLOCK_POLICY_UNSAFE_URL',
  URL_ALLOWLIST_MISSING: 'BLOCK_POLICY_URL_ALLOWLIST_MISSING',
  UNSAFE_HTML: 'BLOCK_POLICY_UNSAFE_HTML',
  SANITIZE_OFF: 'BLOCK_POLICY_SANITIZE_OFF',
  PAYMENT_NO_ADAPTER: 'BLOCK_POLICY_PAYMENT_NO_ADAPTER',
  EXTERNAL_LINK_OPEN: 'BLOCK_POLICY_EXTERNAL_LINK_OPEN',
  UNSAFE_CALL_STRING: 'BLOCK_POLICY_UNSAFE_CALL_STRING',
  EXPR_RUNTIME_NOT_DECLARED: 'BLOCK_POLICY_EXPR_RUNTIME_NOT_DECLARED',
  // Accessibility
  A11Y_EVIDENCE_MISSING: 'BLOCK_POLICY_A11Y_EVIDENCE_MISSING',
  LABEL_MISSING: 'BLOCK_POLICY_LABEL_MISSING',
  WCAG_LEVEL_MISSING: 'BLOCK_POLICY_WCAG_LEVEL_MISSING',
  FOCUS_MANAGEMENT_EXPECTED: 'BLOCK_POLICY_FOCUS_MANAGEMENT_EXPECTED',
  // Adaptive
  ADAPTIVE_MISSING: 'BLOCK_POLICY_ADAPTIVE_MISSING',
  PLATFORM_MORPH_INCOMPLETE: 'BLOCK_POLICY_PLATFORM_MORPH_INCOMPLETE',
  STATE_COVERAGE_MISSING: 'BLOCK_POLICY_STATE_COVERAGE_MISSING',
  BREAKPOINTS_MISSING: 'BLOCK_POLICY_BREAKPOINTS_MISSING',
  REDUCED_MOTION_MISSING: 'BLOCK_POLICY_REDUCED_MOTION_MISSING',
  // Performance
  NESTING_EXCEEDED: 'BLOCK_POLICY_NESTING_EXCEEDED',
  DEPENDENCY_LIMIT_EXCEEDED: 'BLOCK_POLICY_DEPENDENCY_LIMIT_EXCEEDED',
  LARGE_DATA_NO_PERF: 'BLOCK_POLICY_LARGE_DATA_NO_PERF',
  EXPRESSION_COMPLEXITY: 'BLOCK_POLICY_EXPRESSION_COMPLEXITY',
  NO_DEBOUNCE_ABORT: 'BLOCK_POLICY_NO_DEBOUNCE_ABORT',
  // Offline
  OFFLINE_MISSING: 'BLOCK_POLICY_OFFLINE_MISSING',
  OFFLINE_QUEUE_INCOMPLETE: 'BLOCK_POLICY_OFFLINE_QUEUE_INCOMPLETE',
  OFFLINE_ACTION_MISMATCH: 'BLOCK_POLICY_OFFLINE_ACTION_MISMATCH',
  OFFLINE_DATA_INCOMPATIBLE: 'BLOCK_POLICY_OFFLINE_DATA_INCOMPATIBLE',
} as const;

// ---------------------------------------------------------------------------
// Diagnostic builder + merge
// ---------------------------------------------------------------------------

/**
 * Append a diagnostic. Centralized so every policy emits consistent shape.
 * `entryId` is attached for builder-tooling traceability.
 */
export function policyDiagnostic(
  entryId: string | undefined,
  code: string,
  severity: BlockDiagnosticSeverity,
  message: string,
  fieldPath?: string,
  suggestedFix?: string,
): BlockCatalogDiagnostic {
  const d: BlockCatalogDiagnostic = { code, severity, message };
  if (entryId !== undefined) d.entryId = entryId;
  if (fieldPath !== undefined) d.fieldPath = fieldPath;
  if (suggestedFix !== undefined) d.suggestedFix = suggestedFix;
  return d;
}

/**
 * Merge multiple policy results into one. `valid` is true iff no merged
 * diagnostic has severity `error`. Diagnostics are concatenated in argument
 * order; the orchestrator calls policies in a fixed sequence so output is
 * deterministic for a given entry + config.
 */
export function mergeResults(...results: PolicyResult[]): PolicyResult {
  const diagnostics: BlockCatalogDiagnostic[] = [];
  let entryId: string | undefined;
  for (const r of results) {
    if (r.entryId !== undefined && entryId === undefined) entryId = r.entryId;
    for (const d of r.diagnostics) diagnostics.push(d);
  }
  const valid = !diagnostics.some((d) => d.severity === 'error');
  return { valid, diagnostics, entryId };
}

/** Build a result from a diagnostics list. */
export function resultFromDiagnostics(
  entryId: string | undefined,
  diagnostics: BlockCatalogDiagnostic[],
): PolicyResult {
  const valid = !diagnostics.some((d) => d.severity === 'error');
  return { valid, diagnostics, entryId };
}

// ---------------------------------------------------------------------------
// Capability helpers
// ---------------------------------------------------------------------------

/** True when the entry's capabilities include `cap` (canonical compare). */
export function hasCapability(entry: BlockCatalogEntry, cap: string): boolean {
  return Array.isArray(entry.capabilities) && entry.capabilities.includes(cap as never);
}

/** True when any of `caps` is present. */
export function hasAnyCapability(entry: BlockCatalogEntry, caps: readonly string[]): boolean {
  return caps.some((c) => hasCapability(entry, c));
}

/**
 * Choose a severity for a gate violation based on readiness. A Ready-blocking
 * rule is `error` on Ready entries, `warning` on Candidate entries. This is
 * the single source of truth for severity scaling across all policies.
 */
export function gateSeverity(entry: BlockCatalogEntry): BlockDiagnosticSeverity {
  return isReadyEntry(entry) ? 'error' : 'warning';
}
