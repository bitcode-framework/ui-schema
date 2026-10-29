// ============================================================================
// @bitcode/ui-schema — Block Catalog Policies barrel (ADR-017/018, Agent L)
//
// Re-exports the five policy validators + the orchestrator that runs them in
// a fixed, deterministic order and merges results. Policies COMPOSE over
// Agent I's shape validator (`validateBlockCatalogEntry`); they never replace
// it and never flip `readiness` (Amendment 6 — no Ready promotion).
//
// Public surface:
//   - validateBlockCatalogPolicies(entry, config?) — orchestrator (all 5).
//   - validateSecurityPolicy / validateAccessibilityPolicy /
//     validateAdaptivePolicy / validatePerformancePolicy /
//     validateOfflinePolicy — individual policies.
//   - mergeResults — combine any policy results with shape-validator output.
//   - POLICY_DIAGNOSTIC_CODES, PolicyConfig, PolicyResult, isReadyEntry.
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

export {
  DEFAULT_POLICY_CONFIG,
  gateSeverity,
  hasAnyCapability,
  hasCapability,
  isDeprecatedEntry,
  isReadyEntry,
  mergeResults,
  policyDiagnostic,
  resolvePolicyConfig,
  resultFromDiagnostics,
} from './types.ts';
export type {
  PolicyConfig,
  PolicyResult,
  ResolvedPolicyConfig,
} from './types.ts';
export { POLICY_DIAGNOSTIC_CODES } from './types.ts';

export { validateSecurityPolicy } from './security-policy.ts';
export { validateAccessibilityPolicy } from './accessibility-policy.ts';
export { validateAdaptivePolicy } from './adaptive-policy.ts';
export { validatePerformancePolicy } from './performance-policy.ts';
export { validateOfflinePolicy } from './offline-policy.ts';

import type { BlockCatalogEntry } from '../types.ts';
import type { PolicyConfig, PolicyResult } from './types.ts';
import {
  isDeprecatedEntry,
  mergeResults,
  resolvePolicyConfig,
} from './types.ts';
import { validateSecurityPolicy } from './security-policy.ts';
import { validateAccessibilityPolicy } from './accessibility-policy.ts';
import { validateAdaptivePolicy } from './adaptive-policy.ts';
import { validatePerformancePolicy } from './performance-policy.ts';
import { validateOfflinePolicy } from './offline-policy.ts';

/**
 * Run all five policy validators over an entry in fixed order and merge.
 * Deprecated entries are skipped (terminal state — no policy gating applies).
 *
 * Order is deterministic: security → accessibility → adaptive → performance
 * → offline. Within each policy, diagnostics are appended in evaluation
 * order. Callers switching on `code` get stable, reproducible output for a
 * given entry + config.
 *
 * This does NOT replace `validateBlockCatalogEntry` (shape validation). P4
 * CLI composes both:
 *
 *   const shape = validateBlockCatalogEntry(entry);
 *   const policies = validateBlockCatalogPolicies(entry);
 *   const combined = mergeResults(shape, policies);
 *
 * @param entry  Catalog entry to validate.
 * @param config Optional threshold overrides; defaults applied otherwise.
 * @returns Merged PolicyResult (valid === no error diagnostics).
 */
export function validateBlockCatalogPolicies(
  entry: BlockCatalogEntry,
  config?: PolicyConfig,
): PolicyResult {
  if (!entry || isDeprecatedEntry(entry)) {
    return { valid: true, diagnostics: [], entryId: entry?.id };
  }
  const resolved = resolvePolicyConfig(config);
  const results: PolicyResult[] = [
    validateSecurityPolicy(entry, resolved),
    validateAccessibilityPolicy(entry, resolved),
    validateAdaptivePolicy(entry, resolved),
    validatePerformancePolicy(entry, resolved),
    validateOfflinePolicy(entry, resolved),
  ];
  return mergeResults(...results);
}
