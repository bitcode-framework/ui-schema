// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: WORKFLOW category
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
// workflow.approval-actions — component-gap, keep
// ---------------------------------------------------------------------------

const workflowApprovalActions: CandidateCatalogEntry = {
  id: 'workflow.approval-actions',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.workflow.approval-actions.title',
  fallbackLabel: 'Approval Actions',
  category: 'workflow',
  subcategory: 'approval',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['action-source', 'workflow', 'permission-aware', 'reactive'],
  renderStrategy: 'component',
  componentKey: 'BcApprovalActions',
  requiredComponents: [
    rc('BcSteps'),
    rc('BcWizard'),
    rc('BcPrompt'),
    rc('BcActivity'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Approval Flow',
    'chatgpt:Assignment',
    'easyerp:ChangeStageStatusApplicantWidget',
  ],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated generic workflow action component exists; needs ActionSource lifecycle.',
    'Permission adapter integration not yet wired.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-workflow',
  blockedBy: [
    'component-gap:BcApprovalActions',
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'permission-adapter-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// workflow.state-indicator — contract-gap, keep
// ---------------------------------------------------------------------------

const workflowStateIndicator: CandidateCatalogEntry = {
  id: 'workflow.state-indicator',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.workflow.state-indicator.title',
  fallbackLabel: 'State Indicator',
  category: 'workflow',
  subcategory: 'state',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['static', 'data-source', 'workflow', 'a11y'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcBadge'),
    rc('BcSteps'),
    rc('BcProgress'),
    rc('BcTagGroup'),
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:State Badge',
    'elementor:Progress Tracker',
    'docs/codebase:bc-statusbar',
    'docs/codebase:bc-priority',
  ],
  decision: 'keep',
  matrixStatus: 'contract-gap',
  gaps: [
    'State-indicator semantics may need a dedicated BcStateBadge/BcStatusBar if workflow state semantics require a distinct component contract.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-workflow',
  blockedBy: [
    'contract-gap:state-indicator-semantics',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// workflow.diagram-viewer — schema-preset-only, keep
// ---------------------------------------------------------------------------

const workflowDiagramViewer: CandidateCatalogEntry = {
  id: 'workflow.diagram-viewer',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.workflow.diagram-viewer.title',
  fallbackLabel: 'Workflow Diagram (Viewer)',
  category: 'workflow',
  subcategory: 'diagram',
  channels: ['internal', 'saas'],
  capabilities: ['workflow', 'data-source', 'static'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcChartGraph'), rc('BcSteps')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Workflow Diagram', 'ADR-014:BcWorkflowBuilder'],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Read-only process graph preset and example data shape not yet authored.',
    'Visual semantic parity between BcChartGraph (web) and BcChart (flutter) NOT proven — both exist but may not render process-graph semantics identically. Must verify before Ready.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-workflow',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'visual-parity:BcChartGraph-vs-BcChart',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// workflow.diagram-editor — component-gap, keep (builder-surface)
// ---------------------------------------------------------------------------

const workflowDiagramEditor: CandidateCatalogEntry = {
  id: 'workflow.diagram-editor',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.workflow.diagram-editor.title',
  fallbackLabel: 'Workflow Diagram (Editor)',
  category: 'workflow',
  subcategory: 'diagram',
  channels: ['internal', 'saas'],
  capabilities: ['workflow', 'builder', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcWorkflowDiagramEditor',
  requiredComponents: [],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Workflow Diagram', 'ADR-014:BcWorkflowBuilder'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated workflow authoring component exists (drag nodes, edges, properties, persistence, undo/redo).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'builder-surface',
  blockedBy: [
    'component-gap:BcWorkflowDiagramEditor',
    'builder-authoring-contract',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// workflow.chatter — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const workflowChatter: CandidateCatalogEntry = {
  id: 'workflow.chatter',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.workflow.chatter.title',
  fallbackLabel: 'Chatter',
  category: 'workflow',
  subcategory: 'collaboration',
  channels: ['portal', 'internal', 'saas'],
  capabilities: ['data-source', 'action-source', 'permission-aware'],
  renderStrategy: 'component',
  componentKey: 'BcChatter',
  requiredComponents: [
    rc('BcChatter'),
    rc('BcComment'),
    rc('BcMentions'),
    rc('BcActivity'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
    { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'opt-out-policy', externalLinks: 'deny' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['chatter-write'] },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Chatter',
    'chatgpt:Chat',
    'elementor:Post Comments',
    'elementor:Facebook Comments',
    'ADR-014:BcChatter',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Generic comment/message datasource and action adapter examples not yet authored.',
    'Engine endpoint, model, permission, realtime, and persistence wiring remain ADR-014 scope.',
    'Facebook-specific refs become provider/plugin aliases.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'erp-workflow',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'ADR-014-engine-realtime-wiring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const workflowCandidates: CandidateCatalogEntry[] = [
  workflowApprovalActions,
  workflowStateIndicator,
  workflowDiagramViewer,
  workflowDiagramEditor,
  workflowChatter,
];
