// ============================================================================
// @bitcode/ui-schema — Deep Block Catalog Validator (ADR-017 §8, plan §7)
//
// Production-grade orchestrator that composes:
//   - P1 shape validator: validateBlockCatalogEntry / validateCandidateCatalogEntry
//   - Agent F expression validator: validateExpression (commit 71885aa)
//   - Agent G action validator: validateActionSource (commit a8a28a8)
// and adds deep checks NOT covered by those three:
//   - schemaPreset deep walk (kind, data binding, duplicate fields, nesting)
//   - embedded PortableExpression scan (path-scoped, type-guarded → F)
//   - embedded ActionSource scan (path-scoped, type-guarded → G)
//   - serializability (function/symbol/undefined → error Ready, warning Candidate)
//   - minimal structural capability gate (adapter presence only)
//   - component reference format + per-platform registry probe
//
// Design rules (amended spec):
//   - Deterministic: fixed traversal order, stable sort (fieldPath, severity, code).
//   - Never throws: public API catches all internal errors → VALIDATOR_INTERNAL_ERROR.
//   - No `any`: strict-mode clean.
//   - Reuses BlockCatalogDiagnostic via CatalogDiagnostic (IS-A, not parallel).
//   - Policy readiness gates (payment, offline queue, sanitize, large-data perf)
//     are OWNED BY AGENT L (P4) — NOT implemented here. Only minimal structural
//     adapter-presence checks run here.
//   - No Ready promotion: validates only, never sets readiness.
//
// Pure functions. No I/O, no DOM, no Flutter, no engine, no globals.
// ============================================================================

import type { ActionSource } from '../actions/source.ts';
import type { FunctionRegistry } from '../expressions/function-registry.ts';
import { validateActionSource } from '../actions/validate.ts';
import { EXPRESSION_NODE_KINDS } from '../expressions/ast.ts';
import type { ExpressionError } from '../expressions/errors.ts';
import { validateExpression } from '../expressions/validate.ts';
import type { CatalogDiagnostic, CatalogValidationResult } from './catalog-diagnostic.ts';
import { CATALOG_DIAGNOSTIC_CODES, severityRank } from './catalog-diagnostic.ts';
import type { BlockCatalogEntry, BlockPlatform, CandidateCatalogEntry } from './types.ts';
import {
  validateBlockCatalogEntry,
  validateCandidateCatalogEntry,
} from './validate.ts';
import type { BlockDiagnosticSeverity } from './validate.ts';

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

/**
 * Per-platform component registry probe (amendment #8). Allows the validator
 * to distinguish missing-on-web from missing-on-Flutter and report the
 * specific platform in the diagnostic message.
 *
 * When `platform` is omitted, the probe reports whether the component is
 * registered on ANY platform.
 */
export interface ComponentRegistryProbe {
  has(key: string, platform?: BlockPlatform): boolean;
}

export interface CatalogValidationOptions {
  /** Forwarded to F's validateExpression for `call` node function validation. */
  functionRegistry?: FunctionRegistry;
  /** Optional component registry for existence checks. */
  componentRegistry?: ComponentRegistryProbe;
  /** Maximum schemaPreset nesting depth (default 32). */
  maxNestingDepth?: number;
}

// ---------------------------------------------------------------------------
// Type guards (amendment #9 — strong, not raw kind/type matching)
// ---------------------------------------------------------------------------

import type {
  CallNode,
  IfNode,
  OpNode,
  PathNode,
  PortableExpression,
} from '../expressions/ast.ts';

/**
 * Strong type guard for PortableExpression. Checks:
 *   - value is a plain object with string `kind`
 *   - `kind` ∈ EXPRESSION_NODE_KINDS (literal/path/op/call/if)
 *   - has the discriminating fields for that kind
 *
 * This avoids false positives from UiSchema.type ('form'/'section'/...),
 * DataSource.type ('local'/'url'/...), FieldNode.type, Effect.kind, etc.,
 * which all use a `type` or `kind` field but with different value sets and
 * different sibling fields.
 */
