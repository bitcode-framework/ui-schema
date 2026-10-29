// ============================================================================
// @bitcode/ui-schema — Adaptive Policy (ADR-017 §4, ADR-011, Agent L)
//
// Validates the adaptive gate: platform-aware morphing (Cupertino/Material
// per ADR-011), state coverage (loading/empty/error/disabled), breakpoints,
// and reduced-motion. Operates purely on committed `BlockAdaptivePolicy`
// fields — no invented metadata.
//
// Mobile-targeting detection uses `adapt` capability OR channels including
// portal/saas (which imply mobile reach) OR platformMorph presence. This is
// heuristic and intentionally conservative: we only require BOTH cupertino
// and material when the entry actually signals mobile reach.
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

import type { BlockCatalogEntry } from '../types.ts';
import type { ResolvedPolicyConfig, PolicyResult } from './types.ts';
import {
  POLICY_DIAGNOSTIC_CODES,
  gateSeverity,
  hasAnyCapability,
  hasCapability,
  policyDiagnostic,
  resultFromDiagnostics,
} from './types.ts';

/** Required UI states for data/action-heavy blocks. */
const REQUIRED_STATES = ['loadingState', 'emptyState', 'errorState', 'disabledState'] as const;
/** Capabilities that imply data/action-heavy surfaces needing full state coverage. */
const STATE_CAPABILITIES = ['data-source', 'large-data', 'action-source', 'workflow'] as const;

/**
 * True when the entry signals mobile reach. Conservative: only when it
 * explicitly declares `adapt`, OR targets portal/saas channels, OR already
 * declares a platformMorph.
 */
function targetsMobile(entry: BlockCatalogEntry): boolean {
  if (hasCapability(entry, 'adapt')) return true;
  if (Array.isArray(entry.channels)) {
    if (entry.channels.includes('portal') || entry.channels.includes('saas')) return true;
  }
  if (entry.adaptivePolicy?.platformMorph) return true;
  return false;
}

/** Run the adaptive policy. */
export function validateAdaptivePolicy(
  entry: BlockCatalogEntry,
  config: ResolvedPolicyConfig,
): PolicyResult {
  const diags = resultFromDiagnostics(entry.id, []).diagnostics;
  void config;
  const id = entry.id;
  const ap = entry.adaptivePolicy;

  // --- Adaptive policy declared (Ready gate; Candidate warning) ---
  if (!ap) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.ADAPTIVE_MISSING,
        gateSeverity(entry),
        'Entry has no adaptivePolicy. Adaptive behavior must be declared or inherited.',
        'adaptivePolicy',
        'Declare an adaptivePolicy (use inherits=<parent-id> for variants).',
      ),
    );
    return resultFromDiagnostics(id, diags); // remaining checks need ap.
  }

  // --- Platform morph coverage (mobile-targeting only) ---
  if (targetsMobile(entry)) {
    const morph = ap.platformMorph;
    if (morph !== 'inherit') {
      const families = Array.isArray(morph) ? morph : [];
      const hasCupertino = families.includes('cupertino');
      const hasMaterial = families.includes('material');
      if (!(hasCupertino && hasMaterial)) {
        const missing: string[] = [];
        if (!hasCupertino) missing.push('cupertino');
        if (!hasMaterial) missing.push('material');
        diags.push(
          policyDiagnostic(
            id,
            POLICY_DIAGNOSTIC_CODES.PLATFORM_MORPH_INCOMPLETE,
            gateSeverity(entry),
            `Mobile-targeting entry's adaptivePolicy.platformMorph is missing families: ${missing.join(', ')} (ADR-011: iOS/macOS use Cupertino, Android/web/desktop use Material).`,
            'adaptivePolicy.platformMorph',
            "Declare platformMorph=['cupertino','material'] (or 'inherit' for variant blocks).",
          ),
        );
      }
    }
  }

  // --- State coverage (data/action-heavy blocks) ---
  if (hasAnyCapability(entry, STATE_CAPABILITIES)) {
    const missingStates = REQUIRED_STATES.filter((s) => ap[s] !== true);
    if (missingStates.length > 0) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.STATE_COVERAGE_MISSING,
          entry.readiness === 'ready' ? 'error' : 'warning',
          `Data/action-heavy entry is missing explicit state coverage: ${missingStates.join(', ')}.`,
          'adaptivePolicy',
          `Set ${missingStates.join(', ')} to true (or inherit from a parent block that declares them).`,
        ),
      );
    }
  }

  // --- Breakpoints (responsive capability) ---
  if (hasCapability(entry, 'responsive')) {
    if (ap.breakpoints === undefined) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.BREAKPOINTS_MISSING,
          gateSeverity(entry),
          "Entry declares 'responsive' capability but adaptivePolicy.breakpoints is undeclared.",
          'adaptivePolicy.breakpoints',
          'Declare breakpoints (true for the default set, or an explicit list).',
        ),
      );
    }
  }

  // --- Reduced motion (responsive/adapt — warning, recommendation) ---
  if (hasAnyCapability(entry, ['responsive', 'adapt'])) {
    if (ap.reducedMotion === undefined) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.REDUCED_MOTION_MISSING,
          'warning',
          "Entry declares responsive/adapt capability but does not declare adaptivePolicy.reducedMotion. Users with vestibular disorders rely on this.",
          'adaptivePolicy.reducedMotion',
          "Declare reducedMotion (true | false | 'inherit').",
        ),
      );
    }
  }

  return resultFromDiagnostics(id, diags);
}
