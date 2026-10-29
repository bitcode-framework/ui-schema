// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: NAVIGATION category
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
// navigation.menu — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const navigationMenu: CandidateCatalogEntry = {
  id: 'navigation.menu',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.navigation.menu.title',
  fallbackLabel: 'Navigation Menu',
  category: 'navigation',
  subcategory: 'menu',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'responsive', 'a11y', 'adapt'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcNavigationMenu'),
    rc('BcMegaMenu'),
    rc('BcMenubar'),
    rc('BcPanelMenu'),
    rc('BcSlideMenu'),
    rc('BcSidebar'),
    rc('BcBreadcrumb'),
    rc('BcAnchor'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'navigation', kind: 'navigation', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['cupertino', 'material'],
    reducedMotion: true,
  },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allowlist' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'elementor:Nav Menu',
    'elementor:Mega Menu',
    'elementor:Off-Canvas',
    'chatgpt:Breadcrumb',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Responsive/adapt policies per menu variant not yet authored.',
    'Platform-aware behavior (iOS/cupertino vs Android/material per ADR-011) not yet verified per variant.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'navigation-cms',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'platform-adapt-verification',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// navigation.search-toc-sitemap — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const navigationSearchTocSitemap: CandidateCatalogEntry = {
  id: 'navigation.search-toc-sitemap',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.navigation.search-toc-sitemap.title',
  fallbackLabel: 'Search, TOC, and Sitemap',
  category: 'navigation',
  subcategory: 'cms',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'data-source', 'a11y'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcSearch'),
    rc('BcAnchor'),
    rc('BcTree'),
    rc('BcList'),
    rc('BcBreadcrumb'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'navigation', kind: 'navigation', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['content-write'] },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Search',
    'chatgpt:TOC',
    'chatgpt:Sitemap',
    'elementor:Search Bar',
    'elementor:Sitemap',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'CMS navigation schemas and search datasource conventions not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'navigation-cms',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const navigationCandidates: CandidateCatalogEntry[] = [
  navigationMenu,
  navigationSearchTocSitemap,
];
