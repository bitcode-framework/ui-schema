// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: ANALYTICS category
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
// analytics.kpi-grid — schema-preset-only, merge
// ---------------------------------------------------------------------------

const analyticsKpiGrid: CandidateCatalogEntry = {
  id: 'analytics.kpi-grid',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.analytics.kpi-grid.title',
  fallbackLabel: 'KPI Grid',
  category: 'analytics',
  subcategory: 'kpi',
  channels: ['internal', 'portal', 'saas'],
  capabilities: ['data-source', 'i18n', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcKpi'), rc('BcStatistic'), rc('BcDashboard')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['metric-refresh'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:KPI Card',
    'chatgpt:Stat Card',
    'elementor:Counter',
    'easyerp:StatsOverviewWidget',
  ],
  decision: 'merge',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'KPI grid schema preset not yet authored.',
    'Dashboard performance budget not yet declared.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'analytics',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'performance-budget',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// analytics.chart — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const analyticsChart: CandidateCatalogEntry = {
  id: 'analytics.chart',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.analytics.chart.title',
  fallbackLabel: 'Chart',
  category: 'analytics',
  subcategory: 'chart',
  channels: ['internal', 'portal', 'saas', 'website'],
  capabilities: ['data-source', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcChart'), rc('BcSparkline'), rc('BcProgress')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['metric-refresh'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Dashboard Widgets',
    'easyerp:ApexCharts',
    'elementor:Progress Bar',
    'ADR-015:BcChart',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'ADR-015 shared ECharts option contract Flutter parity not yet verified in this scope (must confirm web/flutter render identical option shapes before Ready).',
    'Avoid new chart prop dialects.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'analytics',
  blockedBy: [
    'P4-block-renderer-validator',
    'ADR-015-flutter-echarts-parity-verification',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// analytics.pivot — OLAP pivot table, ADR-014 Phase 3
// ---------------------------------------------------------------------------

const analyticsPivot: CandidateCatalogEntry = {
  id: 'analytics.pivot',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.analytics.pivot.title',
  fallbackLabel: 'Pivot Table',
  category: 'analytics',
  subcategory: 'pivot',
  channels: ['internal', 'portal', 'saas'],
  capabilities: ['data-source', 'i18n', 'responsive', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcPivot',
  requiredComponents: [rc('BcPivot')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material', 'cupertino'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['model-refresh'] },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'ADR-014:Pivot Table',
    'chatgpt:Pivot Table',
    'easyerp:PivotGrid',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'analytics',
  blockedBy: [
    'a11y-evidence-missing',
  ],
};

export const analyticsCandidates: CandidateCatalogEntry[] = [
  analyticsKpiGrid,
  analyticsChart,
  analyticsPivot,
];
