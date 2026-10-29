// ============================================================================
// @bitcode/ui-schema — Offline Policy (ADR-018 §9, §6.4, Agent L)
//
// Validates offline-capability declarations against ADR-018 queue semantics.
// Read-write support for action-capable blocks is the strictest gate: it
// requires durable queue, retry/backoff, idempotency key, replay-on-reconnect,
// conflict resolution, permission revalidation, and visible failure states.
// Each missing field is reported individually so builder tooling can guide
// incremental fixes.
//
// Coverage:
//   - offlinePolicy declaration (Ready gate).
//   - read-write + action-source => full queue semantics (error for Ready).
//   - read + action-source => mismatch warning (actions won't work offline).
//   - data-source + offline cap => support must not be 'unsupported'.
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

import type { BlockCatalogEntry, BlockOfflinePolicy } from '../types.ts';
import type { ResolvedPolicyConfig, PolicyResult } from './types.ts';
import {
  POLICY_DIAGNOSTIC_CODES,
  gateSeverity,
  hasCapability,
  policyDiagnostic,
  resultFromDiagnostics,
} from './types.ts';

/** Required queue fields for read-write + action-capable offline blocks. */
const REQUIRED_QUEUE_FIELDS = [
  'durable',
  'retryBackoff',
  'idempotencyKey',
  'replayOnReconnect',
  'conflictResolution',
  'permissionRevalidation',
] as const;

/** Run the offline policy. */
export function validateOfflinePolicy(
  entry: BlockCatalogEntry,
  config: ResolvedPolicyConfig,
): PolicyResult {
  const diags = resultFromDiagnostics(entry.id, []).diagnostics;
  void config;
  const id = entry.id;
  const op = entry.offlinePolicy;

  // --- offlinePolicy declaration (Ready gate) ---
  if (!op) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.OFFLINE_MISSING,
        gateSeverity(entry),
        'Entry has no offlinePolicy. Offline policy must be declared even when unsupported.',
        'offlinePolicy',
        "Declare offlinePolicy (e.g. { support: 'unsupported' }) explicitly.",
      ),
    );
    return resultFromDiagnostics(id, diags);
  }

  // --- read-write + action-source => full queue semantics ---
  if (op.support === 'read-write' && hasCapability(entry, 'action-source')) {
    const queue = op.queue ?? {};
    const missing: string[] = [];
    for (const field of REQUIRED_QUEUE_FIELDS) {
      if (queue[field] === undefined || queue[field] === null) {
        missing.push(field);
      }
    }
    if (!op.visibleFailureStates) {
      missing.push('visibleFailureStates');
    }
    if (missing.length > 0) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.OFFLINE_QUEUE_INCOMPLETE,
          entry.readiness === 'ready' ? 'error' : 'warning',
          `Offline read-write action block is missing required queue/failure fields: ${missing.join(', ')} (ADR-018 §6.4).`,
          'offlinePolicy.queue',
          `Populate offlinePolicy.queue.{${missing.join(',')}} before claiming offline action support.`,
        ),
      );
    }
  }

  // --- read + action-source => mismatch warning ---
  if (op.support === 'read' && hasCapability(entry, 'action-source')) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.OFFLINE_ACTION_MISMATCH,
        'warning',
        "Entry declares 'action-source' capability but offlinePolicy.support='read'. Actions will not execute offline.",
        'offlinePolicy.support',
        "Use support='read-write' with full queue semantics for offline actions, or remove the action-source capability.",
      ),
    );
  }

  // --- data-source + offline cap => support must not be 'unsupported' ---
  if (hasCapability(entry, 'data-source') && hasCapability(entry, 'offline')) {
    if (op.support === 'unsupported') {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.OFFLINE_DATA_INCOMPATIBLE,
          gateSeverity(entry),
          "Entry declares both 'data-source' and 'offline' capabilities but offlinePolicy.support='unsupported'. These capabilities conflict.",
          'offlinePolicy.support',
          "Set support to 'read' or 'read-write', or remove the 'offline' capability.",
        ),
      );
    }
  }

  return resultFromDiagnostics(id, diags);
}

/** Re-exported for tests that need to construct policies. */
export type { BlockOfflinePolicy };
