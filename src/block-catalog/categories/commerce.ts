// ============================================================================
// @bitcode/ui-schema — Block Catalog Candidate Metadata: COMMERCE category
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
// commerce.product-grid — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const commerceProductGrid: CandidateCatalogEntry = {
  id: 'commerce.product-grid',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.commerce.product-grid.title',
  fallbackLabel: 'Product Grid',
  category: 'commerce',
  subcategory: 'product',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['data-source', 'commerce', 'responsive', 'large-data'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcDataTable'),
    rc('BcGridView'),
    rc('BcCard'),
    rc('BcImage'),
    rc('BcRate'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['catalog-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Product Grid',
    'elementor:Products',
    'elementor:Product Categories',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Commerce item contract and add-to-cart ActionSource not yet authored.',
    'Reuses data.record-list commerce variant; performance budget not yet declared.',
    'Add-to-cart requires ActionSource wired into ReactiveStore.runAction.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'commerce',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'commerce-item-contract',
    'performance-budget',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// commerce.product-detail — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const commerceProductDetail: CandidateCatalogEntry = {
  id: 'commerce.product-detail',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.commerce.product-detail.title',
  fallbackLabel: 'Product Detail',
  category: 'commerce',
  subcategory: 'product',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['data-source', 'commerce', 'responsive'],
  renderStrategy: 'schema',
  requiredComponents: [
    rc('BcDetailView'),
    rc('BcGalleria'),
    rc('BcRate'),
    rc('BcTabs'),
    rc('BcButton'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'n/a', externalLinks: 'allow' },
  cachePolicy: { strategy: 'memory', invalidateOn: ['catalog-write'] },
  offlinePolicy: { support: 'read' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Product Detail',
    'elementor:WooCommerce Product Widgets',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Cart actions require ActionSource wired into ReactiveStore.runAction.',
    'Reuses data.record-detail commerce variant; schema preset not yet authored.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'commerce',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// commerce.cart-checkout — component-gap, merge
// ---------------------------------------------------------------------------

const commerceCartCheckout: CandidateCatalogEntry = {
  id: 'commerce.cart-checkout',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.commerce.cart-checkout.title',
  fallbackLabel: 'Cart and Checkout',
  category: 'commerce',
  subcategory: 'checkout',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['data-source', 'action-source', 'commerce', 'payment-adapter', 'security'],
  renderStrategy: 'component',
  componentKey: 'BcCartCheckout',
  requiredComponents: [
    rc('BcDataTable'),
    rc('BcForm'),
    rc('BcWizard'),
    rc('BcButton'),
  ],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, errorState: true },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'allowlist',
    paymentAdapterRequired: true,
    redactFields: ['cardNumber', 'cvv'],
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Cart',
    'chatgpt:Checkout',
    'elementor:Cart',
    'elementor:Checkout',
    'elementor:Add To Cart',
  ],
  decision: 'merge',
  matrixStatus: 'component-gap',
  gaps: [
    'No dedicated generic commerce cart/checkout component exists.',
    'Generic payment ActionAdapter not yet defined; no provider-specific keys in schema (providers are plugins).',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'commerce',
  blockedBy: [
    'component-gap:BcCartCheckout',
    'payment-adapter-contract',
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'security-review',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// commerce.payment-action — adapter-gap, merge
// ---------------------------------------------------------------------------

const commercePaymentAction: CandidateCatalogEntry = {
  id: 'commerce.payment-action',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.commerce.payment-action.title',
  fallbackLabel: 'Payment Action',
  category: 'commerce',
  subcategory: 'payment',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['action-source', 'payment-adapter', 'security'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcButton'), rc('BcDialog')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'] },
  securityPolicy: {
    richTextSanitize: 'n/a',
    externalLinks: 'allowlist',
    paymentAdapterRequired: true,
    redactFields: ['cardNumber', 'cvv', 'token'],
  },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: ['elementor:PayPal Button', 'elementor:Stripe Button'],
  decision: 'merge',
  matrixStatus: 'adapter-gap',
  gaps: [
    'Generic payment adapter contract not yet defined; only mock/local adapter for tests is core-scoped.',
    'Third-party provider buttons are plugin candidates, not core components.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'commerce',
  blockedBy: [
    'payment-adapter-contract',
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

// ---------------------------------------------------------------------------
// commerce.review — existing-component-needs-binding, merge
// ---------------------------------------------------------------------------

const commerceReview: CandidateCatalogEntry = {
  id: 'commerce.review',
  version: '0.1.0',
  schemaVersion: '0.1.0',
  labelKey: 'block.commerce.review.title',
  fallbackLabel: 'Review',
  category: 'commerce',
  subcategory: 'review',
  channels: ['website', 'portal', 'internal', 'saas'],
  capabilities: ['data-source', 'action-source'],
  renderStrategy: 'schema',
  requiredComponents: [rc('BcRate'), rc('BcComment'), rc('BcChatter')],
  requiredFunctions: [],
  requiredAdapters: [
    { name: 'data', kind: 'data', platforms: ['web', 'flutter'] },
    { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
  ],
  adaptivePolicy: { breakpoints: true, platformMorph: ['material'], loadingState: true, emptyState: true, errorState: true },
  securityPolicy: { richTextSanitize: 'opt-out-policy', externalLinks: 'deny' },
  cachePolicy: { strategy: 'none' },
  offlinePolicy: { support: 'unsupported' },
  migration: { toVersion: '0.1.0' },
  readiness: 'candidate',
  sourceReferences: [
    'chatgpt:Review',
    'elementor:Reviews',
    'elementor:Product Rating',
  ],
  decision: 'merge',
  matrixStatus: 'existing-component-needs-binding',
  gaps: [
    'Generic review datasource/action shape not yet authored.',
    'Review submit requires ActionSource wired into ReactiveStore.runAction.',
    'a11y evidence not yet produced.',
    'test coverage not yet produced.',
  ],
  priorityBatch: 'commerce',
  blockedBy: [
    'P3-actions-runtime-unmerged',
    'P4-block-renderer-validator',
    'schema-preset-authoring',
    'a11y-evidence-missing',
    'test-coverage-missing',
  ],
};

export const commerceCandidates: CandidateCatalogEntry[] = [
  commerceProductGrid,
  commerceProductDetail,
  commerceCartCheckout,
  commercePaymentAction,
  commerceReview,
];
