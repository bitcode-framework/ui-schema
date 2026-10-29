// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: PLUGIN + EXCLUDED
//
// These two matrix rows are NOT Ready-bound core entries. They are recorded
// for matrix-parity completeness and to document the resolution decisions.
//
// - plugin.embed-social: `decision: 'alias'`, `status: 'duplicate-alias'`.
//   Provider-specific embeds are plugin/provider catalog entries, NOT core
//   Ready blocks. Core ships adapter contract + mock/local adapter only.
// - excluded.wordpress-specific: `decision: 'alias'`, `status: 'excluded'`.
//   Third-party/WordPress implementation detail; covered by generic blocks.
//
// Source: block-catalog-candidate-matrix.json (frozen baseline v0.1.0).
// Pure data. No framework imports.
// ============================================================================

import type { CandidateCatalogEntry } from '../types.ts';
import { componentPlatforms } from '../platform-audit.ts';

function rc(key: string): { key: string; platforms: Array<'web' | 'flutter'> } {
  return { key, platforms: componentPlatforms(key) };
}

// ---------------------------------------------------------------------------
// plugin.embed-social — duplicate-alias, alias
// ---------------------------------------------------------------------------

const pluginEmbedSocial: CandidateCatalogEntry = {
  id: 'plugin.embed-social',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.plugin.embed-social.title',
  fallbackLabel: 'Social Embed Plugin Candidate',
  category: 'content',
  subcategory: 'plugin',
  channels: ['website', 'portal'],
  capabilities: ['provider-adapter', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcSocialEmbed',
  requiredComponents: [
    rc('BcViewerYoutube'),
    rc('BcViewerInstagram'),
    rc('BcViewerTiktok'),
    rc('BcComment'),
    rc('BcChatter'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'media', kind: 'media', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: {
    urlAllowlist: [],
    externalLinks: 'allowlist',
    richTextSanitize: 'n/a',
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'elementor:Facebook Page',
    'elementor:Facebook Embed',
    'elementor:Sound Cloud',
    'elementor:Shortcode',
  ],
  decision: 'alias',
  matrixStatus: 'duplicate-alias',
  gaps: [
    'Provider-specific embeds are plugin/provider catalog entries, NOT core Ready blocks.',
    'Core ships adapter contract + mock/local adapter only; map to generic components and do not create a Ready entry.',
  ],
  priorityBatch: 'plugin-extensibility',
  blockedBy: [
    'plugin-scoped-not-core-ready',
    'provider-adapter-contract',
  ],
};

// ---------------------------------------------------------------------------
// excluded.wordpress-specific — excluded, alias
// ---------------------------------------------------------------------------

const excludedWordpressSpecific: CandidateCatalogEntry = {
  id: 'excluded.wordpress-specific',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.excluded.wordpress-specific.title',
  fallbackLabel: 'WordPress-specific Theme/WooCommerce Internals',
  category: 'content',
  subcategory: 'excluded',
  channels: ['website'],
  capabilities: [],
  renderStrategy: 'schema',
  requiredComponents: [],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: false, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'elementor:Template',
    'elementor:WooCommerce Pages',
    'elementor:WooCommerce Notices',
    'elementor:Product Breadcrumbs',
  ],
  decision: 'alias',
  matrixStatus: 'excluded',
  gaps: [
    'Third-party or WordPress-specific implementation detail. Cover with generic blocks or plugin adapters instead of core entries.',
  ],
  priorityBatch: 'none',
  blockedBy: ['excluded-by-decision'],
};

export const pluginCandidates: CandidateCatalogEntry[] = [pluginEmbedSocial];
export const excludedCandidates: CandidateCatalogEntry[] = [
  excludedWordpressSpecific,
];
