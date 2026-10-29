// ============================================================================
// @bitcode/ui-schema - Portable Expression Serialization (ADR-018 S5)
//
// Versioned JSON serialization and deserialization for PortableExpression.
// Deserialization runs the static validator (validate.ts) so untrusted JSON
// is rejected (unknown kinds, unknown operators/functions, unsafe constructs,
// malformed paths, invalid literals, depth) before any AST is trusted.
//
// Canonical wire/on-disk form: the versioned envelope { schemaVersion, expr }.
// Bare nodes are accepted on input for ergonomics; output is always an envelope.
// ============================================================================

import {
  PORTABLE_EXPRESSION_SCHEMA_VERSION,
  type PortableExpression,
  type PortableExpressionEnvelope,
} from "./ast.ts";
import { PORTABLE_OPERATORS } from "./operators.ts";
import { BUILTIN_FUNCTION_MANIFEST } from "./builtin-manifest.ts";
import type { FunctionRegistry } from "./function-registry.ts";
import type { ExpressionError } from "./errors.ts";
import { validateExpression } from "./validate.ts";

/**
 * Result of deserializing an expression from JSON. Either a validated AST or
 * a list of typed errors. Never throws on bad shape and instead returns
 * errors so callers (builders, catalog validators) can surface diagnostics.
 */
export interface DeserializeResult {
  ok: boolean;
  /** The validated AST, present only when ok === true. */
  expr?: PortableExpression;
  /** The detected schema version (envelope.schemaVersion, or 1 for bare). */
  schemaVersion?: number;
  /** Typed errors (shape, kind, operator, function, path). Empty when ok. */
  errors: ExpressionError[];
}

/**
 * Serialize a PortableExpression to its canonical versioned envelope JSON.
 * The input is NOT re-validated here and assumed already trusted. Use
 * `deserializeExpression` for untrusted input.
 *
 * Output is a plain object suitable for `JSON.stringify`.
 */
export function serializeExpression(expr: PortableExpression): PortableExpressionEnvelope {
  return {
    schemaVersion: PORTABLE_EXPRESSION_SCHEMA_VERSION,
    expr,
  };
}

/** Alias mirroring the envelope factory. */
export function serializeExpressionEnvelope(expr: PortableExpression): PortableExpressionEnvelope {
  return serializeExpression(expr);
}

/**
 * Deserialize and validate a PortableExpression from untrusted JSON input.
 *
 * Accepts either:
 *   - a versioned envelope `{ schemaVersion, expr }`, or
 *   - a bare expression node object.
 *
 * Performs:
 *   1. Shape normalization (plain object, valid envelope).
 *   2. Schema version check (rejects future/unknown versions).
 *   3. Deep validation (unknown kinds, unknown operators, unknown functions,
 *      unsafe constructs, path grammar, literal scalars).
 *
 * Optional `functionRegistry` enables host-function validation: built-ins are
 * always checked against the static manifest when no registry is provided; if
 * a registry is provided it is used as the function source of truth.
 *
 * Never throws. Returns `ok: false` with typed errors on any problem.
 */
export function deserializeExpression(
  input: unknown,
  functionRegistry?: FunctionRegistry,
): DeserializeResult {
  const errors: ExpressionError[] = [];

  // 1. Envelope normalization.
  let schemaVersion: number;
  let expr: unknown;

  if (!isPlainObject(input)) {
    errors.push({
      code: "EXPR_NODE_INVALID",
      message: "Expression input must be a plain object.",
    });
    return { ok: false, errors };
  }

  const env = input as Record<string, unknown>;
  if (typeof env.schemaVersion === "number" && env.expr !== undefined) {
    schemaVersion = env.schemaVersion;
    expr = env.expr;
  } else {
    // Bare node: treat as schemaVersion 1 (the only version today).
    schemaVersion = PORTABLE_EXPRESSION_SCHEMA_VERSION;
    expr = env;
  }

  // 2. Schema version check.
  if (schemaVersion !== PORTABLE_EXPRESSION_SCHEMA_VERSION) {
    errors.push({
      code: "EXPR_NODE_INVALID",
      message: `Unsupported expression schemaVersion ${schemaVersion}. Supported: ${PORTABLE_EXPRESSION_SCHEMA_VERSION}.`,
    });
    return { ok: false, errors };
  }

  // 3. Deep validation.
  const result = validateExpression(expr as PortableExpression, functionRegistry);
  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, expr: expr as PortableExpression, schemaVersion, errors: [] };
}

/** Alias accepting the envelope-typed input. */
export function deserializeExpressionEnvelope(
  input: unknown,
  functionRegistry?: FunctionRegistry,
): DeserializeResult {
  return deserializeExpression(input, functionRegistry);
}

/**
 * Round-trip helper: serialize then deserialize. Useful in tests to prove
 * the canonical envelope survives a round trip. Throws if round-trip fails
 * (test-only convenience).
 */
export function roundTripExpression(expr: PortableExpression): PortableExpression {
  const json = serializeExpression(expr);
  const result = deserializeExpression(json);
  if (!result.ok || !result.expr) {
    throw new Error(
      `roundTripExpression failed: ${result.errors.map((e) => e.code).join(", ")}`,
    );
  }
  return result.expr;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reference export so callers/tests can introspect the canonical operator and
 * built-in function sets without reaching into multiple modules.
 */
export const SERIALIZATION_REFERENCES = {
  schemaVersion: PORTABLE_EXPRESSION_SCHEMA_VERSION,
  operators: PORTABLE_OPERATORS,
  builtinFunctions: BUILTIN_FUNCTION_MANIFEST.map((e) => e.name),
} as const;
