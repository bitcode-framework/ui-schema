// ============================================================================
// @bitcode/ui-schema - Block Catalog Candidate Fixtures (ADR-017)
//
// @internal Candidate fixtures for compile-testing the type surface and the
// shape validator. These are NOT Ready catalog claims and MUST NOT be
// consumed by runtime as default catalog input. Runtime reads only Ready
// entries (ADR-017 section 4). These mirror matrix entries but carry
// explicit readiness 'candidate' and document their blocking gaps.
//
// No framework imports. Serializable-friendly only.
// ============================================================================

import type { CandidateCatalogEntry } from './types.ts';

/**
 * Candidate schema-strategy entry: content.hero (matrix v0.1.0).
 *
 * Matrix status: schema-preset-only. Decision: keep.
 * Blockers before Ready: needs a full schema preset, Flutter demo, and the
 * P4 cross-package gates (web + Flutter source/export, demos, tests).
 */
export const candidateContentHero: CandidateCatalogEntry = {
  id: 'content.hero',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.hero.title',
  fallbackLabel: 'Hero',
  category: 'content',
  subcategory: 'marketing',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'responsive', 'i18n', 'a11y'],
  renderStrategy: 'schema',
  // Minimal serializable preset placeholder; the full preset lands when this
  // entry is promoted toward Ready in a later batch.
  schemaPreset: { type: 'section', title: 'Hero', sections: [] },
  requiredComponents: [
    { key: 'BcSection', platforms: ['web', 'flutter'] },
    { key: 'BcStack', platforms: ['web', 'flutter'] },
    { key: 'BcImage', platforms: ['web', 'flutter'] },
    { key: 'BcButton', platforms: ['web', 'flutter'] },
  ],
  readiness: 'candidate',
  // Candidate-only matrix metadata.
  sourceReferences: ['chatgpt:Hero Banner', 'elementor:Slides'],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Need full BlockCatalog schema preset.',
    'Need Flutter demo example.',
    'Ready requires P4 cross-package gates.',
  ],
  priorityBatch: 'content-website',
};

/**
 * Candidate component-strategy entry: interaction.notification-center
 * (matrix v0.1.0).
 *
 * Matrix status: existing-component-needs-binding. Decision: keep.
 * Blockers before Ready: realtime/action contract (ADR-018 ActionSource /
 * ActionRunner), and the P4 cross-package gates. Engine endpoint, model,
 * permission, realtime wiring, and delivery semantics remain ADR-014 scope.
 *
 * Capabilities are already canonical here (matrix used action-source).
 */
export const candidateInteractionNotificationCenter: CandidateCatalogEntry = {
  id: 'interaction.notification-center',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.interaction.notification-center.title',
  fallbackLabel: 'Notification Center',
  category: 'interaction',
  subcategory: 'notification',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['data-source', 'action-source', 'permission-aware'],
  renderStrategy: 'component',
  // String key only - never a function/class. Implementation registered via
  // the platform component registry in a later batch.
  componentKey: 'BcNotificationCenter',
  requiredComponents: [
    { key: 'BcNotification', platforms: ['web', 'flutter'] },
    { key: 'BcToastQueue', platforms: ['web', 'flutter'] },
    { key: 'BcDropdown', platforms: ['web', 'flutter'] },
  ],
  readiness: 'candidate',
  // Candidate-only matrix metadata.
  sourceReferences: [
    'chatgpt:Notifications',
    'elementor:WooCommerce Notices',
    'easyerp:LivewireAlert',
  ],
  decision: 'keep',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Realtime/action capability requires ADR-018 ActionSource + ActionRunner.',
    'Engine endpoint, model, permission, realtime wiring remain ADR-014 scope.',
    'Ready requires P4 cross-package gates.',
  ],
  priorityBatch: 'erp-data-interaction',
};

/**
 * All Candidate fixtures. @internal - not a Ready catalog. Do not consume at
 * runtime. Used for type compile-tests and validator tests.
 */
export const candidateFixtures: CandidateCatalogEntry[] = [
  candidateContentHero,
  candidateInteractionNotificationCenter,
];
