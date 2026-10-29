// ============================================================================
// @bitcode/ui-schema — Block Catalog Pilot Candidate Analysis (ADR-017)
//
// ANALYSIS ONLY. This module identifies which candidates are the strongest
// FIRST Ready-promotion targets. The pilot entries (content.plain-text and
// content.faq) have NOW BEEN PROMOTED to Ready — see ready-promotions.ts.
// Their pilot records remain here as historical documentation of the blockers
// that were resolved.
//
// Selection criteria (all must hold):
//   1. renderStrategy = 'schema' (component-strategy needs a registered impl).
//   2. Capability set is static-only (no action-source / reactive /
//      large-data / payment / workflow dependency that needs P2/P3 runtime).
//   3. Every required component is confirmed present+exported on BOTH web
//      and Flutter in the static platform audit (platform-audit.ts).
//   4. No unresolved component-gap / contract-gap matrix status.
//
// Conditional candidates fail criterion 3 or have an unverified parity claim;
// they are listed separately with the specific verification needed.
//
// Pure data + pure helpers. No framework imports.
// ============================================================================

import type { CandidateCatalogEntry } from './types.ts';
import {
  ALL_CANDIDATE_ENTRIES,
  getCandidateById,
} from './categories/index.ts';
import { isComponentOnBothPlatforms } from './platform-audit.ts';
import { READY_CATALOG_ENTRIES } from './ready-promotions.ts';

/**
 * A pilot candidate analysis record. `remainingBlockers` is ALWAYS non-empty
 * — no entry here is claimed Ready.
 */
export interface PilotCandidate {
  id: string;
  rationale: string;
  remainingBlockers: string[];
  recommendedPromotionBatch: string;
}

/**
 * A conditional candidate — close to pilot but has one unverified item that
 * must be resolved (e.g. visual parity, flutter component gap) before it can
 * be considered a clean pilot.
 */
export interface ConditionalCandidate {
  id: string;
  rationale: string;
  remainingBlockers: string[];
  verificationNeeded: string;
  recommendedPromotionBatch: string;
}

/**
 * Determined via the selection criteria above. These are the cleanest
 * first-Ready targets: static, schema-strategy, all components on both
 * platforms, no action/expression/large-data dependency.
 */
export const PILOT_CANDIDATES: readonly PilotCandidate[] = [
  {
    id: 'content.plain-text',
    rationale:
      "Static, schema-strategy, lowest complexity. Required components (BcLabel, BcBox) confirmed on both web and Flutter. No action/expression/large-data dependency. Only needs schema-preset authoring + P4 renderer/validator.",
    remainingBlockers: [
      'P4-block-renderer-validator',
      'schema-preset-authoring',
      'a11y-evidence-missing',
      'test-coverage-missing',
    ],
    recommendedPromotionBatch: 'P5 (export/parity) or P10 (content/navigation)',
  },
  {
    id: 'content.faq',
    rationale:
      "Static + data-source + a11y + i18n, schema-strategy. Required components (BcAccordion, BcDisclosure) confirmed on both web and Flutter. No action/expression dependency. Needs schema preset + heading-hierarchy/i18n policy.",
    remainingBlockers: [
      'P4-block-renderer-validator',
      'schema-preset-authoring',
      'a11y-evidence-missing',
      'test-coverage-missing',
    ],
    recommendedPromotionBatch: 'P10 (content/navigation)',
  },
];

/**
 * Conditional candidates — close to pilot but with one specific unverified
 * item. Listed so the promotion batch knows what to verify first.
 */
