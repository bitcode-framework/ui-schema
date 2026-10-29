// ============================================================================
// @bitcode/ui-schema - Portable Expression AST barrel (ADR-018 S5)
//
// Re-exports the full portable expression surface: AST, operators, scope,
// permission-filtered scope, errors, evaluator interface, function registry,
// built-in manifest, golden fixture types, validator, and serializer.
//
// Pure types + pure functions. No runtime evaluator here (that lives in
// @bitcode/ui TS and packages/ui-flutter Dart). No platform globals.
// ============================================================================

// AST + node kinds
export type {
  CallNode,
  IfNode,
  LiteralNode,
  OpNode,
  PathNode,
  PortableExpression,
  PortableExpressionEnvelope,
} from './ast.ts';
export {
  EXPRESSION_NODE_KINDS,
  PORTABLE_EXPRESSION_SCHEMA_VERSION,
  isCallNode,
  isIfNode,
  isLiteralNode,
  isOpNode,
  isPathNode,
} from './ast.ts';

// Operators
export type {
  OperandType,
  OperatorFamily,
  OperatorSpec,
  PortableOperator,
} from './operators.ts';
export {
  CANONICAL_PORTABLE_OPERATORS,
  OPERATOR_ARITY,
  OPERATOR_NAMES,
  OPERATOR_SPECS,
  PORTABLE_OPERATORS,
  getOperatorSpec,
  isPortableOperator,
} from './operators.ts';

// Scope + permissions
export type {
  ExpressionScope,
  ExpressionScopeRoot,
  ParsedPath,
  PathParseError,
  PermissionSnapshot,
} from './scope.ts';
export {
  EXPRESSION_SCOPE_ROOTS,
  SCOPE_SIGILS,
  emptyExpressionScope,
  isValidPath,
  parsePath,
} from './scope.ts';
export {
  buildPermissionFilteredScope,
  pathAuthorization,
} from './permission-scope.ts';

// Errors
export type { ExpressionError, ExpressionErrorCode } from './errors.ts';
export {
  EXPR_MAX_DEPTH,
  EXPR_MAX_STEPS,
  exprError,
} from './errors.ts';

// Evaluator interface
export type { ExpressionEvaluator } from './evaluator.ts';

// Function registry + manifest
export type {
  FunctionImpl,
  FunctionManifestEntry,
  FunctionRegistry,
  FunctionRegistryDiagnostic,
} from './function-registry.ts';
export {
  BUILTIN_FUNCTION_MANIFEST,
  BUILTIN_FUNCTION_NAMES,
  getBuiltinManifestEntry,
  isBuiltinFunction,
} from './builtin-manifest.ts';

// Golden fixture types
export type {
  GoldenCase,
  GoldenExpect,
  GoldenFixture,
  GoldenFixtureCategory,
} from './golden-types.ts';

// Validator
export type { ExpressionValidationResult } from './validate.ts';
export {
  suggestFunctions,
  validateExpression,
  validatePath,
} from './validate.ts';

// Serializer
export type { DeserializeResult } from './serialize.ts';
export {
  deserializeExpression,
  roundTripExpression,
  serializeExpression,
} from './serialize.ts';
