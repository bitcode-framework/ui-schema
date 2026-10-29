// ============================================================================
// @bitcode/ui-schema — Performance Policy (ADR-017 §4, plan §4.3, Agent L)
//
// Conservative performance heuristics. Defaults are WARNINGS so small
// Candidates are never blocked; promotion to ERROR happens ONLY when the
// entry is Ready AND a strong capability (large-data/action-source) is
// present. Thresholds are configurable via PolicyConfig.
//
// Coverage:
//   - schemaPreset.sections nesting depth.
//   - dependency count (requiredComponents + requiredFunctions + requiredAdapters).
//   - large-data performance declaration (pagination/virtualization/bounded scroll).
//   - PortableExpression AST depth warning (when AST nodes appear in payload).
//   - debounce/abort expectation for action-source + large-data combos.
//
// Note on expression-depth: catalog JSON normally embeds no PortableExpression
// nodes (they live in the action runtime). If a payload DOES carry an AST
// (rare, e.g. a serialized expression builder artifact), we measure its depth
// defensively. Missing/absent AST => no diagnostic (not an error).
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

import type { BlockCatalogEntry } from '../types.ts';
import type { ResolvedPolicyConfig, PolicyResult } from './types.ts';
import {
  POLICY_DIAGNOSTIC_CODES,
  gateSeverity,
  hasCapability,
  policyDiagnostic,
  resultFromDiagnostics,
} from './types.ts';

/** A node shape that looks like a PortableExpression AST node. */
interface AstLike {
  kind?: string;
}

/**
 * Measure the max depth of a value that may embed PortableExpression AST
 * nodes. Returns 0 for non-AST values. Defensive: only recurses into objects
 * whose `kind` matches a known AST node kind OR plain arrays/records.
 */
function measureAstDepth(value: unknown, knownKinds: ReadonlySet<string>): number {
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    let max = 0;
    for (const item of value) {
      const d = measureAstDepth(item, knownKinds);
      if (d > max) max = d;
    }
    return max > 0 ? max : 0;
  }
  const obj = value as AstLike & Record<string, unknown>;
  if (typeof obj.kind === 'string' && knownKinds.has(obj.kind)) {
    let maxChild = 0;
    for (const k of ['args', 'then', 'else', 'test']) {
      const child = obj[k];
      if (child !== undefined) {
        const d = measureAstDepth(child, knownKinds);
        if (d > maxChild) maxChild = d;
      }
    }
    return 1 + maxChild;
  }
  // Plain record that might contain nested AST: scan its values shallowly.
  let max = 0;
  for (const k of Object.keys(obj)) {
    const d = measureAstDepth(obj[k], knownKinds);
    if (d > max) max = d;
  }
  return max;
}

/** Count required* declarations (both string and object forms). */
function countDependencies(entry: BlockCatalogEntry): number {
  const c = Array.isArray(entry.requiredComponents) ? entry.requiredComponents.length : 0;
  const f = Array.isArray(entry.requiredFunctions) ? entry.requiredFunctions.length : 0;
  const a = Array.isArray(entry.requiredAdapters) ? entry.requiredAdapters.length : 0;
  return c + f + a;
}

/** Measure schemaPreset.sections nesting depth. */
function measureNesting(preset: unknown): number {
  if (!preset || typeof preset !== 'object') return 0;
  const node = preset as Record<string, unknown>;
  if (!Array.isArray(node.sections)) return 0;
  let maxChild = 0;
  for (const child of node.sections) {
    const d = measureNesting(child);
    if (d > maxChild) maxChild = d;
  }
  return 1 + maxChild;
}

