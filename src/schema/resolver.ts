// ============================================================================
// @bitcode/ui-schema — Renderer field resolver (ADR-005 §2 FieldResolver).
//
// Maps a `FieldNode` to the BcForm-compatible `FormFieldDef` so the renderer
// can hand a single `fields[]` array to BcForm and reuse all of its
// validation + reactive plumbing.
//
// Headless: no rendering. Pure functions.
//
// Extracted from @bitcode/ui per ADR-012.
// ============================================================================

import type { FieldNode, FieldType } from './types.ts';

/**
 * BcForm-compatible shape (mirrors `FormFieldDef` in BcForm.lite.tsx). We
 * cannot import that type directly because the renderer must also work
 * without BcForm in places (e.g. consumer who supplies their own form host).
 */
export interface ResolvedFormField {
  name: string;
  label?: string;
  /** Native input type, or `'textarea'` / `'select'`. */
  type: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  pattern?: string;
}

/**
 * Convert a schema `FieldType` to a BcForm `type` string. Most types map
 * directly; a few (toggle, checkbox, password, email, url, tel) reuse the
 * native HTML input type so BcForm renders the right `<input>`.
 */
export function resolveFieldType(type: FieldType | undefined): string {
  switch (type) {
    case 'textarea':
      return 'textarea';
    case 'select':
      return 'select';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'email':
      return 'email';
    case 'password':
      return 'password';
    case 'url':
      return 'url';
    case 'tel':
      return 'tel';
    case 'toggle':
    case 'checkbox':
      return 'checkbox';
    case 'input':
    default:
      return 'text';
  }
}

/**
 * Convert a `FieldNode` into a BcForm field def. Inline option lists pass
 * through unchanged; `DataSource` options are dropped here because BcForm
 * Phase 0 does not yet take live data sources for choice fields. Consumers
 * needing live options should preprocess the schema.
 */
export function resolveField(node: FieldNode): ResolvedFormField {
  const out: ResolvedFormField = {
    name: node.name,
    label: node.label,
    type: resolveFieldType(node.type),
    placeholder: node.placeholder,
    required: node.required,
    disabled: node.disabled,
    hint: node.hint,
    min: node.min,
    max: node.max,
    pattern: node.pattern,
  };
  if (Array.isArray(node.options)) out.options = node.options;
  return out;
}

/**
 * Convenience: resolve every field in a list. Pure; returns a fresh array
 * so the input schema stays unmutated.
 */
export function resolveFields(fields: ReadonlyArray<FieldNode> | undefined): ResolvedFormField[] {
  return (fields ?? []).map(resolveField);
}

/**
 * Pluggable resolver hook. Hosts that need custom field types (lookup,
 * file-upload, signature-pad, ...) can pre-process the schema by mapping
 * unknown `node.type` values to a known `FieldType` before handing the
 * schema to `BcRenderer`. The renderer itself does not perform runtime
 * dispatch — keeping it Mitosis-friendly (no dynamic component refs).
 *
 * Example consumer pattern:
 *
 *   const transformed: UiSchema = {
 *     ...schema,
 *     fields: schema.fields?.map((f) =>
 *       f.type === 'lookup' ? { ...f, type: 'select', options: lookup(f) } : f
 *     ),
 *   };
 *   <BcRenderer schema={transformed} ... />
 */
export type FieldResolver = (node: FieldNode) => ResolvedFormField;

/** The default resolver is a thin wrapper around `resolveField`. */
export const defaultFieldResolver: FieldResolver = resolveField;
