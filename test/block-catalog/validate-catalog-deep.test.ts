import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  CATALOG_DIAGNOSTIC_CODES,
  candidateContentHero,
  isActionSourceLike,
  isPortableExpressionLike,
  validateBlockCatalogEntryDeep,
} from '../../src/block-catalog/index.ts';
import type {
  BlockCatalogEntry,
  CatalogDiagnostic,
  ComponentRegistryProbe,
} from '../../src/block-catalog/index.ts';
import type { FunctionRegistry } from '../../src/expressions/function-registry.ts';
import type { FunctionManifestEntry } from '../../src/expressions/index.ts';

const registry: FunctionRegistry = {
  has: (name) => name === 'math.round' || name === 'string.concat',
  get: (name) => (name === 'math.round' ? manifest('math.round') : undefined),
  resolve: () => undefined,
  register: () => {},
  entries: () => [manifest('math.round'), manifest('string.concat')],
  validateRequired: () => [],
};

const allComponents: ComponentRegistryProbe = {
  has: () => true,
};

function manifest(name: string): FunctionManifestEntry {
  return {
    name,
    version: '0.1.0',
    platforms: ['web', 'flutter'],
    pure: true,
    deterministic: true,
  };
}

function readyEntry(overrides: Partial<BlockCatalogEntry> = {}): BlockCatalogEntry {
  const base: BlockCatalogEntry = {
    id: 'test.ready',
    version: '0.1.0',
    schemaVersion: '0.1.0',
    labelKey: 'block.test.ready.title',
    fallbackLabel: 'Test Ready',
    category: 'interaction',
    subcategory: 'test',
    channels: ['website'],
    capabilities: ['static', 'action-source', 'permission-aware'],
    renderStrategy: 'schema',
    schemaPreset: { type: 'section', title: 'Test', sections: [] },
    requiredComponents: [{ key: 'BcSection', platforms: ['web', 'flutter'] }],
    requiredFunctions: ['math.round'],
    requiredAdapters: [
      { name: 'action', kind: 'action', platforms: ['web', 'flutter'] },
      { name: 'permission', kind: 'permission', platforms: ['web', 'flutter'] },
    ],
    adaptivePolicy: { breakpoints: ['md'], platformMorph: ['material', 'cupertino'] },
    securityPolicy: { richTextSanitize: 'n/a' },
    cachePolicy: { strategy: 'none' },
    offlinePolicy: { support: 'unsupported' },
    migration: { toVersion: '0.1.0' },
    readiness: 'ready',
    a11yEvidence: { contract: 'semantic landmark + heading order', testReference: 'test/...' },
    tests: { schema: 'test/...', web: 'test/...', flutter: 'test/...' },
  };
  return { ...base, ...overrides };
}

function codes(result: { diagnostics: CatalogDiagnostic[] }): string[] {
  return result.diagnostics.map((d) => d.code);
}

function byCode(result: { diagnostics: CatalogDiagnostic[] }, code: string): CatalogDiagnostic[] {
  return result.diagnostics.filter((d) => d.code === code);
}

test('deep validator: valid candidate fixture passes without errors', () => {
  const result = validateBlockCatalogEntryDeep(candidateContentHero, {
    componentRegistry: allComponents,
    functionRegistry: registry,
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
});

test('deep validator: synthetic complete Ready fixture passes without errors', () => {
  const result = validateBlockCatalogEntryDeep(readyEntry(), {
    componentRegistry: allComponents,
    functionRegistry: registry,
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.ok(codes(result).includes('BLOCK_READY_GATE_INCOMPLETE'));
});

test('deep validator: invalid block fixture reports multiple P1 shape diagnostics', () => {
  const entry = readyEntry({
    id: 'bad',
    category: 'invalid' as BlockCatalogEntry['category'],
    readiness: 'bad' as BlockCatalogEntry['readiness'],
    renderStrategy: 'invalid' as BlockCatalogEntry['renderStrategy'],
  });
  const result = validateBlockCatalogEntryDeep(entry);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('BLOCK_ID_INVALID'));
  assert.ok(codes(result).includes('BLOCK_CATEGORY_INVALID'));
  assert.ok(codes(result).includes('BLOCK_READINESS_INVALID'));
  assert.ok(codes(result).includes('BLOCK_RENDER_STRATEGY_INVALID'));
});

test('deep validator: invalid expression fixture delegates to Agent F with precise path', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'form',
      fields: [{ name: 'qty', type: 'number' }],
      reactions: [
        {
          when: 'qty',
          target: 'qty',
          effect: {
            value: {
              expr: { kind: 'op', op: 'xor', args: [{ kind: 'literal', value: true }] },
            },
          },
        },
      ],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents, functionRegistry: registry });
  const expr = byCode(result, CATALOG_DIAGNOSTIC_CODES.EXPRESSION_INVALID);
  assert.equal(result.ok, false);
  assert.equal(expr.length > 0, true);
  assert.ok(expr[0].fieldPath?.includes('schemaPreset.reactions[0].effect.value.expr'));
  assert.match(expr[0].message, /EXPR_OP_UNKNOWN|Unknown operator/);
});

