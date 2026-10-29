// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: CONTENT category
//
// Canonical Candidate metadata seed (ADR-017). All entries are
// `readiness: 'candidate'`. NO Ready promotion. Gaps and blockedBy are
// explicit and honest. a11y/test evidence is NOT faked — fields are left
// absent and the gap is named in `gaps`/`blockedBy`.
//
// Source of truth for candidate ids/status/decision/priorityBatch:
// sprints/package-ui-elementor/block-catalog-candidate-matrix.json (frozen
// baseline v0.1.0). Platform availability from platform-audit.ts snapshot.
//
// Pure data. No framework imports.
// ============================================================================

import type { CandidateCatalogEntry } from '../types.ts';
import { componentPlatforms } from '../platform-audit.ts';

/**
 * Helper: build a RequiredComponent declaration from a web component key,
 * scoping `platforms` to actual audit availability (NOT blanket
 * `['web','flutter']`). Keys missing from the audit default to `['web']`
 * only and must be resolved by a blockedBy entry.
 */
function rc(key: string): { key: string; platforms: Array<'web' | 'flutter'> } {
  return { key, platforms: componentPlatforms(key) };
}

// ---------------------------------------------------------------------------
// content.hero — schema-preset-only, keep
// ---------------------------------------------------------------------------

const contentHero: CandidateCatalogEntry = {
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
  requiredComponents: [
    rc('BcSection'),
    rc('BcStack'),
    rc('BcImage'),
    rc('BcButton'),
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    reducedMotion: true,
    loadingState: false,
    emptyState: false,
    errorState: false,
    disabledState: false,
  },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'allow',
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Hero Banner', 'elementor:Slides'],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Full schema preset not yet authored.',
    'BcSection has no Flutter export (bc_section missing); preset must compose without it or wait for Flutter parity.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'flutter:bc_section-parity',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.cta — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const contentCta: CandidateCatalogEntry = {
  id: 'content.cta',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.cta.title',
  fallbackLabel: 'Call To Action',
  category: 'content',
  subcategory: 'marketing',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'action-source', 'i18n', 'a11y'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcCard'),
    rc('BcButton'),
    rc('BcImage'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: {
    breakpoints: true,
    platformMorph: ['material'],
    reducedMotion: true,
  },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:CTA', 'elementor:Call to Action', 'elementor:Button'],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Non-navigation CTA actions require ActionSource wired into ReactiveStore.runAction (P3 runtime not yet merged).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.rich-text — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const contentRichText: CandidateCatalogEntry = {
  id: 'content.rich-text',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.rich-text.title',
  fallbackLabel: 'Rich Text',
  category: 'content',
  subcategory: 'text',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'sanitize', 'i18n'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcRichText'), rc('BcMarkdown')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: {
    richTextSanitize: 'on',
    externalLinks: 'allowlist',
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Rich Text',
    'elementor:Text Editor',
    'elementor:HTML',
    'easyerp:RichEditor',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Sanitize policy must be enforced by P4 validator (richTextSanitize:on declared but not yet gated).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'sanitize-policy-enforcement',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.plain-text — schema-preset-only, keep
// ---------------------------------------------------------------------------

const contentPlainText: CandidateCatalogEntry = {
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
  requiredComponents: [rc('BcLabel'), rc('BcBox')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Heading',
    'chatgpt:Text',
    'elementor:Heading',
    'elementor:Page Title',
  ],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Schema preset (text node / canonical text primitive) not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.media — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const contentMedia: CandidateCatalogEntry = {
  id: 'content.media',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.media.title',
  fallbackLabel: 'Media',
  category: 'content',
  subcategory: 'media',
  channels: ['website', 'portal', 'internal'],
  capabilities: ['static', 'data-source', 'provider-adapter', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcImage'),
    rc('BcViewerImage'),
    rc('BcViewerVideo'),
    rc('BcViewerAudio'),
    rc('BcViewerYoutube'),
    rc('BcGalleria'),
    rc('BcCarousel'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'media', kind: 'media', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], reducedMotion: true },
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
    'chatgpt:Image',
    'chatgpt:Video',
    'chatgpt:Audio',
    'elementor:Image',
    'elementor:Video',
    'elementor:Sound Cloud',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Provider adapter contract for third-party embeds not yet defined.',
    'Media URL safety policy (urlAllowlist) not yet populated.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'provider-adapter-contract',
    'url-safety-policy',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.gallery — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const contentGallery: CandidateCatalogEntry = {
  id: 'content.gallery',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.gallery.title',
  fallbackLabel: 'Gallery',
  category: 'content',
  subcategory: 'media',
  channels: ['website', 'portal', 'internal'],
  capabilities: ['static', 'data-source', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcGalleria'), rc('BcCarousel'), rc('BcViewerImage')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], reducedMotion: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Gallery',
    'elementor:Basic Gallery',
    'elementor:Image Carousel',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Gallery preset variants and datasource shape not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.faq — schema-preset-only, keep
// ---------------------------------------------------------------------------

const contentFaq: CandidateCatalogEntry = {
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
  requiredComponents: [rc('BcAccordion'), rc('BcDisclosure')],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:FAQ', 'elementor:Toggle', 'elementor:Accordion'],
  decision: 'keep',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'FAQ schema preset, heading hierarchy policy, and i18n keys not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.testimonial — schema-preset-only, merge
// ---------------------------------------------------------------------------

const contentTestimonial: CandidateCatalogEntry = {
  id: 'content.testimonial',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.testimonial.title',
  fallbackLabel: 'Testimonial',
  category: 'content',
  subcategory: 'social-proof',
  channels: ['website', 'portal', 'saas'],
  capabilities: ['static', 'data-source'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcCard'),
    rc('BcCarousel'),
    rc('BcRate'),
    rc('BcAvatar'),
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], reducedMotion: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Testimonial',
    'elementor:Testimonial',
    'elementor:Reviews',
  ],
  decision: 'merge',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Testimonial schema shape and avatar fallback policy not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.team-member — schema-preset-only, merge
// ---------------------------------------------------------------------------

const contentTeamMember: CandidateCatalogEntry = {
  id: 'content.team-member',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.team-member.title',
  fallbackLabel: 'Team Member',
  category: 'content',
  subcategory: 'people',
  channels: ['website', 'portal', 'internal'],
  capabilities: ['static', 'data-source', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcCard'),
    rc('BcAvatar'),
    rc('BcDescriptions'),
    rc('BcFollow'),
  ],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Team Member', 'elementor:Author Box'],
  decision: 'merge',
  matrixStatus: 'schema-preset-only',
  gaps: [
    'Team member schema preset not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.pricing-table — existing-component-needs-binding, keep
// ---------------------------------------------------------------------------

const contentPricingTable: CandidateCatalogEntry = {
  id: 'content.pricing-table',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.pricing-table.title',
  fallbackLabel: 'Pricing Table',
  category: 'content',
  subcategory: 'pricing',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['static', 'data-source', 'action-source', 'i18n'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcCard'),
    rc('BcDataTable'),
    rc('BcButton'),
    rc('BcStatistic'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Pricing Table',
    'elementor:Price Table',
    'elementor:Price List',
  ],
  decision: 'keep',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Plan-selection actions require ActionSource wired into ReactiveStore.runAction (P3 runtime not yet merged).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.countdown — component-gap, keep
// ---------------------------------------------------------------------------

const contentCountdown: CandidateCatalogEntry = {
  id: 'content.countdown',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.countdown.title',
  fallbackLabel: 'Countdown',
  category: 'content',
  subcategory: 'time',
  channels: ['website', 'portal', 'internal'],
  capabilities: ['static', 'reactive'],
  renderStrategy: 'component',
  componentKey: 'BcCountdown',
  requiredComponents: [],
  requiredFunctions: [],
  requiredAdapters: [],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], reducedMotion: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['chatgpt:Countdown', 'elementor:Countdown'],
  decision: 'keep',
  matrixStatus: 'component-gap',
  gaps: [
    'No BcCountdown component exists on web or Flutter. Requires a new portable time/reactive component.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'component-gap:BcCountdown',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// content.social-links — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const contentSocialLinks: CandidateCatalogEntry = {
  id: 'content.social-links',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.content.social-links.title',
  fallbackLabel: 'Social Links',
  category: 'content',
  subcategory: 'social',
  channels: ['website', 'portal', 'saas'],
  capabilities: ['static', 'security', 'a11y'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcShare'),
    rc('BcLike'),
    rc('BcFollow'),
    rc('BcButton'),
  ],
  requiredFunctions: [],
  requiredAdapters: [],
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
    'chatgpt:Social Links',
    'elementor:Social Icons',
    'elementor:Share Buttons',
    'elementor:Link in Bio',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'External URL safety policy (urlAllowlist) not yet populated.',
    'Provider icon strategy not yet defined.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'content-website',
  blockedBy: [
    'P4-block-renderer-validator',
    'url-safety-policy',
    'provider-icon-strategy',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const contentCandidates: CandidateCatalogEntry[] = [
  contentHero,
  contentCta,
  contentRichText,
  contentPlainText,
  contentMedia,
  contentGallery,
  contentFaq,
  contentTestimonial,
  contentTeamMember,
  contentPricingTable,
  contentCountdown,
  contentSocialLinks,
];