export function isPortableExpressionLike(value: unknown): value is PortableExpression {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const kind = v.kind;
  if (typeof kind !== 'string' || !EXPRESSION_NODE_KINDS.has(kind as PortableExpression['kind'])) {
    return false;
  }
  switch (kind as PortableExpression['kind']) {
    case 'literal':
      return 'value' in v;
    case 'path':
      return typeof (v as Partial<PathNode>).path === 'string';
    case 'op':
      return (
        typeof (v as Partial<OpNode>).op === 'string' &&
        Array.isArray((v as Partial<OpNode>).args)
      );
    case 'call':
      return (
        typeof (v as Partial<CallNode>).fn === 'string' &&
        Array.isArray((v as Partial<CallNode>).args)
      );
    case 'if':
      return (
        isPortableExpressionLike((v as Partial<IfNode>).test) &&
        isPortableExpressionLike((v as Partial<IfNode>).then) &&
        isPortableExpressionLike((v as Partial<IfNode>).else)
      );
  }
}

/**
 * Strong type guard for ActionSource. Checks:
 *   - value is a plain object with string `type`
 *   - `type` ∈ ACTION_SOURCE_TYPES (local/handler/url/model)
 *   - has the discriminating fields for that type
 *
 * This avoids false positives from DataSource (which shares `type` values
 * 'local'/'url'/'model' but has different fields: DataSource.url has no
 * `method`, DataSource.local has `data` not `effects`, etc.).
 */
export function isActionSourceLike(value: unknown): value is ActionSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const t = v.type;
  if (typeof t !== 'string') return false;
  switch (t) {
    case 'local':
      return Array.isArray(v.effects);
    case 'handler':
      return typeof v.handlerKey === 'string';
    case 'url':
      // ActionSource url has `method` (POST/PUT/PATCH/DELETE); DataSource url does NOT.
      return typeof v.method === 'string' && typeof v.url === 'string';
    case 'model':
      // ActionSource model has `operation`; DataSource model has `name` + optional `adapter`.
      return typeof v.operation === 'string' && typeof v.model === 'string';
    default:
      return false;
  }
}

function isExpressionSlotCandidate(value: Record<string, unknown>, fieldPath: string): boolean {
  if (!fieldPath.endsWith('.expr') && !fieldPath.includes('.expr.')) return false;
  return typeof value.kind === 'string';
}

// ---------------------------------------------------------------------------
// Internal context
// ---------------------------------------------------------------------------

interface WalkContext {
  entry: BlockCatalogEntry;
  functionRegistry?: FunctionRegistry;
  maxNestingDepth: number;
  diagnostics: CatalogDiagnostic[];
  visited: WeakSet<object>; // cycle detection across the whole schemaPreset
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function diag(
  entryId: string | undefined,
  code: string,
  severity: BlockDiagnosticSeverity,
  message: string,
  fieldPath: string,
  source: CatalogDiagnostic['source'],
  suggestedFix?: string,
): CatalogDiagnostic {
  return {
    code,
    severity,
    ...(entryId !== undefined ? { entryId } : {}),
    fieldPath,
    message,
    source,
    ...(suggestedFix !== undefined ? { suggestedFix } : {}),
  };
}

// ---------------------------------------------------------------------------
// P1 passthrough mapper
// ---------------------------------------------------------------------------

import type { BlockCatalogDiagnostic } from './validate.ts';

function mapP1Diagnostics(diagnostics: BlockCatalogDiagnostic[]): CatalogDiagnostic[] {
  return diagnostics.map((d) => ({
    code: d.code,
    severity: d.severity,
    entryId: d.entryId,
    fieldPath: d.fieldPath,
    message: d.message,
    suggestedFix: d.suggestedFix,
    source: 'shape' as const,
  }));
}

// ---------------------------------------------------------------------------
// schemaPreset deep walk
// ---------------------------------------------------------------------------

import type { UiSchemaKind } from '../schema/types.ts';

const VALID_SCHEMA_KINDS: ReadonlySet<UiSchemaKind> = new Set<UiSchemaKind>([
  'form',
  'list',
  'detail',
  'section',
  'grid',
  'custom',
]);

const VALID_DATA_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'local',
  'fetcher',
  'url',
  'model',
]);