/** Run the performance policy. */
export function validatePerformancePolicy(
  entry: BlockCatalogEntry,
  config: ResolvedPolicyConfig,
): PolicyResult {
  const diags = resultFromDiagnostics(entry.id, []).diagnostics;
  const id = entry.id;

  // --- Nesting depth (warning default; error when Ready + large-data) ---
  const nesting = measureNesting(entry.schemaPreset);
  if (nesting > config.maxNestingDepth) {
    const isError = entry.readiness === 'ready' && hasCapability(entry, 'large-data');
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.NESTING_EXCEEDED,
        isError ? 'error' : 'warning',
        `schemaPreset nesting depth ${nesting} exceeds limit ${config.maxNestingDepth}.`,
        'schemaPreset.sections',
        `Reduce nesting below ${config.maxNestingDepth}, or split into separate catalog entries.`,
      ),
    );
  }

  // --- Dependency count (warning default; error when Ready + large-data) ---
  const depCount = countDependencies(entry);
  if (depCount > config.maxDependencyCount) {
    const isError = entry.readiness === 'ready' && hasCapability(entry, 'large-data');
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.DEPENDENCY_LIMIT_EXCEEDED,
        isError ? 'error' : 'warning',
        `Dependency count ${depCount} (requiredComponents+Functions+Adapters) exceeds limit ${config.maxDependencyCount}.`,
        'requiredComponents',
        `Reduce dependencies below ${config.maxDependencyCount}, or split into smaller blocks.`,
      ),
    );
  }

  // --- large-data performance declaration ---
  if (hasCapability(entry, 'large-data')) {
    const declared = declaresLargeDataPerf(entry);
    if (!declared) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.LARGE_DATA_NO_PERF,
          gateSeverity(entry),
          "Entry declares 'large-data' capability but does not declare a performance strategy (pagination/virtualization/bounded scroll/debounce).",
          'cachePolicy.notes',
          'Document pagination/virtualization/bounded-scrolling in cachePolicy.notes or adaptivePolicy.notes.',
        ),
      );
    }
  }

  // --- PortableExpression AST depth (warning; defensive) ---
  const knownKinds = new Set(['literal', 'path', 'op', 'call', 'if']);
  const payload = (entry.schemaPreset as unknown as Record<string, unknown> | undefined)?.payload;
  const payloadDepth = measureAstDepth(payload, knownKinds);
  if (payloadDepth > config.maxExpressionDepth) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.EXPRESSION_COMPLEXITY,
        'warning',
        `Embedded expression AST depth ${payloadDepth} exceeds recommendation ${config.maxExpressionDepth}. Deep expressions hurt evaluation latency and parity.`,
        'schemaPreset.payload',
        `Simplify the expression below depth ${config.maxExpressionDepth}, or extract sub-expressions into named host functions.`,
      ),
    );
  }

  // --- debounce/abort for action-source + large-data (warning) ---
  if (hasCapability(entry, 'action-source') && hasCapability(entry, 'large-data')) {
    const documented = /debounce|abort|throttle/i.test(perfNotes(entry));
    if (!documented) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.NO_DEBOUNCE_ABORT,
          'warning',
          "Entry combines 'action-source' and 'large-data' but does not document debounce/abort behavior. Repeated submissions against large datasets need rate-limiting.",
          'cachePolicy.notes',
          'Document debounce/abort/throttle behavior in cachePolicy.notes or adaptivePolicy.notes.',
        ),
      );
    }
  }

  return resultFromDiagnostics(id, diags);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Concatenate all performance-relevant notes for keyword checks. */
function perfNotes(entry: BlockCatalogEntry): string {
  const parts: string[] = [];
  if (typeof entry.cachePolicy?.notes === 'string') parts.push(entry.cachePolicy.notes);
  if (typeof entry.adaptivePolicy?.notes === 'string') parts.push(entry.adaptivePolicy.notes);
  if (typeof entry.securityPolicy?.notes === 'string') parts.push(entry.securityPolicy.notes);
  return parts.join(' ');
}

/** True when the entry declares a large-data performance strategy in notes. */
function declaresLargeDataPerf(entry: BlockCatalogEntry): boolean {
  const notes = perfNotes(entry).toLowerCase();
  return /paginat|virtuali|bound(?:ed)?\s*scroll|debounce|abort|lazy/i.test(notes);
}
