#!/usr/bin/env node
// ============================================================================
// @bitcode/ui-schema — Block Catalog Validator CLI (ADR-017 §7, plan §7.2)
//
// Validates ALL catalog entries (Ready + Candidate) against the shape, deep,
// and policy validators. Reports per-entry and aggregate diagnostics with
// machine-readable codes. Exits non-zero when any Ready entry has errors.
//
// Usage:
//   node scripts/validate-catalog.mjs                    # validate all
//   node scripts/validate-catalog.mjs --ready-only       # Ready entries only
//   node scripts/validate-catalog.mjs --json             # machine-readable
//   node scripts/validate-catalog.mjs --entry content.plain-text  # single
//
// Exit codes:
//   0 = all entries pass (Ready: 0 errors; Candidate: warnings allowed)
//   1 = at least one Ready entry has error diagnostics
//   2 = internal error (import failure, etc.)
// ============================================================================

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const readyOnly = args.includes('--ready-only');
const jsonOutput = args.includes('--json');
const entryFilterIdx = args.indexOf('--entry');
const entryFilter = entryFilterIdx >= 0 ? args[entryFilterIdx + 1] : null;

// ---------------------------------------------------------------------------
// Dynamic import of TypeScript source (Node 22+ supports --experimental-strip-types
// or we use tsx/esbuild via the package's existing test runner pattern)
// ---------------------------------------------------------------------------

async function loadCatalog() {
  // Use the same pattern as run-tests.mjs: import .ts directly.
  // Node's --test runner handles this; for CLI we need to compile first.
  // Since this runs under `node` directly, we use dynamic import with
  // the .ts extension and rely on Node's experimental TS support OR
  // the project's tsx setup.
  const mod = await import('../src/block-catalog/index.ts');
  return mod;
}

// ---------------------------------------------------------------------------
// Platform audit probe (static snapshot)
// ---------------------------------------------------------------------------

function makeAuditProbe(audit) {
  return {
    has(key, platform) {
      const entry = audit[key];
      if (!entry) return false;
      if (platform === 'web') return entry.web;
      if (platform === 'flutter') return entry.flutter;
      return entry.web && entry.flutter;
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let mod;
  try {
    mod = await loadCatalog();
  } catch (err) {
    console.error('Failed to load catalog module:', err.message);
    process.exit(2);
  }

  const {
    READY_CATALOG_ENTRIES,
    ALL_CANDIDATE_ENTRIES,
    validateBlockCatalogEntry,
    validateBlockCatalogEntryDeep,
    validateBlockCatalogPolicies,
  } = mod;

  // Load platform audit
  const auditMod = await import('../src/block-catalog/platform-audit.ts');
  const PLATFORM_AUDIT = auditMod.PLATFORM_AUDIT;
  const probe = makeAuditProbe(PLATFORM_AUDIT);

  // Determine which entries to validate
  let entries;
  if (readyOnly) {
    entries = [...READY_CATALOG_ENTRIES];
  } else if (entryFilter) {
    entries = [
      ...READY_CATALOG_ENTRIES,
      ...ALL_CANDIDATE_ENTRIES,
    ].filter((e) => e.id === entryFilter);
    if (entries.length === 0) {
      console.error(`No entry found with id '${entryFilter}'`);
      process.exit(2);
    }
  } else {
    entries = [...READY_CATALOG_ENTRIES, ...ALL_CANDIDATE_ENTRIES];
  }

  const results = [];
  let hasReadyErrors = false;

  for (const entry of entries) {
    const shape = validateBlockCatalogEntry(entry);
    const deep = validateBlockCatalogEntryDeep(entry, { componentRegistry: probe });
    const policy = validateBlockCatalogPolicies(entry);

    const allDiags = [
      ...shape.diagnostics,
      ...deep.diagnostics,
      ...policy.diagnostics,
    ];

    const errors = allDiags.filter((d) => d.severity === 'error');
    const warnings = allDiags.filter((d) => d.severity === 'warning');
    const infos = allDiags.filter((d) => d.severity === 'info');

    if (entry.readiness === 'ready' && errors.length > 0) {
      hasReadyErrors = true;
    }

    results.push({
      id: entry.id,
      readiness: entry.readiness,
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
      errorDetails: errors.map((e) => ({
        code: e.code,
        field: e.fieldPath,
        message: e.message,
      })),
    });
  }

  // Output
  if (jsonOutput) {
    const report = {
      summary: {
        total: results.length,
        ready: results.filter((r) => r.readiness === 'ready').length,
        candidate: results.filter((r) => r.readiness === 'candidate').length,
        withErrors: results.filter((r) => r.errors > 0).length,
      },
      entries: results,
      exitCode: hasReadyErrors ? 1 : 0,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log('\nBlock Catalog Validation Report');
    console.log('='.repeat(60));

    for (const r of results) {
      const status =
        r.errors === 0
          ? r.readiness === 'ready'
            ? 'READY'
            : 'OK'
          : 'FAIL';
      const icon = status === 'FAIL' ? '[FAIL]' : status === 'READY' ? '[READY]' : '[ OK  ]';
      console.log(
        `${icon} ${r.id.padEnd(40)} ${r.readiness.padEnd(10)} E:${r.errors} W:${r.warnings} I:${r.infos}`,
      );
      if (r.errorDetails.length > 0) {
        for (const e of r.errorDetails) {
          console.log(`         ${e.code} (${e.field}): ${e.message}`);
        }
      }
    }

    console.log('='.repeat(60));
    console.log(
      `Total: ${results.length} | Ready: ${results.filter((r) => r.readiness === 'ready').length} | Candidate: ${results.filter((r) => r.readiness === 'candidate').length}`,
    );
    console.log(
      `With errors: ${results.filter((r) => r.errors > 0).length} | Ready with errors: ${results.filter((r) => r.readiness === 'ready' && r.errors > 0).length}`,
    );

    if (hasReadyErrors) {
      console.log('\nFAILED: Ready entries with errors detected.');
    } else {
      console.log('\nPASSED: All Ready entries are error-free.');
    }
  }

  process.exit(hasReadyErrors ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
