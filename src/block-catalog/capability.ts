// ============================================================================
// @bitcode/ui-schema — Block Capability Normalization (ADR-017 §2)
//
// The accepted matrix baseline (v0.1.0) uses some pre-ADR capability tokens.
// The canonical ADR-017 set lives in `BlockCapability`. Before Ready
// validation, matrix-only aliases MUST be normalized to canonical names so
// the matrix file itself stays frozen (P0 baseline) while the runtime reasons
// about the canonical contract.
//
// Pure functions only. No I/O, no framework imports.
// ============================================================================

import type { BlockCapability } from './types.ts';

/**
 * Canonical capability set (ADR-017 §2). Single source of truth for the
 * valid canonical names; mirrors the `BlockCapability` union.
 */
export const CANONICAL_BLOCK_CAPABILITIES: readonly BlockCapability[] = [
  'static',
  'data-source',
  'action-source',
  'reactive',
  'permission-aware',
  'i18n',
  'a11y',
  'responsive',
  'adapt',
  'provider-adapter',
  'commerce',
  'payment-adapter',
  'workflow',
  'builder',
  'large-data',
  'offline',
  'sanitize',
  'security',
] as const;

/**
 * Pre-ADR / matrix-only aliases mapped to their canonical capability.
 * `action-trigger` is the primary case from the accepted matrix baseline:
 * it predates ADR-018's canonical `action-source` name. Extend this map only
 * when a new matrix token needs normalization; do NOT mutate the matrix file
 * to canonicalize tokens in P1 (the baseline is frozen).
 */
export const BLOCK_CAPABILITY_ALIASES: Readonly<Record<string, BlockCapability>> = {
  'action-trigger': 'action-source',
};

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_BLOCK_CAPABILITIES);

/**
 * Returns true when `raw` is already a canonical capability (no alias).
 */
export function isCanonicalCapability(raw: string): boolean {
  return CANONICAL_SET.has(raw);
}

/**
 * Returns true when `raw` is a known pre-ADR alias tracked in
 * `BLOCK_CAPABILITY_ALIASES`.
 */
export function isKnownCapabilityAlias(raw: string): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCK_CAPABILITY_ALIASES, raw);
}

/**
 * Normalize a single raw capability token to its canonical form.
 *
 * - Canonical tokens pass through unchanged.
 * - Known aliases are mapped to canonical (e.g. `action-trigger` → `action-source`).
 * - Unknown tokens return `null` so callers can decide whether to warn or
 *   preserve them as descriptive hints. Unknown descriptive hints (e.g.
 *   `pagination`, `search`, `form`) are intentionally allowed to pass through
 *   the open capability representation, but they are NOT canonical and must
 *   not satisfy behavioral-gate requirements on their own.
 */
export function normalizeCapability(raw: string): BlockCapability | null {
  if (CANONICAL_SET.has(raw)) {
    return raw as BlockCapability;
  }
  const mapped = BLOCK_CAPABILITY_ALIASES[raw];
  return mapped ?? null;
}

/**
 * Normalize a list of raw capability tokens. Canonical tokens and resolved
 * aliases are included; unknown tokens are dropped (descriptive hints are not
 * part of the canonical contract). De-duplicated, order-preserving.
 */
export function normalizeCapabilities(raw: string[]): BlockCapability[] {
  const out: BlockCapability[] = [];
  const seen = new Set<string>();
  for (const token of raw) {
    const canonical = normalizeCapability(token);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

/**
 * Returns the list of raw tokens that are known aliases (would be rewritten).
 * Useful for diagnostics: a Ready entry should carry only canonical tokens.
 */
export function findCapabilityAliases(raw: string[]): string[] {
  return raw.filter((token) => isKnownCapabilityAlias(token));
}