test('deep validator: invalid action fixture delegates to Agent G with precise path', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'form',
      fields: [{ name: 'email', type: 'email' }],
      actions: [
        {
          name: 'save',
          label: 'Save',
          source: { type: 'url', method: 'GET', url: 'https://example.test/save' },
        },
      ],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents, functionRegistry: registry });
  const action = byCode(result, CATALOG_DIAGNOSTIC_CODES.ACTION_SOURCE_INVALID);
  assert.equal(result.ok, false);
  assert.equal(action.length, 1);
  assert.equal(action[0].fieldPath, 'schemaPreset.actions[0].source.source.method');
});

test('deep validator: data binding validates only existing DataSource kinds', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'list',
      source: { type: 'graphql' },
      fields: [
        { name: 'country', options: { type: 'url', url: '' } },
        { name: 'owner', options: { type: 'model', name: '' } },
      ],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes(CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_TYPE_UNKNOWN));
  assert.ok(codes(result).includes(CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_URL_EMPTY));
  assert.ok(codes(result).includes(CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_MODEL_EMPTY));
});

test('deep validator: path precision for nested data binding and duplicate fields', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'section',
      sections: [
        { type: 'form', fields: [{ name: 'first' }] },
        {
          type: 'form',
          fields: [
            { name: 'status', options: { type: 'url', url: '' } },
            { name: 'status' },
          ],
        },
      ],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents });
  assert.ok(
    result.diagnostics.some((d) => d.fieldPath === 'schemaPreset.sections[1].fields[0].options.url'),
    JSON.stringify(result.diagnostics),
  );
  assert.ok(
    result.diagnostics.some((d) => d.fieldPath === 'schemaPreset.sections[1].fields[1].name'),
    JSON.stringify(result.diagnostics),
  );
});

test('deep validator: reports multiple diagnostics in one deterministic pass', () => {
  const entry = readyEntry({
    componentKey: 'bad',
    requiredComponents: ['notBc'],
    requiredAdapters: [],
    schemaPreset: {
      type: 'nope',
      source: { type: 'url', url: '' },
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const a = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents });
  const b = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents });
  assert.equal(a.ok, false);
  assert.equal(a.diagnostics.length >= 5, true, JSON.stringify(a.diagnostics));
  assert.deepEqual(a.diagnostics, b.diagnostics);
});

test('deep validator: nesting depth and cycle are diagnosed', () => {
  let nested: Record<string, unknown> = { type: 'section', sections: [] };
  const root = nested;
  for (let i = 0; i < 34; i += 1) {
    const child: Record<string, unknown> = { type: 'section', sections: [] };
    (nested.sections as unknown[]).push(child);
    nested = child;
  }
  const depthResult = validateBlockCatalogEntryDeep(readyEntry({ schemaPreset: root as unknown as BlockCatalogEntry['schemaPreset'] }), {
    componentRegistry: allComponents,
    maxNestingDepth: 10,
  });
  assert.ok(codes(depthResult).includes(CATALOG_DIAGNOSTIC_CODES.NESTING_TOO_DEEP));

  const cyclic: Record<string, unknown> = { type: 'section', sections: [] };
  (cyclic.sections as unknown[]).push(cyclic);
  const cycleResult = validateBlockCatalogEntryDeep(readyEntry({ schemaPreset: cyclic as unknown as BlockCatalogEntry['schemaPreset'] }), {
    componentRegistry: allComponents,
  });
  assert.ok(codes(cycleResult).includes(CATALOG_DIAGNOSTIC_CODES.NESTING_CYCLE));
});

