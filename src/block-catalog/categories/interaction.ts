// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: INTERACTION category
//
// Canonical Candidate metadata seed (ADR-017). All entries are
// `readiness: 'candidate'`. NO Ready promotion. Gaps and blockedBy are
// explicit and honest. a11y/test evidence is NOT faked.
//
// Source: block-catalog-candidate-matrix.json (frozen baseline v0.1.0).
// Platform availability from platform-audit.ts snapshot.
//
// Pure data. No framework imports.
// ============================================================================

import type { CandidateCatalogEntry } from '../types.ts';
import { componentPlatforms } from '../platform-audit.ts';

function rc(key: string): { key: string; platforms: Array<'web' | 'flutter'> } {
  return { key, platforms: componentPlatforms(key) };
}

// ---------------------------------------------------------------------------
// interaction.form — existing-component-needs-binding, merge (foundation)
// ---------------------------------------------------------------------------

const interactionForm: CandidateCatalogEntry = {
  id: 'interaction.form',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.interaction.form.title',
  fallbackLabel: 'Form',
  category: 'interaction',
  subcategory: 'form',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['action-source', 'reactive', 'i18n', 'security'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcForm'), rc('BcWizard')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    loadingState: true,
    errorState: true,
    disabledState: true,
  },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'deny',
    redactFields: ['password'],
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'elementor:Form',
    'elementor:Login',
    'easyerp:ApplyJobs',
    'chatgpt:Dynamic Form',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Form submit requires ActionSource wired into ReactiveStore.runAction (P3 runtime types+runner exist and pass tests in ui-schema, but NOT yet wired into the store).',
    'Reactive field validation requires Portable Expression AST evaluator (P2 types exist in ui-schema; TS evaluator impl lands in packages/ui).',
    'Flutter BcRenderer exists as renderer infrastructure; Ready validation must check renderer export separately from component source.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'foundation',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P2-expression-evaluator-impl',
    'P4-block-renderer-validator',
    'renderer-infrastructure-export-check',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// interaction.multi-step-wizard — existing-component-needs-binding, keep
// ---------------------------------------------------------------------------

const interactionMultiStepWizard: CandidateCatalogEntry = {
  id: 'interaction.multi-step-wizard',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.interaction.multi-step-wizard.title',
  fallbackLabel: 'Multi-Step Wizard',
  category: 'interaction',
  subcategory: 'wizard',
  channels: ['portal', 'internal', 'saas', 'website'],
  capabilities: ['action-source', 'reactive', 'i18n'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcWizard'), rc('BcForm'), rc('BcSteps')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    loadingState: true,
    errorState: true,
    disabledState: true,
  },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'easyerp:ApplyJobs',
    'easyerp:ImportExcelAction',
    'easyerp:ChangeStageStatusApplicantWidget',
    'ADR-014:Multi-Step Wizard',
  ],
  decision: 'keep',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    // Wizard schema convention now authored — WizardStepSchema in types.ts,
    // BcWizard contract + impl in packages/ui, Flutter parity in ui-flutter.
    'Action lifecycle (ActionSource) not yet wired into ReactiveStore.runAction.',
    'Engine feature wiring remains ADR-014 scope where engine-backed.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'wizard-schema-convention',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// interaction.record-picker — contract-gap, merge
// ---------------------------------------------------------------------------

const interactionRecordPicker: CandidateCatalogEntry = {
  id: 'interaction.record-picker',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.interaction.record-picker.title',
  fallbackLabel: 'Record Picker',
  category: 'interaction',
  subcategory: 'relation',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['data-source', 'action-source', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcLookupModal',
  requiredComponents: [
    rc('BcLookupModal'),
    rc('BcFieldTableSelect'),
    rc('BcFieldDynLink'),
    rc('BcFieldMorph'),
    rc('BcSelect'),
    rc('BcDataTable'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['record-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Relation Picker',
    'easyerp:OdooSelect',
    'easyerp:SelectLookup',
    'easyerp:RecordPicker',
  ],
  decision: 'merge',
  matrixStatus: 'contract-gap',
  gaps: [
    'Unified record picker block contract not yet authored.',
    'Quick-create action support and JSON snapshot convention not yet defined.',
    'Action lifecycle (ActionSource) not yet wired into ReactiveStore.runAction.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'contract-gap:record-picker-unification',
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// interaction.import-wizard — component-gap, keep
// ---------------------------------------------------------------------------

const interactionImportWizard: CandidateCatalogEntry = {
  id: 'interaction.import-wizard',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.interaction.import-wizard.title',
  fallbackLabel: 'Import Wizard',
  category: 'interaction',
  subcategory: 'import',
  channels: ['internal', 'saas'],
  capabilities: ['action-source', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcImportWizard',
  requiredComponents: [
    rc('BcWizard'),
    rc('BcFile'),
    rc('BcDataTable'),
    rc('BcDropZone'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, errorState: true },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'deny',
    filePolicy: { allowedTypes: ['csv', 'xls', 'xlsx', 'json', 'xml'], maxSizeBytes: 10485760, scanning: false },
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['easyerp:ImportExcelAction'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No BcImportWizard component or schema-driven import block exists.',
    'File parsing adapter, preview grid, and ActionRunner integration not yet implemented.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'component-gap:BcImportWizard',
    'file-parsing-adapter',
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// interaction.notification-center — existing-component-needs-binding, keep
// ---------------------------------------------------------------------------

const interactionNotificationCenter: CandidateCatalogEntry = {
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
  componentKey: 'BcNotificationCenter',
  requiredComponents: [
    rc('BcNotification'),
    rc('BcToastQueue'),
    rc('BcDropdown'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['notification-read'] },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Notifications',
    'elementor:WooCommerce Notices',
    'easyerp:LivewireAlert',
    'ADR-014:BcNotificationCenter',
  ],
  decision: 'keep',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Realtime/action capability requires ActionSource wired into ReactiveStore.runAction.',
    'Engine endpoint, model, permission, realtime wiring, and delivery semantics remain ADR-014 scope.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'ADR-014-engine-realtime-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const interactionCandidates: CandidateCatalogEntry[] = [
  interactionForm,
  interactionMultiStepWizard,
  interactionRecordPicker,
  interactionImportWizard,
  interactionNotificationCenter,
];
