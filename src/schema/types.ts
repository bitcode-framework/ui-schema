// ============================================================================
// @bitcode/ui-schema — Renderer schema types (ADR-005).
//
// Domain-agnostic UI schema. Hosts (BitCode, custom apps, JsonForms-style
// stand-alone) emit a `UiSchema` document; a renderer translates it into a
// tree of UI components wired to a `ReactiveStore` (ADR-004).
//
// Headless: pure types, no rendering logic, no framework imports.
//
// Extracted from @bitcode/ui per ADR-012.
// ============================================================================

import type { Reaction, ValidationRule } from '../reactive/types.ts';
import type { DataSource } from '../types.ts';

/**
 * Top-level schema kinds. Each maps to a UI component or a
 * grouping wrapper:
 *
 *   - `'form'`    -> `<BcForm>` with fields + actions.
 *   - `'list'`    -> `<BcDataTable>` (or `<BcList>` when `mode === 'list'`).
 *   - `'detail'`  -> `<BcForm disabled hideSubmit>` (read-only fields).
 *   - `'section'` -> grouping wrapper with `title` / `description`; children
 *                    in `sections[]` are nested schemas (recursive render).
 *   - `'grid'`    -> grouping wrapper that lays out its `sections[]` in a
 *                    multi-column CSS grid (`columns`).
 *   - `'custom'`  -> consumer-controlled escape hatch; the renderer emits a
 *                    `<div data-bc-renderer-custom={name}>` sentinel that
 *                    consumers replace via DOM portal or by pre-processing
 *                    the schema into known node types.
 *   - `'wizard'`  -> multi-step form (ADR-005 §1). Each step carries its own
 *                    `UiSchema` form fragment in `steps[]`. The renderer
 *                    composes `<BcWizard>` + `<BcRenderer>` per step, with
 *                    per-step validation (client, server, or both) and a
 *                    finish callback/action.
 */
export type UiSchemaKind = 'form' | 'list' | 'detail' | 'section' | 'grid' | 'custom' | 'wizard';

/**
 * Validation mode for a wizard step (ADR-005 + ADR-004).
 *
 * - `'client'` — validate using ReactiveStore's ValidationRule set (ADR-004
 *   VALIDATION effect). No network round-trip. Default.
 * - `'server'` — delegate validation to a server endpoint. The endpoint URL
 *   is provided by `WizardStepSchema.validationEndpoint` or
 *   `WizardStepSchema.validationAction`. The wizard blocks advance until the
 *   server returns `ok: true`.
 * - `'both'` — run client-side rules first; if they pass, send to server.
 *   Combines instant feedback with authoritative server validation.
 */
export type WizardValidationMode = 'client' | 'server' | 'both';

/**
 * A single step in a wizard schema (ADR-005 `kind: 'wizard'`).
 *
 * Each step carries its own form fragment (`schema?: UiSchema`) rendered by
 * BcRenderer. The wizard validates the step before allowing advance, using
 * `validationMode` to determine client/server/both. The `icon` field allows
 * per-step iconography (ADR-007 contract surface).
 *
 * When `schema` is omitted the step renders via the wizard's default slot —
 * this preserves backward compatibility with the slot-based BcWizard API.
 */
export interface WizardStepSchema {
  title: string;
  description?: string;
  /** Icon name/identifier per ADR-007 icon convention. */
  icon?: string;
  /** Form fragment for this step. Rendered by BcRenderer (ADR-005 §2). */
  schema?: UiSchema;
  /** Validation strategy before allowing advance. Default: `'client'`. */
  validationMode?: WizardValidationMode;
  /** Server endpoint for server/both validation. Generic contract: `{ step, values } → { ok, errors }`. */
  validationEndpoint?: string;
  /** Declarative validation action (ADR-018 ActionSource). Takes precedence over `validationEndpoint` when set. */
  validationAction?: import('../actions/source.ts').ActionSource;
  /** Allow skipping this step without validation (mirrors Filament `->skippable()`). */
  skippable?: boolean;
  /** Blocks moving past this step (existing BcWizard field, preserved). */
  blocking?: boolean;
}

/**
 * Field type discriminator. Maps 1:1 onto components in the default
 * resolver; non-default types pass through to the consumer's `resolver`
 * via the `'custom'` schema kind.
 *
 * Keep this list short. Component-specific knobs live on the field node
 * itself (see `FieldNode.options`, `FieldNode.placeholder`, etc.) rather
 * than expanding the type discriminator.
 */
export type FieldType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'toggle'
  | 'checkbox'
  | 'email'
  | 'password'
  | 'url'
  | 'tel';

/**
 * A single field in a form/detail schema. Fields are flat (no children) —
 * group via `section` schemas instead. Layout overrides come from
 * the parent schema's `layout` setting.
 */
export interface FieldNode {
  /** Field name. Must be unique within the schema. Required. */
  name: string;
  /** Optional label rendered above (vertical) or beside (horizontal). */
  label?: string;
  /** Component discriminator. Defaults to `'input'`. */
  type?: FieldType;
  /** Placeholder string forwarded to the underlying input. */
  placeholder?: string;
  /** Required marker; also added to validation rules at submit time. */
  required?: boolean;
  /** Disabled when true; honored by every field renderer. */
  disabled?: boolean;
  /** Inline hint shown below the field. */
  hint?: string;