test('deep validator: serializability is warning for Candidate and error for Ready', () => {
  const candidate = {
    ...candidateContentHero,
    schemaPreset: {
      type: 'form',
      reactions: [{ when: 'x', target: 'x', effect: { value: { expr: () => 1 } } }],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  };
  const candidateResult = validateBlockCatalogEntryDeep(candidate, { componentRegistry: allComponents });
  const candidateSerial = byCode(candidateResult, CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE);
  assert.equal(candidateSerial[0].severity, 'warning');
  assert.equal(candidateResult.ok, true);

  const ready = readyEntry({
    schemaPreset: {
      type: 'form',
      reactions: [{ when: 'x', target: 'x', effect: { value: { expr: () => 1 } } }],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const readyResult = validateBlockCatalogEntryDeep(ready, { componentRegistry: allComponents });
  const readySerial = byCode(readyResult, CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE);
  assert.equal(readySerial[0].severity, 'error');
  assert.equal(readyResult.ok, false);
});

test('deep validator: serializability detects symbol and undefined', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'section',
      payload: { hidden: undefined, marker: Symbol('x') },
      sections: [],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents });
  const serial = byCode(result, CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE);
  assert.equal(serial.length, 2);
  assert.ok(serial.some((d) => d.fieldPath === 'schemaPreset.payload.hidden'));
  assert.ok(serial.some((d) => d.fieldPath === 'schemaPreset.payload.marker'));
});

test('deep validator: capability gate is warning for Candidate and error for Ready', () => {
  const candidate = {
    ...candidateContentHero,
    capabilities: ['action-source' as const],
    requiredAdapters: [],
  };
  const candidateResult = validateBlockCatalogEntryDeep(candidate, { componentRegistry: allComponents });
  const candidateCap = byCode(candidateResult, CATALOG_DIAGNOSTIC_CODES.CAPABILITY_ADAPTER_MISSING);
  assert.equal(candidateCap[0].severity, 'warning');
  assert.equal(candidateResult.ok, true);

  const readyResult = validateBlockCatalogEntryDeep(
    readyEntry({ capabilities: ['action-source'], requiredAdapters: [] }),
    { componentRegistry: allComponents },
  );
  const readyCap = byCode(readyResult, CATALOG_DIAGNOSTIC_CODES.CAPABILITY_ADAPTER_MISSING);
  assert.equal(readyCap[0].severity, 'error');
  assert.equal(readyResult.ok, false);
});

test('deep validator: component reference format and per-platform registry are precise', () => {
  const badFormat = validateBlockCatalogEntryDeep(
    readyEntry({ componentKey: 'hero', renderStrategy: 'component' }),
    { componentRegistry: allComponents },
  );
  assert.ok(codes(badFormat).includes(CATALOG_DIAGNOSTIC_CODES.COMPONENT_REFERENCE_INVALID));

  const webMissing: ComponentRegistryProbe = {
    has: (_key, platform) => platform !== 'web',
  };
  const missing = validateBlockCatalogEntryDeep(readyEntry(), { componentRegistry: webMissing });
  const comp = byCode(missing, CATALOG_DIAGNOSTIC_CODES.COMPONENT_NOT_REGISTERED);
  assert.equal(comp.length > 0, true);
  assert.match(comp[0].message, /web/);
});

test('deep validator: type guards avoid false positives', () => {
  assert.equal(isActionSourceLike({ type: 'url', url: 'https://example.test' }), false);
  assert.equal(isActionSourceLike({ type: 'model', name: 'crm.contact' }), false);
  assert.equal(isActionSourceLike({ type: 'url', method: 'POST', url: 'https://example.test' }), true);
  assert.equal(isPortableExpressionLike({ type: 'form' }), false);
  assert.equal(isPortableExpressionLike({ kind: 'op', op: 'xor', args: [] }), true);
});

test('deep validator: public API does not throw on malformed/cyclic input', () => {
  const cyclic: Record<string, unknown> = { type: 'section' };
  cyclic.payload = cyclic;
  assert.doesNotThrow(() => {
    validateBlockCatalogEntryDeep(readyEntry({ schemaPreset: cyclic as unknown as BlockCatalogEntry['schemaPreset'] }), {
      componentRegistry: allComponents,
    });
  });
});

test('deep validator: valid embedded expression and action pass through F/G', () => {
  const entry = readyEntry({
    schemaPreset: {
      type: 'form',
      fields: [{ name: 'name' }],
      reactions: [
        {
          when: 'name',
          target: 'name',
          effect: {
            value: {
              expr: {
                kind: 'call',
                fn: 'math.round',
                args: [{ kind: 'literal', value: 1.2 }],
              },
            },
          },
        },
      ],
      actions: [
        {
          name: 'save',
          source: {
            type: 'model',
            model: 'crm.contact',
            operation: 'create',
            payload: { kind: 'path', path: 'values' },
          },
        },
      ],
    } as unknown as BlockCatalogEntry['schemaPreset'],
  });
  const result = validateBlockCatalogEntryDeep(entry, { componentRegistry: allComponents, functionRegistry: registry });
  assert.equal(byCode(result, CATALOG_DIAGNOSTIC_CODES.EXPRESSION_INVALID).length, 0);
  assert.equal(byCode(result, CATALOG_DIAGNOSTIC_CODES.ACTION_SOURCE_INVALID).length, 0);
});
