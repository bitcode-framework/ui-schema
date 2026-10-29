// ============================================================================
// @bitcode/ui-schema — Block Catalog Categories barrel + helpers
//
// Aggregates all per-category Candidate metadata into a single seed. This is
// the canonical Candidate metadata seed (ADR-017) — NOT the final runtime
// registry. P4 may re-export or relocate into packages/ui/src/block-catalog.
// Runtime reads only Ready entries by default; every entry here is Candidate.
//
// Pure data + pure helpers. No framework imports.
// ============================================================================

import type {
  BlockCategory,
  CandidateCatalogEntry,
} from '../types.ts';
import { contentCandidates } from './content.ts';
import { dataCandidates } from './data.ts';
import { interactionCandidates } from './interaction.ts';
import { commerceCandidates } from './commerce.ts';
import { workflowCandidates } from './workflow.ts';
import { builderCandidates } from './builder.ts';
import { analyticsCandidates } from './analytics.ts';
import { navigationCandidates } from './navigation.ts';
import {
  excludedCandidates,
  pluginCandidates,
} from './plugin-excluded.ts';

/**
 * All Candidate entries from the accepted matrix baseline (47 rows).
 * Order: by category for readability; ids are stable slugs.
 */
export const ALL_CANDIDATE_ENTRIES: readonly CandidateCatalogEntry[] = [
  ...contentCandidates,
  ...dataCandidates,
  ...interactionCandidates,
  ...commerceCandidates,
  ...workflowCandidates,
  ...builderCandidates,
  ...analyticsCandidates,
  ...navigationCandidates,
  ...pluginCandidates,
  ...excludedCandidates,
];

export { contentCandidates } from './content.ts';
export { dataCandidates } from './data.ts';
export { interactionCandidates } from './interaction.ts';
export { commerceCandidates } from './commerce.ts';
export { workflowCandidates } from './workflow.ts';
export { builderCandidates } from './builder.ts';
export { analyticsCandidates } from './analytics.ts';
export { navigationCandidates } from './navigation.ts';
export { pluginCandidates, excludedCandidates } from './plugin-excluded.ts';

/**
 * Look up a candidate by its stable id. Returns `undefined` if not found.
 */
export function getCandidateById(
  id: string,
): CandidateCatalogEntry | undefined {
  return ALL_CANDIDATE_ENTRIES.find((e) => e.id === id);
}

/**
 * Returns all candidates in a given category. Category is one of the 8
 * ADR-017 top-level categories (`plugin`/`excluded` rows carry their own
 * matrix category and are returned only when their literal category matches).
 */
export function getCandidatesByCategory(
  category: BlockCategory,
): CandidateCatalogEntry[] {
  return ALL_CANDIDATE_ENTRIES.filter((e) => e.category === category);
}

/**
 * Returns all candidates in a given matrix priority batch
 * (e.g. `content-website`, `erp-data-interaction`, `foundation`).
 */
export function getCandidatesByBatch(
  batch: string,
): CandidateCatalogEntry[] {
  return ALL_CANDIDATE_ENTRIES.filter((e) => e.priorityBatch === batch);
}

/**
 * Assert that every candidate id is unique. Throws with the duplicate ids if
 * not. Used as a build-time guard and by the uniqueness test.
 */
export function assertUniqueIds(
  entries: readonly CandidateCatalogEntry[] = ALL_CANDIDATE_ENTRIES,
): void {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) {
      dupes.push(e.id);
    } else {
      seen.add(e.id);
    }
  }
  if (dupes.length > 0) {
    throw new Error(
      `Duplicate Block Catalog candidate ids: ${dupes.join(', ')}`,
    );
  }
}

/**
 * Count of candidate entries (should equal the matrix candidate count: 48).
 */
export const CANDIDATE_COUNT: number = ALL_CANDIDATE_ENTRIES.length;
