// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: BUILDER category
//
// Canonical Candidate metadata seed (ADR-017). All entries are
// `readiness: 'candidate'`. NO Ready promotion. Gaps and blockedBy are
// explicit and honest. a11y/test evidence is NOT faked.
//
// Builder surfaces are runtime-separate from Ready block runtime (ADR-017 §3):
// a simple schema/component render must NOT import builder packages.
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
// builder.query-builder — component-gap, keep
// ---------------------------------------------------------------------------

const builderQueryBuilder: CandidateCatalogEntry = {
  id: 'builder.query-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.query-builder.title',
  fallbackLabel: 'Query Builder',
  category: 'builder',
  subcategory: 'query',
  channels: ['internal', 'saas'],
  capabilities: ['builder', 'data-source', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcQueryBuilder',
  requiredComponents: [rc('BcDataTable'), rc('BcForm'), rc('BcTree'), rc('BcCode')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Query Builder', 'chatgpt:Filter Builder', 'chatgpt:Rule Builder'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated builder surface exists.',
    'Portable Expression AST editor, validation, and undo/versioning policy not yet implemented.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'component-gap:BcQueryBuilder',
    'P2-expression-evaluator-impl',
    'builder-authoring-contract',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.expression-builder — component-gap, keep (foundation)
// ---------------------------------------------------------------------------

const builderExpressionBuilder: CandidateCatalogEntry = {
  id: 'builder.expression-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.expression-builder.title',
  fallbackLabel: 'Expression Builder',
  category: 'builder',
  subcategory: 'expression',
  channels: ['internal', 'saas'],
  capabilities: ['builder', 'reactive', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcExpressionBuilder',
  requiredComponents: [rc('BcCode'), rc('BcJson'), rc('BcTree'), rc('BcForm')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Expression Builder'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated visual expression builder component exists.',
    'Requires Portable Expression AST types/evaluator before implementation.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'foundation',
  blockedBy: [
    'component-gap:BcExpressionBuilder',
    'P2-expression-evaluator-impl',
    'builder-authoring-contract',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.page-builder — component-gap, keep
// ---------------------------------------------------------------------------

const builderPageBuilder: CandidateCatalogEntry = {
  id: 'builder.page-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.page-builder.title',
  fallbackLabel: 'Page Builder',
  category: 'builder',
  subcategory: 'page',
  channels: ['internal', 'saas'],
  capabilities: ['builder', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcPageBuilder',
  requiredComponents: [rc('BcViewEditor')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Page Builder',
    'chatgpt:Dashboard Builder',
    'elementor:Template',
    'easyerp:Builder',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No Application Builder surface exists separate from Ready Block runtime.',
    'Visual builder endpoint/model/persistence wiring remains ADR-014 scope.',
    'Flutter BcRenderer exists as renderer infrastructure; Ready validation must check renderer export separately.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'component-gap:BcPageBuilder',
    'builder-authoring-contract',
    'renderer-infrastructure-export-check',
    'P4-block-renderer-validator',
    'ADR-014-builder-persistence-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.report-builder — component-gap, keep
// ---------------------------------------------------------------------------

const builderReportBuilder: CandidateCatalogEntry = {
  id: 'builder.report-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.report-builder.title',
  fallbackLabel: 'Report Builder',
  category: 'builder',
  subcategory: 'report',
  channels: ['internal', 'saas'],
  capabilities: ['builder', 'data-source', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcReportBuilder',
  requiredComponents: [
    rc('BcViewReport'),
    rc('BcDashboard'),
    rc('BcChart'),
    rc('BcDataTable'),
    rc('BcExport'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Report Builder', 'chatgpt:Dashboard Builder'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated report/dashboard builder components exist.',
    'Persistence/versioning contract not yet authored.',
    'Export/report engine wiring and persistence remain ADR-014 scope.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'component-gap:BcReportBuilder',
    'builder-authoring-contract',
    'P4-block-renderer-validator',
    'ADR-014-report-export-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.form-builder — ADR-014 Phase 4 visual form builder
// ---------------------------------------------------------------------------

const builderFormBuilder: CandidateCatalogEntry = {
  id: 'builder.form-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.form-builder.title',
  fallbackLabel: 'Form Builder',
  category: 'builder',
  subcategory: 'form',
  channels: ['internal'],
  capabilities: ['builder', 'data-source', 'i18n', 'responsive', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcFormBuilder',
  requiredComponents: [rc('BcFormBuilder'), rc('BcBuilder')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material', 'cupertino'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'ADR-014:Form Builder',
    'ADR-006:Pure/Adapt',
    'ADR-011:Platform-aware',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'a11y-evidence-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.workflow-builder — ADR-014 Phase 4 visual workflow builder
// ---------------------------------------------------------------------------

const builderWorkflowBuilder: CandidateCatalogEntry = {
  id: 'builder.workflow-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.workflow-builder.title',
  fallbackLabel: 'Workflow Builder',
  category: 'builder',
  subcategory: 'workflow',
  channels: ['internal'],
  capabilities: ['builder', 'data-source', 'i18n', 'responsive', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcWorkflowBuilder',
  requiredComponents: [rc('BcWorkflowBuilder'), rc('BcBuilder')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material', 'cupertino'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'ADR-014:Workflow Builder',
    'ADR-006:Pure/Adapt',
    'ADR-011:Platform-aware',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'a11y-evidence-missing',
  ],
};

// ---------------------------------------------------------------------------
// builder.schema-builder — ADR-014 Phase 4 visual schema builder
// ---------------------------------------------------------------------------

const builderSchemaBuilder: CandidateCatalogEntry = {
  id: 'builder.schema-builder',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.builder.schema-builder.title',
  fallbackLabel: 'Schema Builder',
  category: 'builder',
  subcategory: 'schema',
  channels: ['internal'],
  capabilities: ['builder', 'data-source', 'i18n', 'responsive', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcSchemaBuilder',
  requiredComponents: [rc('BcSchemaBuilder'), rc('BcBuilder')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material', 'cupertino'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'ADR-014:Schema Builder',
    'ADR-006:Pure/Adapt',
    'ADR-011:Platform-aware',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'a11y-evidence-missing',
  ],
};

export const builderCandidates: CandidateCatalogEntry[] = [
  builderQueryBuilder,
  builderExpressionBuilder,
  builderPageBuilder,
  builderReportBuilder,
  builderFormBuilder,
  builderWorkflowBuilder,
  builderSchemaBuilder,
];
