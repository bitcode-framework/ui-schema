// ============================================================================
// @bitcode/ui-schema — Built-in Function Registry (ADR-018 S6)
//
// Versioned manifest of pure built-in functions callable from Portable
// Expression `call` nodes. The registry is a manifest+resolver pair:
//   - Manifest entries describe name, version, platforms, purity,
//     determinism, fallback, timezone, and locale behavior (ADR-018 S6).
//   - Resolver maps a name to a platform implementation. TS impls live in
//     @bitcode/ui; Dart impls live in packages/ui-flutter. The shared
//     contract here is manifest-only — implementations are injected.
//
// Ready universal entries may depend only on built-ins that exist on all
// required platforms. Host/project functions require explicit registration
// and a manifest. Missing required functions fail loudly.
// ============================================================================

import type { BlockPlatform } from '../block-catalog/types.ts';

/**
 * Manifest entry for a built-in or host function (ADR-018 S6).
 *
 * `pure: true` is a contract: the function has no side effects and reads
 * only its arguments. Non-pure functions are adapters, NOT expression
 * functions, and MUST NOT be registered here.
 */
export interface FunctionManifestEntry {
  /** Namespaced name, e.g. `string.concat`, `math.round`. */
  name: string;
  /** Semver version of this function contract. */
  version: string;
  /** Platforms on which an implementation exists. */
  platforms: BlockPlatform[];
  /** Expressions are pure by contract (ADR-018 S6). Always `true`. */
  pure: true;
  /**
   * Whether output is fully determined by inputs. `false` for `date.now`
   * (and any host function reading ambient state). Non-deterministic
   * functions are allowed but flagged so builders/cache layers can react.
   */
  deterministic: boolean;
  /** Optional JSON schema describing accepted argument shapes. */
  inputSchema?: unknown;
  /** Optional JSON schema describing the return shape. */
  outputSchema?: unknown;
  /**
   * Fallback behavior when the function is unavailable on the current
   * platform (ADR-018 S6). `error` is the default/fail-loud policy.
   */
  fallback?: 'error' | 'literal' | 'empty' | 'host';
  /** Declared timezone behavior for `date.*` functions. */
  timezone?: 'utc' | 'local' | 'explicit-arg';
  /** Declared locale behavior for `format.*` functions. */
  locale?: 'explicit-arg' | 'runtime' | 'invariant';
  /** Minimum and maximum argument count (arity bounds). */
  arity?: { min: number; max: number };
}

/**
 * Diagnostic from manifest validation (ADR-018 S6 acceptance criteria).
 */
export interface FunctionRegistryDiagnostic {
  code:
    | 'FN_MISSING'
    | 'FN_PLATFORM_GAP'
    | 'FN_VERSION_MISMATCH'
    | 'FN_NOT_PURE'
    | 'FN_ARITY_INVALID';
  name: string;
  message: string;
  /** Platforms missing an implementation (for FN_PLATFORM_GAP). */
  platforms?: BlockPlatform[];
}

/**
 * A function resolver: maps a name to a pure implementation. The
 * implementation type is intentionally permissive (`(args: unknown[]) =>
 * unknown`) — type checking happens at the manifest/evaluator boundary via
 * `inputSchema`/arity, not at the TS type level (which would not be portable
 * to Dart). Implementations MUST be pure.
 */
export type FunctionImpl = (args: unknown[]) => unknown;

/**
 * Registry of manifest entries plus optional platform resolvers. Resolvers
 * are injected by the host (TS in @bitcode/ui, Dart in ui-flutter); the
 * shared contract here is manifest-only.
 */
export interface FunctionRegistry {
  /** Whether a function name is registered (manifest present). */
  has(name: string): boolean;
  /** Manifest entry for a name, or undefined. */
  get(name: string): FunctionManifestEntry | undefined;
  /** Pure implementation for a name on the current platform, or undefined. */
  resolve(name: string): FunctionImpl | undefined;
  /** Register a manifest entry (and optionally an implementation). */
  register(entry: FunctionManifestEntry, impl?: FunctionImpl): void;
  /** All registered manifest entries (for diagnostics/suggestion engine). */
  entries(): FunctionManifestEntry[];
  /**
   * Validate that every required function exists and is implemented on every
   * required platform. Returns diagnostics (empty = valid). ADR-018 S6.
   */
  validateRequired(
    required: string[],
    platforms: BlockPlatform[],
  ): FunctionRegistryDiagnostic[];
}
