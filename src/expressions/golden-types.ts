// ============================================================================
// @bitcode/ui-schema — Golden Fixture Types (ADR-018 S5, plan S5.3)
//
// Shared, language-neutral fixture shape consumed by BOTH the TypeScript
// evaluator tests (@bitcode/ui) and the Dart evaluator tests
// (packages/ui-flutter). Single source of truth lives in
// packages/ui-schema/test/fixtures/expressions/*.json; both platforms read
// the same bytes and assert byte-identical evaluation outcomes (parity is
// enforced, not aspirational).
//
// Pure types only.
// ============================================================================

import type { PortableExpression } from './ast.ts';
import type { ExpressionScope, PermissionSnapshot } from './scope.ts';

/**
 * Category of a golden fixture. Used to group cases and to map a case to its
 * source file (one category per file).
 */
export type GoldenFixtureCategory =
  | 'comparison'
  | 'path'
  | 'null'
  | 'aggregation'
  | 'string-list'
  | 'date'
  | 'function'
  | 'error'
  | 'permission';

/**
 * Expected outcome of a golden case.
 *
 * - `value`    — evaluation succeeds and equals `value`.
 * - `error`    — evaluation fails with the given code (and, optionally, a
 *                path regex matched against the error's `nodePath` or `path`).
 * - `denied`   — evaluation is rejected by the permission filter before it
 *                reaches the evaluator (the field/service is unauthorized).
 */
export type GoldenExpect =
  | { kind: 'value'; value: unknown }
  | { kind: 'error'; code: string; pathPattern?: string }
  | { kind: 'denied'; reason: 'unauthorized-field' | 'unauthorized-service' };

/**
 * A single golden test case. The `id` is stable and referenced by both TS and
 * Dart test runners, so renaming an id breaks parity CI loudly.
 */
export interface GoldenCase {
  id: string;
  /** Human description (not asserted). */
  description?: string;
  /** The AST to evaluate. */
  expr: PortableExpression;
  /** Input scope (pre-permission-filter for permission cases). */
  scope: ExpressionScope;
  /** Expected outcome. */
  expect: GoldenExpect;
  /** Permission snapshot for permission cases (otherwise optional). */
  permissions?: PermissionSnapshot;
  /** Freeform notes (not asserted). */
  notes?: string;
}

/**
 * A golden fixture file. One per category. The `category` must match the
 * file's category for traceability.
 */
export interface GoldenFixture {
  name: string;
  description?: string;
  category: GoldenFixtureCategory;
  cases: GoldenCase[];
}