function deepWalk(
  schema: unknown,
  fieldPath: string,
  depth: number,
  ctx: WalkContext,
): void {
  const entryId = ctx.entry.id;

  // --- Null / primitive: nothing to walk ---
  if (schema === null || typeof schema !== 'object') return;

  // --- Cycle detection (covers nested objects in any field, not just sections) ---
  if (ctx.visited.has(schema as object)) {
    ctx.diagnostics.push(
      diag(
        entryId,
        CATALOG_DIAGNOSTIC_CODES.NESTING_CYCLE,
        'error',
        `Circular reference detected at '${fieldPath}'. Catalog schemaPreset must be acyclic.`,
        fieldPath,
        'nesting',
        'Remove the circular object reference.',
      ),
    );
    return;
  }
  ctx.visited.add(schema as object);

  // --- Array: walk each element ---
  if (Array.isArray(schema)) {
    schema.forEach((item, i) => {
      deepWalk(item, `${fieldPath}[${i}]`, depth, ctx);
    });
    return;
  }

  const obj = schema as Record<string, unknown>;

  // --- UiSchema kind check ---
  // Only check `type` for objects that ARE UiSchema nodes: the root
  // schemaPreset itself, or elements inside any `sections[]` array.
  // FieldNode objects (inside `fields[]`) and column_def entries carry
  // their own `type` discriminators (FieldType, not UiSchemaKind) and
  // must NOT be flagged here.
  if (
    typeof obj.type === 'string' &&
    (fieldPath === 'schemaPreset' || /\.sections\[\d+\]$/.test(fieldPath))
  ) {
    if (!VALID_SCHEMA_KINDS.has(obj.type as UiSchemaKind)) {
      ctx.diagnostics.push(
        diag(
          entryId,
          CATALOG_DIAGNOSTIC_CODES.SCHEMA_KIND_INVALID,
          'error',
          `UiSchema kind '${obj.type}' at '${fieldPath}' is not a canonical UiSchemaKind.`,
          fieldPath,
          'nesting',
          'Use one of: form, list, detail, section, grid, custom.',
        ),
      );
    }
  }

  // --- Nesting depth (section/grid recursion) ---
  if (depth > ctx.maxNestingDepth) {
    ctx.diagnostics.push(
      diag(
        entryId,
        CATALOG_DIAGNOSTIC_CODES.NESTING_TOO_DEEP,
        'error',
        `Schema nesting depth ${depth} at '${fieldPath}' exceeds maximum ${ctx.maxNestingDepth}.`,
        fieldPath,
        'nesting',
        `Reduce nesting to at most ${ctx.maxNestingDepth} levels.`,
      ),
    );
    // Continue walking so we catch other issues too, but don't recurse into
    // more sections specifically (already at depth limit).
  }

  // --- Duplicate field names (form/detail) ---
  if (Array.isArray(obj.fields) && (obj.type === 'form' || obj.type === 'detail')) {
    const seen = new Set<string>();
    obj.fields.forEach((field, i) => {
      if (field !== null && typeof field === 'object' && !Array.isArray(field)) {
        const name = (field as Record<string, unknown>).name;
        if (typeof name === 'string') {
          if (seen.has(name)) {
            ctx.diagnostics.push(
              diag(
                entryId,
                CATALOG_DIAGNOSTIC_CODES.DUPLICATE_FIELD_NAME,
                'error',
                `Duplicate field name '${name}' at '${fieldPath}.fields[${i}]'. Field names must be unique within a schema.`,
                `${fieldPath}.fields[${i}].name`,
                'nesting',
                `Rename the duplicate field or remove it.`,
              ),
            );
          } else {
            seen.add(name);
          }
        }
      }
    });
  }

  // --- Data binding: DataSource validation (uses EXISTING kinds only) ---
  validateDataSourceField(obj.source, `${fieldPath}.source`, ctx);
  if (Array.isArray(obj.fields)) {
    obj.fields.forEach((field, i) => {
      if (field !== null && typeof field === 'object' && !Array.isArray(field)) {
        const f = field as Record<string, unknown>;
        const options = f.options;
        // options may be inline array OR a DataSource object
        if (options !== null && typeof options === 'object' && !Array.isArray(options)) {
          validateDataSourceField(options, `${fieldPath}.fields[${i}].options`, ctx);
        }
      }
    });
  }
  // list-level columns_def / data / pageSize are structural, not data binding.

  // --- Expression scan (path-scoped: reactions subtree) ---
  if (fieldPath.startsWith('schemaPreset') && Array.isArray(obj.reactions)) {
    obj.reactions.forEach((reaction, i) => {
      scanForExpressions(reaction, `${fieldPath}.reactions[${i}]`, ctx);
    });
  }

  // --- Action scan (path-scoped: actions array) ---
  if (fieldPath.startsWith('schemaPreset') && Array.isArray(obj.actions)) {
    obj.actions.forEach((action, i) => {
      scanForActionSources(action, `${fieldPath}.actions[${i}]`, ctx);
    });
  }

  // --- Recurse into all object/array properties ---
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      const childPath = `${fieldPath}.${key}`;
      // Sections increase depth.
      const childDepth = key === 'sections' ? depth + 1 : depth;
      deepWalk(child, childPath, childDepth, ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// DataSource structural validation (existing kinds only — amendment #7)
// ---------------------------------------------------------------------------

function validateDataSourceField(
  source: unknown,
  fieldPath: string,
  ctx: WalkContext,
): void {
  if (source === null || source === undefined) return;
  if (typeof source !== 'object' || Array.isArray(source)) return;

  const s = source as Record<string, unknown>;
  const t = s.type;

  if (typeof t !== 'string') {
    // Not a DataSource shape — skip (might be something else).
    return;
  }

  if (!VALID_DATA_SOURCE_TYPES.has(t)) {
    ctx.diagnostics.push(
      diag(
        ctx.entry.id,
        CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_TYPE_UNKNOWN,
        'error',
        `DataSource type '${t}' at '${fieldPath}' is not a known DataSource kind.`,
        fieldPath,
        'data-binding',
        'Use one of: local, fetcher, url, model.',
      ),
    );
    return;
  }

  switch (t) {
    case 'local':
      if (!Array.isArray(s.data)) {
        ctx.diagnostics.push(
          diag(
            ctx.entry.id,
            CATALOG_DIAGNOSTIC_CODES.DATA_BINDING_INVALID,
            'error',
            `local DataSource at '${fieldPath}' requires a 'data' array.`,
            `${fieldPath}.data`,
            'data-binding',
            'Provide a data array.',
          ),
        );
      }
      break;
    case 'fetcher':
      if (typeof s.fetcher !== 'function') {
        ctx.diagnostics.push(
          diag(
            ctx.entry.id,
            CATALOG_DIAGNOSTIC_CODES.DATA_BINDING_INVALID,
            'error',
            `fetcher DataSource at '${fieldPath}' requires a 'fetcher' function.`,
            `${fieldPath}.fetcher`,
            'data-binding',
            'Provide a fetcher function (note: functions make the entry non-serializable).',
          ),
        );
      }
      break;
    case 'url':
      if (typeof s.url !== 'string' || (s.url as string).length === 0) {
        ctx.diagnostics.push(
          diag(
            ctx.entry.id,
            CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_URL_EMPTY,
            'error',
            `url DataSource at '${fieldPath}' requires a non-empty 'url'.`,
            `${fieldPath}.url`,
            'data-binding',
            'Provide a non-empty url string.',
          ),
        );
      }
      break;
    case 'model':
      if (typeof s.name !== 'string' || (s.name as string).length === 0) {
        ctx.diagnostics.push(
          diag(
            ctx.entry.id,
            CATALOG_DIAGNOSTIC_CODES.DATA_SOURCE_MODEL_EMPTY,
            'error',
            `model DataSource at '${fieldPath}' requires a non-empty 'name'.`,
            `${fieldPath}.name`,
            'data-binding',
            'Provide a non-empty model name.',
          ),
        );
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Expression scan (path-scoped — amendment #9)
// ---------------------------------------------------------------------------

function scanForExpressions(
  subtree: unknown,
  fieldPath: string,
  ctx: WalkContext,
): void {
  if (subtree === null || typeof subtree !== 'object') return;

  if (Array.isArray(subtree)) {
    subtree.forEach((item, i) => {
      scanForExpressions(item, `${fieldPath}[${i}]`, ctx);
    });
    return;
  }

  const obj = subtree as Record<string, unknown>;

  // If this node looks like a PortableExpression, validate it via F. If it
  // sits in a semantic expression slot and has a string `kind`, validate it
  // too so F can report unknown node kinds with a precise path.
  if (isPortableExpressionLike(obj) || isExpressionSlotCandidate(obj, fieldPath)) {
    validateOneExpression(obj as unknown as PortableExpression, fieldPath, ctx);
    // Do NOT recurse further into expression internals — F handles that.
    return;
  }

  // Otherwise recurse into object properties (reactions can nest deeply).
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      scanForExpressions(child, `${fieldPath}.${key}`, ctx);
    }
  }
}

function validateOneExpression(
  expr: PortableExpression,
  fieldPath: string,
  ctx: WalkContext,
): void {
  let result;
  try {
    result = validateExpression(expr, ctx.functionRegistry);
  } catch (err) {
    // F's validator should never throw, but guard defensively (amendment #10).
    ctx.diagnostics.push(
      diag(
        ctx.entry.id,
        CATALOG_DIAGNOSTIC_CODES.EXPRESSION_INVALID,
        'error',
        `Expression validator raised an unexpected error at '${fieldPath}': ${errorName(err)}.`,
        fieldPath,
        'expression',
      ),
    );
    return;
  }

  if (!result.valid) {
    for (const e of result.errors as ExpressionError[]) {
      const nodePath = e.nodePath ? `${fieldPath}.${e.nodePath}` : fieldPath;
      ctx.diagnostics.push(
        diag(
          ctx.entry.id,
          CATALOG_DIAGNOSTIC_CODES.EXPRESSION_INVALID,
          'error',
          `Embedded expression error at '${nodePath}': ${e.message} (${e.code}).`,
          nodePath,
          'expression',
          e.suggestions && e.suggestions.length > 0
            ? `Did you mean: ${e.suggestions.join(', ')}?`
            : undefined,
        ),
      );
    }
  }
  // Warnings from F are not surfaced as errors but we skip them to avoid noise.
  // (ExpressionValidationResult.warnings are non-fatal.)
}

// ---------------------------------------------------------------------------
// Action scan (path-scoped — amendment #9)
// ---------------------------------------------------------------------------

function scanForActionSources(
  subtree: unknown,
  fieldPath: string,
  ctx: WalkContext,
): void {
  if (subtree === null || typeof subtree !== 'object') return;

  // If this node looks like an ActionSource, validate it via G.
  if (isActionSourceLike(subtree)) {
    validateOneActionSource(subtree as ActionSource, fieldPath, ctx);
    // Do NOT recurse further — G handles source internals.
    return;
  }

  if (Array.isArray(subtree)) {
    subtree.forEach((item, i) => {
      if (item !== null && typeof item === 'object') {
        scanForActionSources(item, `${fieldPath}[${i}]`, ctx);
      }
    });
    return;
  }

  // Recurse into properties (actions array elements may wrap sources).
  const obj = subtree as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      scanForActionSources(child, `${fieldPath}.${key}`, ctx);
    }
  }
}

function validateOneActionSource(
  source: ActionSource,
  fieldPath: string,
  ctx: WalkContext,
): void {
  let result;
  try {
    result = validateActionSource(source);
  } catch (err) {
    // G's validator should never throw, but guard defensively (amendment #10).
    ctx.diagnostics.push(
      diag(
        ctx.entry.id,
        CATALOG_DIAGNOSTIC_CODES.ACTION_SOURCE_INVALID,
        'error',
        `Action source validator raised an unexpected error at '${fieldPath}': ${errorName(err)}.`,
        fieldPath,
        'action',
      ),
    );
    return;
  }

  if (!result.valid) {
    for (const d of result.diagnostics) {
      const subPath = d.fieldPath ? `${fieldPath}.${d.fieldPath}` : fieldPath;
      ctx.diagnostics.push(
        diag(
          ctx.entry.id,
          CATALOG_DIAGNOSTIC_CODES.ACTION_SOURCE_INVALID,
          'error',
          `Embedded action source error at '${subPath}': ${d.message} (${d.code}).`,
          subPath,
          'action',
        ),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Serializability check (amendment #6 — error Ready, warning Candidate)
// ---------------------------------------------------------------------------

function checkSerializability(
  entry: BlockCatalogEntry,
  value: unknown,
  fieldPath: string,
  ctx: WalkContext,
): void {
  const severity: BlockDiagnosticSeverity =
    entry.readiness === 'ready' ? 'error' : 'warning';
  walkSerializable(value, fieldPath, severity, ctx);
}

function walkSerializable(
  value: unknown,
  fieldPath: string,
  severity: BlockDiagnosticSeverity,
  ctx: WalkContext,
): void {
  if (value === null || value === undefined) return;

  const tv = typeof value;

  if (tv === 'function') {
    ctx.diagnostics.push(
      diag(
        ctx.entry.id,
        CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE,
        severity,
        `Function at '${fieldPath}' is not JSON-serializable. Catalog schema must be portable across web and Flutter.`,
        fieldPath,
        'serializable',
        'Replace the function with a PortableExpression AST (for reactivity) or a named adapter/handler (for actions).',
      ),
    );
    return; // Don't recurse into function internals.
  }

  if (tv === 'symbol') {
    ctx.diagnostics.push(
      diag(
        ctx.entry.id,
        CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE,
        severity,
        `Symbol at '${fieldPath}' is not JSON-serializable.`,
        fieldPath,
        'serializable',
        'Remove the symbol value.',
      ),
    );
    return;
  }

  if (tv !== 'object') return; // primitives are serializable.

  // Cycle guard for serializability walk.
  if (ctx.visited.has(value as object)) return;
  ctx.visited.add(value as object);

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (item === undefined) {
        ctx.diagnostics.push(
          diag(
            ctx.entry.id,
            CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE,
            severity,
            `undefined at '${fieldPath}[${i}]' is not JSON-serializable.`,
            `${fieldPath}[${i}]`,
            'serializable',
            'Remove the undefined element or use null.',
          ),
        );
      } else {
        walkSerializable(item, `${fieldPath}[${i}]`, severity, ctx);
      }
    });
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child === undefined) {
      ctx.diagnostics.push(
        diag(
          ctx.entry.id,
          CATALOG_DIAGNOSTIC_CODES.NON_SERIALIZABLE,
          severity,
          `undefined at '${fieldPath}.${key}' is not JSON-serializable.`,
          `${fieldPath}.${key}`,
          'serializable',
          `Remove the '${key}' property or set it to null.`,
        ),
      );
    } else {
      walkSerializable(child, `${fieldPath}.${key}`, severity, ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal capability gate (amendment #4 — structural only, policy = Agent L)
// ---------------------------------------------------------------------------

import type { RequiredAdapter } from './types.ts';

function extractAdapterKind(a: RequiredAdapter): string | undefined {
  if (typeof a === 'string') return undefined; // bare string, kind unknown
  return a.kind;
}

function hasRequiredAdapter(
  entry: BlockCatalogEntry,
  kind: 'action' | 'permission',
): boolean {
  const adapters = entry.requiredAdapters;
  if (!Array.isArray(adapters) || adapters.length === 0) return false;
  return adapters.some((a) => extractAdapterKind(a) === kind);
}

function validateCapabilityGates(
  entry: BlockCatalogEntry,
  ctx: WalkContext,
): void {
  const capabilities = entry.capabilities as string[];
  if (!Array.isArray(capabilities) || capabilities.length === 0) return;

  // Minimal structural checks only. Policy readiness gates (payment-adapter,
  // offline queue, sanitize, large-data perf) are OWNED BY AGENT L (P4).
  // Here we only verify adapter PRESENCE for capabilities that structurally
  // require a registered adapter.

  const hasActionSource = capabilities.includes('action-source');
  const hasPermissionAware = capabilities.includes('permission-aware');

  if (!hasActionSource && !hasPermissionAware) return;

  // Advisory for Candidate, error for Ready.
  const severity: BlockDiagnosticSeverity =
    entry.readiness === 'ready' ? 'error' : 'warning';

  if (hasActionSource && !hasRequiredAdapter(entry, 'action')) {
    ctx.diagnostics.push(
      diag(
        entry.id,
        CATALOG_DIAGNOSTIC_CODES.CAPABILITY_ADAPTER_MISSING,
        severity,
        `Entry declares capability 'action-source' but requiredAdapters does not include an adapter with kind 'action'.`,
        'requiredAdapters',
        'capability',
        "Add an adapter entry with kind 'action' to requiredAdapters.",
      ),
    );
  }

  if (hasPermissionAware && !hasRequiredAdapter(entry, 'permission')) {
    ctx.diagnostics.push(
      diag(
        entry.id,
        CATALOG_DIAGNOSTIC_CODES.CAPABILITY_ADAPTER_MISSING,
        severity,
        `Entry declares capability 'permission-aware' but requiredAdapters does not include an adapter with kind 'permission'.`,
        'requiredAdapters',
        'capability',
        "Add an adapter entry with kind 'permission' to requiredAdapters.",
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Component reference check (amendment #8 — per-platform probe)
// ---------------------------------------------------------------------------

const COMPONENT_KEY_PATTERN = /^Bc[A-Z][A-Za-z0-9]+$/;

function extractComponentKey(rc: unknown): string | null {
  if (typeof rc === 'string') return rc;
  if (rc !== null && typeof rc === 'object' && !Array.isArray(rc)) {
    const key = (rc as Record<string, unknown>).key;
    if (typeof key === 'string') return key;
  }
  return null;
}

function validateComponentReferences(
  entry: BlockCatalogEntry,
  options: CatalogValidationOptions | undefined,
  ctx: WalkContext,
): void {
  const registry = options?.componentRegistry;

  // componentKey (component-strategy)
  if (typeof entry.componentKey === 'string' && entry.componentKey.length > 0) {
    checkComponentKey(entry.componentKey, 'componentKey', ctx, registry, entry);
  }

  // requiredComponents[]
  if (Array.isArray(entry.requiredComponents)) {
    entry.requiredComponents.forEach((rc, i) => {
      const key = extractComponentKey(rc);
      if (key !== null) {
        checkComponentKey(key, `requiredComponents[${i}]`, ctx, registry, entry);
      }
    });
  }
}

function checkComponentKey(
  key: string,
  fieldPath: string,
  ctx: WalkContext,
  registry: ComponentRegistryProbe | undefined,
  entry: BlockCatalogEntry,
): void {
  // Format check
  if (!COMPONENT_KEY_PATTERN.test(key)) {
    ctx.diagnostics.push(
      diag(
        entry.id,
        CATALOG_DIAGNOSTIC_CODES.COMPONENT_REFERENCE_INVALID,
        'error',
        `Component key '${key}' at '${fieldPath}' does not match the canonical Bc* naming pattern (Bc + uppercase + alphanumerics).`,
        fieldPath,
        'component',
        'Use a canonical key like BcGridView, BcForm, BcButton.',
      ),
    );
    return; // Skip registry probe for malformed keys.
  }

  // Registry probe (if provided)
  if (registry) {
    const platforms: BlockPlatform[] = ['web', 'flutter'];
    for (const platform of platforms) {
      let present: boolean;
      try {
        present = registry.has(key, platform);
      } catch {
        // Registry probe failed — treat as present (don't false-flag).
        // The host is responsible for registry correctness.
        continue;
      }
      if (!present) {
        ctx.diagnostics.push(
          diag(
            entry.id,
            CATALOG_DIAGNOSTIC_CODES.COMPONENT_NOT_REGISTERED,
            'error',
            `Component key '${key}' at '${fieldPath}' is not registered on platform '${platform}'.`,
            fieldPath,
            'component',
            `Register '${key}' on ${platform} or remove it from the entry.`,
          ),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic stable sort (amendment #11 — fieldPath primary)
// ---------------------------------------------------------------------------

function sortDiagnostics(diagnostics: CatalogDiagnostic[]): CatalogDiagnostic[] {
  return diagnostics.slice().sort((a, b) => {
    // Primary: fieldPath (preserves tree traversal evidence)
    const pa = a.fieldPath ?? '';
    const pb = b.fieldPath ?? '';
    if (pa !== pb) return pa < pb ? -1 : 1;
    // Secondary: severity rank (error < warning < info)
    const sa = severityRank(a.severity);
    const sb = severityRank(b.severity);
    if (sa !== sb) return sa - sb;
    // Tertiary: code (stable tiebreaker)
    return (a.code ?? '') < (b.code ?? '') ? -1 : (a.code ?? '') > (b.code ?? '') ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Error naming helper (no leaking of stack traces)
// ---------------------------------------------------------------------------

function errorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  if (typeof err === 'string') return err;
  return 'UnknownError';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deep-validate a Block Catalog entry.
 *
 * Composes P1 shape validation, Agent F expression validation, Agent G
 * action validation, and deep schemaPreset walk (data binding, serializability,
 * nesting, duplicate fields), minimal structural capability gates, and
 * component reference checks.
 *
 * Deterministic: same input always produces the same diagnostic sequence.
 * Never throws: unexpected internal errors map to BLOCK_VALIDATOR_INTERNAL_ERROR.
 *
 * Policy readiness gates (payment, offline queue, sanitize, large-data perf)
 * are NOT run here — those are owned by the P4 catalog validator (Agent L).
 * This function performs only structural, serializability, and minimal
 * adapter-presence checks.
 *
 * Does NOT promote or demote readiness. `ok === true` means zero error
 * diagnostics; it does NOT mean the block is Ready (cross-package gates
 * are enforced separately).
 */
export function validateBlockCatalogEntryDeep(
  entry: BlockCatalogEntry | CandidateCatalogEntry,
  options?: CatalogValidationOptions,
): CatalogValidationResult {
  const diagnostics: CatalogDiagnostic[] = [];
  const maxNestingDepth = options?.maxNestingDepth ?? 32;
  const entryId = entry?.id;

  try {
    // 1. P1 shape validation (the single source of truth for shape checks).
    const p1Result =
      'matrixStatus' in entry || 'decision' in entry
        ? validateCandidateCatalogEntry(entry as CandidateCatalogEntry)
        : validateBlockCatalogEntry(entry as BlockCatalogEntry);
    diagnostics.push(...mapP1Diagnostics(p1Result.diagnostics));

    // If P1 found a readiness error, skip readiness-dependent deep checks.
    const hasReadinessError = diagnostics.some(
      (d) => d.code === 'BLOCK_READINESS_INVALID',
    );

    // 2. Deep schemaPreset walk.
    if (!hasReadinessError && entry.schemaPreset !== undefined) {
      const ctx: WalkContext = {
        entry: entry as BlockCatalogEntry,
        functionRegistry: options?.functionRegistry,
        maxNestingDepth,
        diagnostics,
        visited: new WeakSet<object>(),
      };
      deepWalk(entry.schemaPreset as unknown, 'schemaPreset', 0, ctx);
    }

    // 3. Serializability (separate walk; different severity per readiness).
    if (!hasReadinessError && entry.schemaPreset !== undefined) {
      const ctx: WalkContext = {
        entry: entry as BlockCatalogEntry,
        functionRegistry: options?.functionRegistry,
        maxNestingDepth,
        diagnostics,
        visited: new WeakSet<object>(),
      };
      checkSerializability(
        entry as BlockCatalogEntry,
        entry.schemaPreset as unknown,
        'schemaPreset',
        ctx,
      );
    }

    // 4. Minimal capability gates (action-source / permission-aware adapter presence).
    if (!hasReadinessError) {
      const ctx: WalkContext = {
        entry: entry as BlockCatalogEntry,
        functionRegistry: options?.functionRegistry,
        maxNestingDepth,
        diagnostics,
        visited: new WeakSet<object>(),
      };
      validateCapabilityGates(entry as BlockCatalogEntry, ctx);
    }

    // 5. Component reference checks.
    if (!hasReadinessError) {
      const ctx: WalkContext = {
        entry: entry as BlockCatalogEntry,
        functionRegistry: options?.functionRegistry,
        maxNestingDepth,
        diagnostics,
        visited: new WeakSet<object>(),
      };
      validateComponentReferences(entry as BlockCatalogEntry, options, ctx);
    }
  } catch (err) {
    // Catch-all (amendment #10): the public API must never throw.
    diagnostics.push(
      diag(
        typeof entryId === 'string' ? entryId : undefined,
        CATALOG_DIAGNOSTIC_CODES.VALIDATOR_INTERNAL_ERROR,
        'error',
        `Deep catalog validator encountered an unexpected internal error: ${errorName(err)}.`,
        '',
        'shape',
        'Report this as a validator bug with the entry JSON that triggered it.',
      ),
    );
  }

  const sorted = sortDiagnostics(diagnostics);
  const ok = !sorted.some((d) => d.severity === 'error');
  return { ok, diagnostics: sorted, entryId: typeof entryId === 'string' ? entryId : undefined };
}

/**
 * Validate explicit embedded ActionSources associated with an entry.
 * Useful when actions are attached programmatically rather than inside
 * schemaPreset.actions. Each source is validated via Agent G and mapped to
 * CatalogDiagnostic with path-prefixed fieldPaths.
 *
 * Never throws.
 */
export function validateEmbeddedActionSources(
  entry: BlockCatalogEntry,
  sources: ActionSource[],
  options?: { functionRegistry?: FunctionRegistry },
): CatalogDiagnostic[] {
  const diagnostics: CatalogDiagnostic[] = [];
  if (!Array.isArray(sources)) return diagnostics;
  sources.forEach((source, i) => {
    const fieldPath = `actions[${i}]`;
    if (!isActionSourceLike(source)) {
      diagnostics.push(
        diag(
          entry.id,
          CATALOG_DIAGNOSTIC_CODES.ACTION_SOURCE_INVALID,
          'error',
          `Action source at '${fieldPath}' does not match any known ActionSource shape.`,
          fieldPath,
          'action',
        ),
      );
      return;
    }
    validateOneActionSource(source as ActionSource, fieldPath, {
      entry,
      functionRegistry: options?.functionRegistry,
      maxNestingDepth: 32,
      diagnostics,
      visited: new WeakSet<object>(),
    });
  });
  return sortDiagnostics(diagnostics);
}

/**
 * Ergonomic alias for validateBlockCatalogEntryDeep.
 */
export const validateCatalogEntryDeep = validateBlockCatalogEntryDeep;
