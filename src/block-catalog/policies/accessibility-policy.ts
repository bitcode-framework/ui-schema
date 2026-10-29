// ============================================================================
// @bitcode/ui-schema — Accessibility Policy (ADR-017 §4, Agent L)
//
// Validates the a11y gate at the catalog-metadata level. This is a
// PRESENCE/SHAPE check only — it never resolves links or touches the
// filesystem (no I/O). Evidence "links" are treated as opaque reference
// strings; the policy only verifies they are non-empty.
//
// Coverage:
//   - a11y evidence presence/shape (contract | testReference | reportReference).
//   - label presence for entry + interactive schemaPreset fields.
//   - WCAG level declaration (AA minimum recommended for Ready).
//   - Focus-management expectation for interaction/builder caps (warning).
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

import type { BlockCatalogEntry } from '../types.ts';
import type { ResolvedPolicyConfig, PolicyResult } from './types.ts';
import {
  POLICY_DIAGNOSTIC_CODES,
  gateSeverity,
  hasAnyCapability,
  policyDiagnostic,
  resultFromDiagnostics,
} from './types.ts';

/** Capabilities that imply interactive/focusable surfaces. */
const INTERACTIVE_CAPABILITIES = ['action-source', 'workflow', 'builder'] as const;

/**
 * Run the accessibility policy. Severity scales with readiness via
 * `gateSeverity` for evidence/label gates; WCAG-level + focus are warnings
 * (recommendations, not hard blockers, to avoid over-flagging Candidates).
 */
export function validateAccessibilityPolicy(
  entry: BlockCatalogEntry,
  config: ResolvedPolicyConfig,
): PolicyResult {
  const diags = resultFromDiagnostics(entry.id, []).diagnostics;
  void config;
  const id = entry.id;

  // --- a11y evidence presence/shape (no I/O — reference strings only) ---
  if (hasAnyCapability(entry, ['a11y']) || entry.readiness === 'ready') {
    const ev = entry.a11yEvidence;
    const hasReference =
      !!ev &&
      ((typeof ev.contract === 'string' && ev.contract.trim().length > 0) ||
        (typeof ev.testReference === 'string' && ev.testReference.trim().length > 0) ||
        (typeof ev.reportReference === 'string' && ev.reportReference.trim().length > 0));
    if (!hasReference) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.A11Y_EVIDENCE_MISSING,
          gateSeverity(entry),
          "Entry requires linkable a11y evidence (a11yEvidence.contract | testReference | reportReference) but none is declared. Only presence/shape is checked — no link resolution.",
          'a11yEvidence',
          'Provide at least one non-empty reference string under a11yEvidence.',
        ),
      );
    }
  }

  // --- Label presence: entry-level ---
  // labelKey + fallbackLabel are already enforced by the shape validator as
  // errors for ALL entries; here we add an a11y-framed note only when the
  // entry lacks BOTH (defensive — shape validator catches the empty case).
  const hasEntryLabel =
    (typeof entry.labelKey === 'string' && entry.labelKey.trim().length > 0) ||
    (typeof entry.fallbackLabel === 'string' && entry.fallbackLabel.trim().length > 0);
  if (!hasEntryLabel) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.LABEL_MISSING,
        'warning',
        'Entry has no accessible label (labelKey/fallbackLabel). Screen-reader users rely on these for block identification.',
        'labelKey',
        'Provide labelKey with an English fallbackLabel.',
      ),
    );
  }

  // --- Label presence: interactive schemaPreset fields ---
  const preset = entry.schemaPreset as Record<string, unknown> | undefined;
  if (preset && Array.isArray(preset.fields)) {
    preset.fields.forEach((f, i) => {
      if (f && typeof f === 'object') {
        const fld = f as Record<string, unknown>;
        const hasLabel =
          (typeof fld.label === 'string' && fld.label.trim().length > 0) ||
          (typeof fld.name === 'string' && fld.name.trim().length > 0);
        if (!hasLabel) {
          diags.push(
            policyDiagnostic(
              id,
              POLICY_DIAGNOSTIC_CODES.LABEL_MISSING,
              'warning',
              `schemaPreset.fields[${i}] has no accessible label or name. Form fields require a label for assistive technology.`,
              `schemaPreset.fields[${i}].label`,
              'Provide a non-empty label or name for this field.',
            ),
          );
        }
      }
    });
  }

  // --- WCAG level declaration (AA recommended for Ready; warning) ---
  if (entry.readiness === 'ready') {
    const wcag = entry.a11yEvidence?.wcagLevel;
    if (wcag !== 'AA' && wcag !== 'AAA') {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.WCAG_LEVEL_MISSING,
          'warning',
          `Ready entry does not declare a11yEvidence.wcagLevel of 'AA' or 'AAA' (got '${String(wcag)}'). AA is the recommended minimum.`,
          'a11yEvidence.wcagLevel',
          "Declare wcagLevel='AA' once the a11y contract is verified.",
        ),
      );
    }
  }

  // --- Focus-management expectation (interactive/builder — warning) ---
  if (hasAnyCapability(entry, INTERACTIVE_CAPABILITIES)) {
    const ap = entry.adaptivePolicy;
    const hasFocusNote =
      (typeof ap?.notes === 'string' && /focus/i.test(ap.notes)) ||
      (typeof entry.a11yEvidence?.notes === 'string' && /focus/i.test(entry.a11yEvidence.notes));
    if (!hasFocusNote) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.FOCUS_MANAGEMENT_EXPECTED,
          'warning',
          `Interactive entry (${INTERACTIVE_CAPABILITIES.join(', ')} capability) does not document focus-management behavior. Complex interactions need explicit focus trapping/order.`,
          'adaptivePolicy.notes',
          'Document focus management in adaptivePolicy.notes or a11yEvidence.notes.',
        ),
      );
    }
  }

  return resultFromDiagnostics(id, diags);
}
