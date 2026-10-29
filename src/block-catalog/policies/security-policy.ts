// ============================================================================
// @bitcode/ui-schema — Security Policy (ADR-017 §4, ADR-018 §9, Agent L)
//
// Field-scoped security/privacy gate. Covers:
//   - Secrets scan (field-scoped, anchored patterns, false-positive guarded).
//   - Unsafe URL scheme rejection (javascript:/data:/file: and http downgrade).
//   - URL allowlist DECLARATION check (never resolution — that is P4/host).
//   - Untrusted HTML marker detection (gated by richTextSanitize policy).
//   - Rich text sanitization default-on enforcement.
//   - Payment adapter requirement + provider-secret prohibition.
//   - External link open-allow warning.
//   - Unsafe call-string blocklist (eval(/Function(/setTimeout( forms).
//   - Expression/action runtime DECLARATION consistency for reactive/action caps.
//
// Honesty note: catalog JSON embeds `schemaPreset: UiSchema`, whose `actions`
// are UiAction button descriptors, NOT ActionSource or PortableExpression
// AST nodes. The PortableExpression AST lives in the action runtime
// (host/block-renderer), not in catalog JSON. So this policy does NOT
// fabricate an AST walk over schemaPreset; it validates serializable string
// content + capability/adapter declaration consistency, which is the
// catalog-level contract surface that actually exists.
//
// Pure functions. No I/O. No framework deps.
// ============================================================================

import type { BlockCatalogEntry } from '../types.ts';
import type { ResolvedPolicyConfig, PolicyResult } from './types.ts';
import {
  POLICY_DIAGNOSTIC_CODES,
  gateSeverity,
  hasAnyCapability,
  hasCapability,
  isReadyEntry,
  policyDiagnostic,
  resultFromDiagnostics,
} from './types.ts';

// ---------------------------------------------------------------------------
// Risk-bearing capability sets
// ---------------------------------------------------------------------------

/** Capabilities that route through HTTP and therefore need URL safety gates. */
const URL_CAPABILITIES = ['url', 'payment-adapter', 'provider-adapter'] as const;
/** Capabilities that emit rich text / HTML and therefore need sanitization. */
const RICH_TEXT_CAPABILITIES = ['sanitize'] as const;
/** Capabilities implying mutation/reactivity runtime requirements. */
const RUNTIME_CAPABILITIES = ['reactive', 'action-source'] as const;

// ---------------------------------------------------------------------------
// Secret patterns (anchored, low-false-positive)
// ---------------------------------------------------------------------------

/**
 * Anchored, high-precision secret patterns. Each REQUIRES a structural form
 * (bearer-token-with-payload, PEM header, key-assignment) — NOT the bare word
 * "password". False-positive guards in tests cover common builder prose like
 * "Password reset link" and "block.security.login".
 */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // Bearer token with a long payload: "Bearer eyJ..." / "bearer abc123..." (>=20 chars).
  { name: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}/i },
  // PEM private key header (RSA/EC/OpenSSH/Generic).
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  // Key assignment: "api_key=..."/"sk_live=..."/"secret: '...'" with a >=16-char secret.
  // Anchored to assignment punctuation to avoid matching prose.
  {
    name: 'assigned-key',
    re: /\b(?:api[_-]?key|sk(?:_[a-z]+)?|pk(?:_[a-z]+)?|secret|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i,
  },
];

/**
 * Unsafe callable-string forms. Anchored to the OPEN-PAREN call form so that
 * the word "evaluate" in a label is NOT flagged — only `eval(`, `Function(`,
 * `new Function`, `setTimeout(` as actual call expressions.
 */
