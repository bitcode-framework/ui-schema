// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: DATA category
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
// data.record-list — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const dataRecordList: CandidateCatalogEntry = {
  id: 'data.record-list',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.record-list.title',
  fallbackLabel: 'Record List',
  category: 'data',
  subcategory: 'record',
  channels: ['portal', 'internal', 'saas', 'website'],
  capabilities: [
    'data-source',
    'responsive',
    'large-data',
    'security',
  ],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcDataTable'),
    rc('BcList'),
    rc('BcGridView'),
    rc('BcVirtualScroller'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    loadingState: true,
    emptyState: true,
    errorState: true,
  },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['record-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Table',
    'chatgpt:List View',
    'chatgpt:Ticket List',
    'elementor:Posts',
    'elementor:Loop Grid',
    'easyerp:ListJobs',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'BlockCatalog datasource conventions not yet authored.',
    'Performance budget (pagination, virtualization, debounce/abort) not yet declared or tested.',
    'Mock demo data not yet produced.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P4-block-renderer-validator',
    'datasource-conventions',
    'performance-budget',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.record-detail — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const dataRecordDetail: CandidateCatalogEntry = {
  id: 'data.record-detail',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.record-detail.title',
  fallbackLabel: 'Record Detail',
  category: 'data',
  subcategory: 'record',
  channels: ['portal', 'internal', 'saas', 'website'],
  capabilities: ['data-source', 'permission-aware', 'i18n'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcDetailView'),
    rc('BcDescriptions'),
    rc('BcForm'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    loadingState: true,
    emptyState: true,
    errorState: true,
  },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['record-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Product Detail',
    'chatgpt:Blog Post',
    'easyerp:ShowJobs',
    'elementor:Purchase Summary',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Detail schema preset not yet authored.',
    'Permission adapter integration not yet wired.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'permission-adapter-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.account-summary — schema-preset-only, keep
// ---------------------------------------------------------------------------

const dataAccountSummary: CandidateCatalogEntry = {
  id: 'data.account-summary',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.account-summary.title',
  fallbackLabel: 'Account Summary',
  category: 'data',
  subcategory: 'account',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['data-source', 'permission-aware'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcCard'),
    rc('BcDescriptions'),
    rc('BcStatistic'),
    rc('BcAvatar'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['account-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['easyerp:AccountWidget', 'elementor:My Account'],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Account summary preset not yet authored.',
    'Permission adapter integration not yet wired.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'permission-adapter-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.download-center — existing-component-needs-binding, keep
// ---------------------------------------------------------------------------

const dataDownloadCenter: CandidateCatalogEntry = {
  id: 'data.download-center',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.download-center.title',
  fallbackLabel: 'Download Center',
  category: 'data',
  subcategory: 'document',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['data-source', 'security', 'permission-aware'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcFile'),
    rc('BcViewerDocument'),
    rc('BcViewerPdf'),
    rc('BcDataTable'),
    rc('BcReportLink'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'allowlist',
    filePolicy: { allowedTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'], maxSizeBytes: 52428800, scanning: false },
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Download Center', 'easyerp:FilePreviewController'],
  decision: 'keep',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Safe download action contract not yet defined.',
    'File validation policy (types/size/scanning) declared but not yet enforced by validator.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-data-interaction',
  blockedBy: [
    'P4-block-renderer-validator',
    'download-action-contract',
    'file-policy-enforcement',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.map-view — existing-component-needs-binding, merge
// Matrix batch is content-website (priorityBatch field preserves this).
// ---------------------------------------------------------------------------

const dataMapView: CandidateCatalogEntry = {
  id: 'data.map-view',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.map-view.title',
  fallbackLabel: 'Map View',
  category: 'data',
  subcategory: 'geo',
  channels: ['website', 'portal', 'internal'],
  capabilities: ['data-source', 'provider-adapter', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcMap'), rc('BcViewMap'), rc('BcGeo')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'media', kind: 'media', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { urlAllowlist: [], externalLinks: 'allowlist', richTextSanitize: 'n/a' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Map', 'elementor:Google Maps'],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Generic map adapter contract plus mock/local adapter not yet defined.',
    'Google-specific provider belongs in a plugin package (not core).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'map-adapter-contract',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.audit-log — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const dataAuditLog: CandidateCatalogEntry = {
  id: 'data.audit-log',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.audit-log.title',
  fallbackLabel: 'Audit Log',
  category: 'data',
  subcategory: 'audit',
  channels: ['internal', 'saas'],
  capabilities: ['data-source', 'permission-aware'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcActivity'),
    rc('BcTimelineSocial'),
    rc('BcViewActivity'),
    rc('BcTimeline'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Audit Log',
    'chatgpt:Activity Feed',
    'easyerp:Activity Feed pattern',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'BcTimeline has no Flutter export (bc_timeline missing); preset must use BcTimelineSocial/BcActivity on Flutter.',
    'Generic activity item contract not yet authored.',
    'Engine endpoint/model/permission wiring remains ADR-014 scope (not a core Ready blocker).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-workflow',
  blockedBy: [
    'P4-block-renderer-validator',
    'flutter:bc_timeline-parity',
    'activity-item-contract',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// data.pivot-table — component-gap, keep
// ---------------------------------------------------------------------------

const dataPivotTable: CandidateCatalogEntry = {
  id: 'data.pivot-table',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.data.pivot-table.title',
  fallbackLabel: 'Pivot Table',
  category: 'data',
  subcategory: 'analytics',
  channels: ['internal', 'saas'],
  capabilities: ['data-source', 'large-data'],
  renderStrategy: 'component',
  componentKey: 'BcPivot',
  requiredComponents: [rc('BcDataTable')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['aggregation-refresh'] },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Pivot', 'chatgpt:Spreadsheet', 'ADR-014:BcPivot'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No BcPivot component or pivot mode contract in BcDataTable exists.',
    'Aggregation adapter and engine endpoints remain ADR-014 scope.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'analytics',
  blockedBy: [
    'component-gap:BcPivot',
    'P4-block-renderer-validator',
    'aggregation-adapter',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const dataCandidates: CandidateCatalogEntry[] = [
  dataRecordList,
  dataRecordDetail,
  dataAccountSummary,
  dataDownloadCenter,
  dataMapView,
  dataAuditLog,
  dataPivotTable,
];
