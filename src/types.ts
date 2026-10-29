// ============================================================================
// @bitcode/ui-schema — Core Types
//
// Framework-agnostic, domain-agnostic types shared across all UI renderers
// (React, Vue, React Native, Flutter). Extracted from @bitcode/ui per
// ADR-012 to provide a canonical source for schema-driven UI types.
//
// No framework imports. No platform globals. Safe in Node/SSR/RN/Dart port.
// ============================================================================

// --- Theme ---
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// --- Data Source (4-Layer) ---
export interface FetchParams {
  page?: number;
  pageSize?: number;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters?: Record<string, unknown>;
  search?: string;
  dependValues?: Record<string, unknown>;
  signal?: AbortSignal;
  retry?: number;
}

export interface FetchResult {
  data: unknown[];
  total: number;
  error?: Error;
}

export interface ModelAdapter {
  list(model: string, params: FetchParams): Promise<FetchResult>;
  search(model: string, query: string): Promise<unknown[]>;
  isOffline(model: string): boolean;
}

export type DataSource =
  | { type: 'local'; data: unknown[] }
  | { type: 'fetcher'; fetcher: (params: FetchParams) => Promise<FetchResult> }
  | { type: 'url'; url: string; headers?: Record<string, string> }
  | { type: 'model'; name: string; adapter?: ModelAdapter };

// --- Events ---
export type BcEventSource = 'keyboard' | 'pointer' | 'touch' | 'programmatic' | 'form' | 'api';

export interface BcChangeMeta<TReason extends string = string> {
  reason: TReason;
  source: BcEventSource;
  nativeEvent?: unknown;
}

export type BcChangeHandler<TValue, TReason extends string = string> = (
  value: TValue,
  meta: BcChangeMeta<TReason>,
) => void;

export interface BcEventBase {
  name: string;
  timestamp: number;
}

export interface FieldChangeEvent extends BcEventBase {
  value: unknown;
  oldValue: unknown;
}

export interface FieldFocusEvent extends BcEventBase {
  value: unknown;
}

export interface FieldBlurEvent extends BcEventBase {
  value: unknown;
  dirty: boolean;
  touched: boolean;
}

export interface FieldClearEvent extends BcEventBase {
  oldValue: unknown;
}

export interface FieldInputEvent extends BcEventBase {
  value: unknown;
}

export interface FieldKeyEvent extends BcEventBase {
  value: unknown;
  key: string;
}

export interface FieldValidateEvent extends BcEventBase {
  value: unknown;
  valid: boolean;
  message: string;
}

// --- Collection ---
export type BcKey = string | number;
export type BcSelection = 'all' | Set<BcKey> | BcKey[];

// --- Component Sizes ---
export type ComponentSize = 'sm' | 'md' | 'lg';
export type ComponentVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

// --- Input Types ---
export type InputType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'number' | 'date' | 'time' | 'datetime-local' | 'color' | 'file' | 'hidden';
export type InputSize = 'sm' | 'md' | 'lg';
export type ValidationStatus = 'none' | 'validating' | 'valid' | 'invalid';
