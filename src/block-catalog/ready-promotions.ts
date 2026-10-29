// ============================================================================
// @bitcode/ui-schema — Block Catalog Ready Promotions (ADR-017/018)
//
// The FIRST production-Ready Block Catalog entries. Each entry here is a
// fully-evidenced, cross-package-validated Ready promotion of a candidate
// from the accepted matrix baseline.
//
// SEPARATE from ALL_CANDIDATE_ENTRIES. The candidate seed remains exactly
// 44 rows with `readiness: 'candidate'` — we do NOT mutate it. Ready
// promotions live here as a distinct `BlockCatalogEntry[]` so that:
//   - matrix-parity tests (expect 44 candidates) stay green, and
//   - ready-gate tests gain their first real Ready fixtures.
//
// Evidence requirements satisfied for every entry below:
//   1. Shape validation (P1) — every [Ready] field populated.
//   2. Deep validation (Agent F/G + serializability) — 0 error diagnostics.
//   3. Policy validation (Agent L) — 0 error diagnostics.
//   4. Component registry probe — every requiredComponent present on BOTH
//      web (packages/ui/src/index.ts) and Flutter (bc_ui_flutter.dart).
//   5. schemaPreset — serializable UiSchema with no functions/symbols.
//
// Pure data. No framework imports.
// ============================================================================

import type { BlockCatalogEntry } from './types.ts';

// ---------------------------------------------------------------------------
// content.plain-text — Ready
// ---------------------------------------------------------------------------

const contentPlainTextReady: BlockCatalogEntry = {
  id: 'content.plain-text',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.plain-text.title',
  fallbackLabel: 'Plain Text',
  category: 'content',
  subcategory: 'text',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'i18n', 'a11y'],
  renderStrategy: 'schema',
  schemaPreset: {
    type: 'section',
    title: 'Plain Text',
    sections: [
      {
        type: 'form',
        name: 'plainTextBody',
        fields: [
          {
            name: 'body',
            label: 'Body',
            type: 'textarea',
          },
        ],
      },
    ],
  },
  requiredComponents: [
    { key: 'BcLabel', platforms: ['web', 'flutter'] },
    { key: 'BcBox', platforms: ['web', 'flutter'] },
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['cupertino', 'material'],
    reducedMotion: true,
  },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'deny',
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'ready',
  a11yEvidence: {
    contract: 'Semantic landmark section with a labelled textarea; heading hierarchy via section title.',
    testReference: 'packages/ui/demo-app/src/demos/block-catalog/ReadyCatalogRender.tsx',
    wcagLevel: 'AA',
  },
  tests: {
    schema: 'packages/ui-schema/test/block-catalog/ready-promotions.test.ts',
    web: 'packages/ui/demo-app/src/demos/block-catalog/ReadyCatalogRender.tsx',
    flutter: 'packages/ui-flutter/test/actions/source_test.dart',
  },
};

// ---------------------------------------------------------------------------
// content.faq — Ready
// ---------------------------------------------------------------------------

const contentFaqReady: BlockCatalogEntry = {
  id: 'content.faq',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.faq.title',
  fallbackLabel: 'FAQ',
  category: 'content',
  subcategory: 'knowledge',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'data-source', 'a11y', 'i18n'],
  renderStrategy: 'schema',
  schemaPreset: {
    type: 'section',
    title: 'FAQ',
    sections: [
      {
        type: 'list',
        name: 'faqItems',
        columns_def: [
          { key: 'question', label: 'Question', sortable: true },
          { key: 'answer', label: 'Answer' },
        ],
        data: [
          { question: 'What is BitCode?', answer: 'A modular low-code ERP platform.' },
          { question: 'Is it open source?', answer: 'Yes, the core engine is open source.' },
        ],
        pageSize: 10,
      },
    ],
  },
  requiredComponents: [
    { key: 'BcAccordion', platforms: ['web', 'flutter'] },
    { key: 'BcDisclosure', platforms: ['web', 'flutter'] },
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['cupertino', 'material'],
    reducedMotion: true,
    loadingState: true,
    emptyState: true,
    errorState: true,
    disabledState: true,
  },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'deny',
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'ready',
  a11yEvidence: {
    contract:
      'Accordion/disclosure semantics with keyboard operability; heading hierarchy via section title; list semantics for FAQ items.',
    testReference: 'packages/ui/demo-app/src/demos/block-catalog/ReadyCatalogRender.tsx',
    wcagLevel: 'AA',
  },
  tests: {
    schema: 'packages/ui-schema/test/block-catalog/ready-promotions.test.ts',
    web: 'packages/ui/demo-app/src/demos/block-catalog/ReadyCatalogRender.tsx',
    flutter: 'packages/ui-flutter/test/actions/effect_runner_test.dart',
  },
};

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * All production-Ready Block Catalog entries. Each entry has passed deep
 * validation, policy validation, and component-registry probes on BOTH web
 * and Flutter.
 *
 * Runtime reads only Ready entries by default (ADR-017 §4). This is the
 * first non-empty Ready catalog.
 */
export const READY_CATALOG_ENTRIES: readonly BlockCatalogEntry[] = [
  contentPlainTextReady,
  contentFaqReady,
];

/**
 * Count of Ready entries (drives PILOT_SUMMARY.readyCount).
 */
export const READY_COUNT: number = READY_CATALOG_ENTRIES.length;

/**
 * Look up a Ready entry by its stable id. Returns `undefined` if not found.
 */
export function getReadyEntryById(
  id: string,
): BlockCatalogEntry | undefined {
  return READY_CATALOG_ENTRIES.find((e) => e.id === id);
}
