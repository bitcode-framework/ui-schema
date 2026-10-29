// ============================================================================
// @bitcode/ui-schema — Built-in Function Manifest (ADR-018 S6)
//
// Static manifest of built-in portable expression functions. Every entry MUST
// exist on every required platform (web + flutter minimum). Host functions are
// registered separately at runtime via FunctionRegistry.register().
//
// This manifest is the single source of truth for "which built-ins exist".
// Implementations live in @bitcode/ui (TS) and packages/ui-flutter (Dart);
// both import this manifest to drive parity checks.
//
// Pure data. No implementations.
// ============================================================================

import type { FunctionManifestEntry } from './function-registry.ts';
import type { BlockPlatform } from '../block-catalog/types.ts';

/**
 * Canonical built-in function manifest. Order is stable (namespace-grouped)
 * so golden fixtures and parity tests can reference entries by index if needed.
 *
 * Rules enforced by validateFunctionManifest():
 *  - every entry has `pure: true` (expressions are pure by contract)
 *  - every entry declares `platforms` containing at least ['web','flutter']
 *  - date.* declare `timezone` behavior (ADR-018 S6)
 *  - format.* declare `locale` behavior with explicit-arg + invariant fallback
 *  - `now` is the ONLY non-deterministic entry
 */
export const BUILTIN_FUNCTION_MANIFEST: readonly FunctionManifestEntry[] = [
  // --- math.* (pure, deterministic) ---
  fn('math.abs', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),
  fn('math.ceil', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),
  fn('math.floor', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),
  fn('math.round', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),
  fn('math.min', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('math.max', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('math.pow', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,number', outputSchema: 'number' }),
  fn('math.sqrt', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),
  fn('math.mod', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,number', outputSchema: 'number' }),
  fn('math.clamp', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,number,number', outputSchema: 'number' }),
  fn('math.sign', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'number' }),

  // --- string.* (pure, deterministic) ---
  fn('string.concat', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string[]', outputSchema: 'string' }),
  fn('string.upper', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'string' }),
  fn('string.lower', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'string' }),
  fn('string.trim', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'string' }),
  fn('string.split', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string[]' }),
  fn('string.contains', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'boolean' }),
  fn('string.startsWith', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'boolean' }),
  fn('string.endsWith', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'boolean' }),
  fn('string.substring', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,number,number', outputSchema: 'string' }),
  fn('string.replace', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string', outputSchema: 'string' }),
  fn('string.padLeft', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,number,string', outputSchema: 'string' }),
  fn('string.padRight', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,number,string', outputSchema: 'string' }),
  fn('string.slugify', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'string' }),
  fn('string.length', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'number' }),

  // --- array.* (pure, deterministic; higher-order fns accept AST lambdas via args.fn) ---
  fn('array.sum', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('array.count', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array', outputSchema: 'number' }),
  fn('array.min', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('array.max', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('array.avg', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number[]', outputSchema: 'number' }),
  fn('array.includes', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,any', outputSchema: 'boolean' }),
  fn('array.find', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,fn', outputSchema: 'any' }),
  fn('array.filter', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,fn', outputSchema: 'array' }),
  fn('array.map', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,fn', outputSchema: 'array' }),
  fn('array.reduce', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,fn,any', outputSchema: 'any' }),
  fn('array.sort', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,fn?', outputSchema: 'array' }),
  fn('array.slice', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array,number,number', outputSchema: 'array' }),
  fn('array.compact', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array', outputSchema: 'array' }),
  fn('array.length', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'array', outputSchema: 'number' }),
  fn('array.from', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'any...', outputSchema: 'array' }),

  // --- date.* (timezone: explicit-arg; now is the only non-deterministic entry) ---
  fn('date.now', ['web', 'flutter', 'react-native', 'server'], false, { inputSchema: 'none', outputSchema: 'string', timezone: 'utc' }),
  fn('date.parse', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.format', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string', outputSchema: 'string', timezone: 'explicit-arg', locale: 'explicit-arg' }),
  fn('date.addDuration', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,number,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.diff', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string,string', outputSchema: 'number', timezone: 'explicit-arg' }),
  fn('date.startOfDay', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.endOfDay', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.startOfMonth', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.endOfMonth', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.isWeekend', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'boolean', timezone: 'explicit-arg' }),
  fn('date.isBefore', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string', outputSchema: 'boolean', timezone: 'explicit-arg' }),
  fn('date.isAfter', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string', outputSchema: 'boolean', timezone: 'explicit-arg' }),
  fn('date.daysInMonth', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,string', outputSchema: 'number', timezone: 'explicit-arg' }),
  fn('date.isLeapYear', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'boolean' }),
  fn('date.toISO', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'string', timezone: 'explicit-arg' }),
  fn('date.fromISO', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'string' }),
  fn('date.toUnix', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string', outputSchema: 'number', timezone: 'explicit-arg' }),
  fn('date.fromUnix', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,string', outputSchema: 'string', timezone: 'explicit-arg' }),

  // --- format.* (locale: explicit-arg with invariant fallback) ---
  fn('format.number', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,string', outputSchema: 'string', locale: 'explicit-arg' }),
  fn('format.bytes', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number', outputSchema: 'string', locale: 'invariant' }),
  fn('format.percent', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'number,string', outputSchema: 'string', locale: 'explicit-arg' }),
  fn('format.date', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string,string,string', outputSchema: 'string', locale: 'explicit-arg', timezone: 'explicit-arg' }),

  // --- validate.* (pure, deterministic) ---
  fn('validate.isEmail', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isURL', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isUUID', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isIP', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isNumeric', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isAlpha', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isAlphaNum', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
  fn('validate.isHexColor', ['web', 'flutter', 'react-native', 'server'], true, { inputSchema: 'string', outputSchema: 'boolean' }),
];

/** Set of all built-in function names (fast lookup). */
export const BUILTIN_FUNCTION_NAMES: ReadonlySet<string> = new Set(
  BUILTIN_FUNCTION_MANIFEST.map((e) => e.name),
);

/** True if `name` is a declared built-in function. */
export function isBuiltinFunction(name: string): boolean {
  return BUILTIN_FUNCTION_NAMES.has(name);
}

/** Lookup a built-in manifest entry by name. */
export function getBuiltinManifestEntry(name: string): FunctionManifestEntry | undefined {
  return BUILTIN_FUNCTION_MANIFEST.find((e) => e.name === name);
}

// ---------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------
function fn(
  name: string,
  platforms: BlockPlatform[],
  deterministic: boolean,
  extra: Partial<Omit<FunctionManifestEntry, 'name' | 'version' | 'platforms' | 'pure' | 'deterministic'>>,
): FunctionManifestEntry {
  return {
    name,
    version: '1.0.0',
    platforms,
    pure: true,
    deterministic,
    fallback: 'error',
    ...extra,
  };
}