export const CONDITIONAL_CANDIDATES: readonly ConditionalCandidate[] = [
  {
    id: 'content.hero',
    rationale:
      "Static + responsive + i18n + a11y, schema-strategy. Most components (BcStack, BcImage, BcButton) on both platforms, BUT BcSection has no Flutter export (bc_section missing). Can compose with BcBox fallback OR wait for Flutter BcSection parity.",
    remainingBlockers: [
      'P4-block-renderer-validator',
      'schema-preset-authoring',
      'flutter:bc_section-parity',
      'a11y-evidence-missing',
      'test-coverage-missing',
    ],
    verificationNeeded:
      'Confirm the hero preset can compose without BcSection on Flutter (BcBox fallback) OR add canonical Flutter BcSection source+export.',
    recommendedPromotionBatch: 'P10 (content/navigation)',
  },
  {
    id: 'analytics.chart',
    rationale:
      "Schema-strategy, data-source. Components (BcChart, BcSparkline, BcProgress) on both platforms. But ADR-015 ECharts Flutter parity (identical option-shape rendering web vs flutter) is NOT verified in this scope.",
    remainingBlockers: [
      'P4-block-renderer-validator',
      'ADR-015-flutter-echarts-parity-verification',
      'a11y-evidence-missing',
      'test-coverage-missing',
    ],
    verificationNeeded:
      'Verify ADR-015 shared ECharts option contract renders identically on web and Flutter (chart parity golden test) before Ready.',
    recommendedPromotionBatch: 'P8 (analytics)',
  },
  {
    id: 'workflow.diagram-viewer',
    rationale:
      "Schema-strategy, read-only, static. BUT BcChartGraph (web) and BcChart (flutter) are NOT proven to render process-graph semantics identically. Both exist but visual semantic parity is unverified.",
    remainingBlockers: [
      'P4-block-renderer-validator',
      'schema-preset-authoring',
      'visual-parity:BcChartGraph-vs-BcChart',
      'a11y-evidence-missing',
      'test-coverage-missing',
    ],
    verificationNeeded:
      'Prove BcChartGraph (web) and BcChart (flutter) render an identical read-only process-graph preset before considering for pilot.',
    recommendedPromotionBatch: 'P7 (workflow)',
  },
];

/**
 * Returns true iff every required component of the candidate is confirmed
 * present on both web and Flutter in the static platform audit. Entries with
 * no requiredComponents return false (nothing to validate parity against).
 */
export function allComponentsOnBothPlatforms(
  entry: CandidateCatalogEntry,
): boolean {
  const comps = entry.requiredComponents ?? [];
  if (comps.length === 0) return false;
  return comps.every((c) => {
    const key = typeof c === 'string' ? c : c.key;
    return isComponentOnBothPlatforms(key);
  });
}

/**
 * Internal consistency check: every PilotCandidate id must resolve to a real
 * candidate entry, and every pilot must have all-components-on-both-platforms.
 * Exported for the pilot test to assert.
 */
export function validatePilotConsistency(): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  for (const p of PILOT_CANDIDATES) {
    const entry = getCandidateById(p.id);
    if (!entry) {
      problems.push(`Pilot id ${p.id} not found in candidate entries.`);
      continue;
    }
    if (entry.readiness !== 'candidate') {
      problems.push(`Pilot ${p.id} is not 'candidate' readiness.`);
    }
    if (p.remainingBlockers.length === 0) {
      problems.push(`Pilot ${p.id} has no remaining blockers (false Ready claim).`);
    }
    if (!allComponentsOnBothPlatforms(entry)) {
      problems.push(
        `Pilot ${p.id} has required components not on both platforms.`,
      );
    }
  }
  for (const c of CONDITIONAL_CANDIDATES) {
    const entry = getCandidateById(c.id);
    if (!entry) {
      problems.push(`Conditional id ${c.id} not found in candidate entries.`);
      continue;
    }
    if (c.verificationNeeded.length === 0) {
      problems.push(`Conditional ${c.id} has no verificationNeeded.`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Summary counts for reporting.
 */
export const PILOT_SUMMARY = {
  pilotCount: PILOT_CANDIDATES.length,
  conditionalCount: CONDITIONAL_CANDIDATES.length,
  totalCandidates: ALL_CANDIDATE_ENTRIES.length,
  readyCount: READY_CATALOG_ENTRIES.length,
};