  // Choice fields
  /**
   * Options for `'select'` fields. Either an inline list or a `DataSource`
   * (ADR-002 4-layer source). When a DataSource is supplied the renderer
   * delegates fetching to the underlying component.
   */
  options?: Array<{ value: string; label: string }> | DataSource;

  // Numeric / length / pattern bounds
  /** `number` min, or string min-length depending on `type`. */
  min?: number;
  /** `number` max, or string max-length depending on `type`. */
  max?: number;
  /** Regex source string for `pattern` validation. */
  pattern?: string;

  /** Validation rules (additional to required/min/max/pattern). */
  validation?: ValidationRule[];
}

/**
 * A button or action link rendered by `'form'` / `'detail'` schemas. The
 * default `'submit'` action wires to BcForm's submit; named actions emit
 * `BcRendererProps.onAction(name, values)`.
 */
export interface UiAction {
  /** Stable id, echoed in `onAction(name, values)`. */
  name: string;
  /** Label shown on the button. Defaults to a humanised `name`. */
  label?: string;
  /** Visual variant. Defaults to `'primary'` for `'submit'`. */
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  /** When true the submit handler is invoked (form schemas only). */
  submit?: boolean;
  /** Disabled flag. */
  disabled?: boolean;
}

/**
 * The schema document itself. A schema is either a "leaf" (form/list/
 * detail/custom) or a "grouping" (section/grid) that holds nested schemas.
 *
 * The renderer flattens nothing: nested sections become nested DOM. This
 * is the simplest model that still supports ERP-style multi-section forms
 * with one schema file per entity.
 */
export interface UiSchema {
  /** Schema kind discriminator. Required. */
  type: UiSchemaKind;

  /** Stable id, useful for debugging and DOM targeting (`data-bc-schema`). */
  name?: string;

  /** Title shown above sections / forms. */
  title?: string;
  /** Description shown under the title. */
  description?: string;

  // Form / detail
  /**
   * Fields rendered inside a `'form'` / `'detail'` schema. Ignored for
   * grouping (`'section'` / `'grid'`) and `'list'` schemas.
   */
  fields?: FieldNode[];

  // Form layout
  /**
   * Layout mode forwarded to BcForm. `'vertical'` (default) stacks label +
   * field; `'horizontal'` puts the label beside the field.
   */
  layout?: 'vertical' | 'horizontal';

  // Grouping (section / grid)
  /** Nested schemas. Used by `'section'` and `'grid'` kinds. */
  sections?: UiSchema[];
  /**
   * Number of columns for `'grid'` kind. Ignored otherwise. Defaults to 2.
   */
  columns?: number;

  // List
  /**
   * Columns for `'list'` schemas. Forwarded to `BcDataTable`'s `columns`.
   */
  columns_def?: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }>;
  /** Inline data source for `'list'` schemas. */
  data?: unknown[];
  /** External data source for `'list'` schemas (4-layer per ADR-002). */
  source?: DataSource;
  /** Page size for `'list'` schemas. */
  pageSize?: number;

  // Reactivity (ADR-004)
  /**
   * Reactions wired into a `ReactiveStore` that wraps the rendered subtree.
   * BcRenderer creates a single store per top-level schema; nested schemas
   * share that store so cascading reactions fire across sections.
   */
  reactions?: Reaction[];

  // Form actions
  /**
   * Buttons rendered below the fields of a `'form'` / `'detail'` schema.
   * Defaults to `[{ name: 'submit', label: 'Submit', submit: true }]` when
   * the host doesn't override.
   */
  actions?: UiAction[];

  // Wizard (ADR-005 kind: 'wizard')
  /**
   * Ordered steps for `'wizard'` schemas. Each step carries its own form
   * fragment (`schema: UiSchema`) plus validation mode. The renderer
   * composes one `BcRenderer` per active step, keeping a single
   * `ReactiveStore` across all steps so cross-step reactions fire.
   */
  steps?: WizardStepSchema[];

  // Custom escape hatch
  /**
   * For `'custom'` schemas, the renderer emits a sentinel `<div>` carrying
   * `data-bc-renderer-custom={name}` plus this property as a JSON payload
   * via `data-payload`. Consumers replace it (DOM portal / pre-processing).
   */
  payload?: unknown;
}

/**
 * Top-level renderer props. Mirrors `BcForm` so the simplest schema
 * (`type: 'form'`) drops in next to existing forms with zero extra wiring.
 */
export interface BcRendererProps {
  /** The schema document. Required. */
  schema?: UiSchema;
  /** Initial values for `'form'` / `'detail'` field nodes. */
  values?: Record<string, unknown>;
  /** Disable every field + action. Useful for read-only previews. */
  disabled?: boolean;
  /** Fired whenever any field value changes (form mode). */
  onChange?: (values: Record<string, unknown>) => void;
  /** Fired when a `submit: true` action runs and validation passes. */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Fired when any non-submit action button is clicked. */
  onAction?: (name: string, values: Record<string, unknown>) => void;
}