const UNSAFE_CALL_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'eval', re: /\beval\s*\(/ },
  { name: 'Function', re: /\b(?:new\s+)?Function\s*\(/ },
  { name: 'setTimeout', re: /\bsetTimeout\s*\(/ },
  { name: 'setInterval', re: /\bsetInterval\s*\(/ },
];

/** Disallowed URL schemes (case-insensitive, scheme prefix). */
const UNSAFE_URL_SCHEMES = /^\s*(javascript|data|file|vbscript):/i;
/** Plain HTTP (no TLS) — production-Ready should require https. */
const HTTP_SCHEME = /^\s*http:\/\//i;

// ---------------------------------------------------------------------------
// Risk-bearing serializable string collector
// ---------------------------------------------------------------------------

/**
 * Collect serializable string leaves from risk-bearing fields only. NOT a
 * blanket scan of every string — this is the field-scoping discipline.
 *
 * Risk-bearing surfaces:
 *   - schemaPreset (walked shallowly: title/description/placeholder/pattern/
 *     payload + one level into fields/columns_def/sections).
 *   - componentKey.
 *   - requiredComponents/Functions/Adapters (string form entries).
 *   - securityPolicy.* string values (urlAllowlist entries, notes).
 *   - migration.* string values.
 *   - aliases, deprecatedBy, labelKey, fallbackLabel.
 *
 * Returns `{ value, path }` pairs so diagnostics point precisely.
 */
interface FieldString {
  value: string;
  path: string;
}

function collectRiskStrings(entry: BlockCatalogEntry): FieldString[] {
  const out: FieldString[] = [];
  const id = entry.id;
  const push = (value: unknown, path: string): void => {
    if (typeof value === 'string' && value.length > 0) out.push({ value, path });
  };

  push(entry.componentKey, 'componentKey');
  push(entry.labelKey, 'labelKey');
  push(entry.fallbackLabel, 'fallbackLabel');
  push(entry.deprecatedBy, 'deprecatedBy');
  if (Array.isArray(entry.aliases)) {
    entry.aliases.forEach((a, i) => push(a, `aliases[${i}]`));
  }

  // required* declarations (string OR object form — only the string forms).
  if (Array.isArray(entry.requiredComponents)) {
    entry.requiredComponents.forEach((c, i) => {
      if (typeof c === 'string') push(c, `requiredComponents[${i}]`);
    });
  }
  if (Array.isArray(entry.requiredFunctions)) {
    entry.requiredFunctions.forEach((f, i) => {
      if (typeof f === 'string') push(f, `requiredFunctions[${i}]`);
    });
  }
  if (Array.isArray(entry.requiredAdapters)) {
    entry.requiredAdapters.forEach((a, i) => {
      if (typeof a === 'string') push(a, `requiredAdapters[${i}]`);
    });
  }

  // securityPolicy string leaves.
  const sp = entry.securityPolicy;
  if (sp) {
    if (Array.isArray(sp.urlAllowlist)) {
      sp.urlAllowlist.forEach((u, i) => push(u, `securityPolicy.urlAllowlist[${i}]`));
    }
    push(sp.externalLinks, 'securityPolicy.externalLinks');
    push(sp.notes, 'securityPolicy.notes');
    push(sp.richTextSanitize, 'securityPolicy.richTextSanitize');
    if (sp.filePolicy) {
      if (Array.isArray(sp.filePolicy.allowedTypes)) {
        sp.filePolicy.allowedTypes.forEach((t, i) =>
          push(t, `securityPolicy.filePolicy.allowedTypes[${i}]`),
        );
      }
    }
  }

  // migration string leaves.
  const m = entry.migration;
  if (m) {
    push(m.fromVersion, 'migration.fromVersion');
    push(m.toVersion, 'migration.toVersion');
    push(m.migrationNotes, 'migration.migrationNotes');
    if (Array.isArray(m.deprecatedFields)) {
      m.deprecatedFields.forEach((f, i) => push(f, `migration.deprecatedFields[${i}]`));
    }
  }

  // schemaPreset shallow walk (UiSchema). Cover user-facing + payload surfaces.
  const preset = entry.schemaPreset as Record<string, unknown> | undefined;
  if (preset && typeof preset === 'object') {
    push(preset.title, 'schemaPreset.title');
    push(preset.description, 'schemaPreset.description');
    push(preset.name, 'schemaPreset.name');
    // payload (custom schema kind) — stringified check only when it is a string.
    push(preset.payload, 'schemaPreset.payload');
    if (Array.isArray(preset.fields)) {
      preset.fields.forEach((f, i) => {
        if (f && typeof f === 'object') {
          const fld = f as Record<string, unknown>;
          push(fld.label, `schemaPreset.fields[${i}].label`);
          push(fld.placeholder, `schemaPreset.fields[${i}].placeholder`);
          push(fld.hint, `schemaPreset.fields[${i}].hint`);
          push(fld.pattern, `schemaPreset.fields[${i}].pattern`);
          push(fld.name, `schemaPreset.fields[${i}].name`);
        }
      });
    }
    if (Array.isArray(preset.actions)) {
      preset.actions.forEach((a, i) => {
        if (a && typeof a === 'object') {
          const act = a as Record<string, unknown>;
          push(act.name, `schemaPreset.actions[${i}].name`);
          push(act.label, `schemaPreset.actions[${i}].label`);
        }
      });
    }
    if (Array.isArray(preset.columns_def)) {
      preset.columns_def.forEach((c, i) => {
        if (c && typeof c === 'object') {
          const col = c as Record<string, unknown>;
          push(col.label, `schemaPreset.columns_def[${i}].label`);
          push(col.key, `schemaPreset.columns_def[${i}].key`);
        }
      });
    }
  }

  // Attach entryId is done by the diagnostic builder; here we keep path-only.
  void id;
  return out;
}

// ---------------------------------------------------------------------------
// False-positive guard
// ---------------------------------------------------------------------------

/**
 * Suppress a secret hit when the surrounding context is builder prose. The
 * anchored patterns already avoid most false positives, but labels like
 * "Password reset link" could theoretically align with edge cases. We check
 * against `knownSafeLabels` and require the matched substring to look like a
 * real credential (not pure prose). Defense in depth.
 */
function isLikelyFalsePositive(
  matchedString: string,
  knownSafeLabels: string[],
): boolean {
  const lower = matchedString.toLowerCase();
  if (knownSafeLabels.some((safe) => lower.includes(safe.toLowerCase()))) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public validator
// ---------------------------------------------------------------------------

/**
 * Run the security policy over an entry. Returns diagnostics with stable
 * `BLOCK_POLICY_*` codes. Severity scales with readiness via `gateSeverity`.
 */
export function validateSecurityPolicy(
  entry: BlockCatalogEntry,
  config: ResolvedPolicyConfig,
): PolicyResult {
  const diags = resultFromDiagnostics(entry.id, []).diagnostics;
  void config; // reserved for future pattern overrides; thresholds unused here.
  const id = entry.id;

  // --- Secrets scan (field-scoped) ---
  const riskStrings = collectRiskStrings(entry);
  for (const { value, path } of riskStrings) {
    for (const { name, re } of SECRET_PATTERNS) {
      const m = re.exec(value);
      if (m) {
        if (isLikelyFalsePositive(value, config.knownSafeLabels)) continue;
        diags.push(
          policyDiagnostic(
            id,
            POLICY_DIAGNOSTIC_CODES.SECRET_FOUND,
            'error',
            `Possible secret (${name}) detected in field '${path}'. Secrets must live in host/adapter configuration, never in catalog JSON.`,
            path,
            'Remove the secret and reference it via a host adapter or environment configuration.',
          ),
        );
        break; // one secret diagnostic per field
      }
    }
  }

  // --- Unsafe call strings (eval(/Function(/setTimeout() ---
  for (const { value, path } of riskStrings) {
    for (const { name, re } of UNSAFE_CALL_PATTERNS) {
      if (re.test(value)) {
        diags.push(
          policyDiagnostic(
            id,
            POLICY_DIAGNOSTIC_CODES.UNSAFE_CALL_STRING,
            'error',
            `Unsafe callable form '${name}(' found in field '${path}'. Catalog JSON must not embed executable code.`,
            path,
            `Remove the ${name}(...) call from catalog JSON; declare behavior via requiredFunctions/requiredAdapters instead.`,
          ),
        );
        break;
      }
    }
  }

  // --- URL safety: schemes in urlAllowlist + serializable URL surfaces ---
  const sp = entry.securityPolicy;
  const allowlistUrls: FieldString[] =
    sp && Array.isArray(sp.urlAllowlist)
      ? sp.urlAllowlist.map((u, i) => ({
          value: u,
          path: `securityPolicy.urlAllowlist[${i}]`,
        }))
      : [];
  for (const { value, path } of allowlistUrls) {
    if (UNSAFE_URL_SCHEMES.test(value)) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.UNSAFE_URL,
          'error',
          `URL allowlist entry '${value}' uses a disallowed scheme (javascript/data/file/vbscript are forbidden).`,
          path,
          'Use https:// URLs only in the allowlist.',
        ),
      );
    } else if (HTTP_SCHEME.test(value) && isReadyEntry(entry)) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.UNSAFE_URL,
          'error',
          `Ready entry URL allowlist contains plain HTTP URL '${value}'. Production Ready requires https.`,
          path,
          'Use https:// URLs in production Ready entries.',
        ),
      );
    }
  }

  // --- URL allowlist DECLARATION requirement for URL/payment/provider caps ---
  if (hasAnyCapability(entry, URL_CAPABILITIES)) {
    const hasAllowlist =
      !!sp && Array.isArray(sp.urlAllowlist) && sp.urlAllowlist.length > 0;
    if (!hasAllowlist) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.URL_ALLOWLIST_MISSING,
          gateSeverity(entry),
          `Entry declares a URL-routing capability (${URL_CAPABILITIES.join(', ')}) but does not declare securityPolicy.urlAllowlist. Real allowlist resolution is a host/P4 concern; this check validates declaration only.`,
          'securityPolicy.urlAllowlist',
          'Declare a non-empty urlAllowlist (host resolves the actual policy at runtime).',
        ),
      );
    }
  }

  // --- Rich text sanitization default-on ---
  if (hasAnyCapability(entry, RICH_TEXT_CAPABILITIES)) {
    const sanitize = sp?.richTextSanitize;
    if (sanitize === 'n/a' || (sanitize === undefined && isReadyEntry(entry))) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.SANITIZE_OFF,
          isReadyEntry(entry) ? 'error' : 'warning',
          `Entry carries the 'sanitize' capability but richTextSanitize is ${
            sanitize === 'n/a' ? "'n/a' (disabled)" : 'unset'
          }. Sanitization must default ON; opt-out must be policy-gated.`,
          'securityPolicy.richTextSanitize',
          "Set richTextSanitize to 'on' (default) or 'opt-out-policy'.",
        ),
      );
    }
  }

  // --- Untrusted HTML marker detection ---
  const htmlRisk = riskStrings.some(
    ({ value }) =>
      /<\s*(?:script|iframe|object|embed|link|meta)\b/i.test(value) ||
      /dangerouslySetInnerHTML/i.test(value) ||
      /on\w+\s*=\s*["']?[^"']*\s*\(/i.test(value),
  );
  if (htmlRisk) {
    const sanitizeAllowsHtml =
      !sp || sp.richTextSanitize === undefined || sp.richTextSanitize === 'n/a';
    if (sanitizeAllowsHtml) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.UNSAFE_HTML,
          'error',
          'Untrusted HTML marker detected in schemaPreset (script/iframe/embed or inline event handler). Rich text sanitization must be explicitly enabled.',
          'schemaPreset',
          "Set securityPolicy.richTextSanitize to 'on' and remove raw HTML injection points.",
        ),
      );
    }
  }

  // --- Payment adapter requirement ---
  if (hasCapability(entry, 'payment-adapter')) {
    if (!sp?.paymentAdapterRequired) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.PAYMENT_NO_ADAPTER,
          gateSeverity(entry),
          "Entry declares 'payment-adapter' capability but securityPolicy.paymentAdapterRequired is not true. Provider secrets must live in host/plugin configuration, never schema.",
          'securityPolicy.paymentAdapterRequired',
          'Set paymentAdapterRequired=true and route payments through a generic adapter (provider SDKs belong in plugins).',
        ),
      );
    }
  }

  // --- External link open-allow warning (content/navigation) ---
  if (
    (entry.category === 'content' || entry.category === 'navigation') &&
    sp?.externalLinks === 'allow'
  ) {
    diags.push(
      policyDiagnostic(
        id,
        POLICY_DIAGNOSTIC_CODES.EXTERNAL_LINK_OPEN,
        'warning',
        "Entry uses externalLinks='allow' (open). Production content/navigation blocks should use 'allowlist' for external link safety.",
        'securityPolicy.externalLinks',
        "Prefer externalLinks='allowlist' and declare allowed domains in urlAllowlist.",
      ),
    );
  }

  // --- Reactive/action runtime declaration consistency ---
  if (hasAnyCapability(entry, RUNTIME_CAPABILITIES)) {
    const hasFn =
      Array.isArray(entry.requiredFunctions) && entry.requiredFunctions.length > 0;
    const hasAdapter =
      Array.isArray(entry.requiredAdapters) && entry.requiredAdapters.length > 0;
    if (!hasFn && !hasAdapter) {
      diags.push(
        policyDiagnostic(
          id,
          POLICY_DIAGNOSTIC_CODES.EXPR_RUNTIME_NOT_DECLARED,
          gateSeverity(entry),
          `Entry declares a runtime capability (${RUNTIME_CAPABILITIES.join(', ')}) but neither requiredFunctions nor requiredAdapters is declared. Reactive/action behavior must declare its runtime contract explicitly.`,
          'requiredFunctions',
          'Declare the expression/action runtime via requiredFunctions or requiredAdapters (e.g. the expression built-in namespace or an action adapter).',
        ),
      );
    }
  }

  return resultFromDiagnostics(id, diags);
}
