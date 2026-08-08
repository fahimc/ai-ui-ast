/**
 * Structured diagnostics for @codedia/parser v0.2.
 *
 * Diagnostics carry a stable machine-readable `code`, a severity, a line
 * (and column where feasible), a human/LLM-readable message, and an optional
 * suggestion. They are designed to be fed straight back to an LLM for
 * one-shot repair: `formatDiagnostics` produces a compact, line-anchored
 * report.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  /** Stable machine-readable identifier, e.g. `AUI_INVALID_TOKEN`. */
  code: string;
  severity: Severity;
  message: string;
  /** 1-based source line. */
  line: number;
  /** 1-based column, where feasible. */
  column?: number;
  /** Optional fix hint for an LLM or developer. */
  suggestion?: string;
}

/** Stable diagnostic codes. */
export const DiagnosticCode = {
  // Lexer / parser
  UNTERMINATED_STRING: 'AUI_UNTERMINATED_STRING',
  MALFORMED_IMPORT: 'AUI_MALFORMED_IMPORT',
  IMPORT_GRAMMAR_UNSUPPORTED: 'AUI_IMPORT_GRAMMAR_UNSUPPORTED',
  INDENT_MIXED_TABS_SPACES: 'AUI_INDENT_MIXED_TABS_SPACES',
  INDENT_INCONSISTENT: 'AUI_INDENT_INCONSISTENT',
  // Structure
  ORPHAN_ELSE: 'AUI_ORPHAN_ELSE',
  DUPLICATE_ELSE: 'AUI_DUPLICATE_ELSE',
  NESTED_ELSE: 'AUI_NESTED_ELSE',
  FOR_MISSING_LIST: 'AUI_FOR_MISSING_LIST',
  MULTIPLE_PAGE_ROOTS: 'AUI_MULTIPLE_PAGE_ROOTS',
  STATE_RESERVED: 'AUI_STATE_RESERVED',
  // Registry / semantics
  UNKNOWN_NODE: 'AUI_UNKNOWN_NODE',
  UNKNOWN_PROP: 'AUI_UNKNOWN_PROP',
  MISSING_REQUIRED_PROP: 'AUI_MISSING_REQUIRED_PROP',
  INVALID_TOKEN: 'AUI_INVALID_TOKEN',
  INVALID_PROP_TYPE: 'AUI_INVALID_PROP_TYPE',
  DUPLICATE_PROP: 'AUI_DUPLICATE_PROP',
  CHILD_CONSTRAINT: 'AUI_CHILD_CONSTRAINT',
  TEXT_CONSTRAINT: 'AUI_TEXT_CONSTRAINT',
  // Declarations
  DUPLICATE_DEF: 'AUI_DUPLICATE_DEF',
  DUPLICATE_PARAM: 'AUI_DUPLICATE_PARAM',
  INVALID_IDENTIFIER: 'AUI_INVALID_IDENTIFIER',
  COLLISION: 'AUI_COLLISION',
  UNKNOWN_PARAM: 'AUI_UNKNOWN_PARAM',
  MISSING_REQUIRED_PARAM: 'AUI_MISSING_REQUIRED_PARAM',
  // Bindings
  BINDING_DANGEROUS: 'AUI_BINDING_DANGEROUS',
  BINDING_AMBIGUOUS: 'AUI_BINDING_AMBIGUOUS',
  // Resources
  SOURCE_TOO_LARGE: 'AUI_SOURCE_TOO_LARGE',
  TOO_MANY_LINES: 'AUI_TOO_MANY_LINES',
  TOO_DEEP: 'AUI_TOO_DEEP',
  TOO_MANY_NODES: 'AUI_TOO_MANY_NODES',
  TOO_MANY_PROPS: 'AUI_TOO_MANY_PROPS',
  TOO_MANY_DEFS: 'AUI_TOO_MANY_DEFS',
  // Compile
  ERRORS_PRESENT: 'AUI_ERRORS_PRESENT',
} as const;

export type DiagnosticCode = (typeof DiagnosticCode)[keyof typeof DiagnosticCode];

export function error(code: string, message: string, line: number, column?: number, suggestion?: string): Diagnostic {
  return { code, severity: 'error', message, line, column, suggestion };
}

export function warning(code: string, message: string, line: number, column?: number, suggestion?: string): Diagnostic {
  return { code, severity: 'warning', message, line, column, suggestion };
}

export function info(code: string, message: string, line: number, column?: number, suggestion?: string): Diagnostic {
  return { code, severity: 'info', message, line, column, suggestion };
}

/** True when a diagnostic list contains at least one error. */
export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/** Compact one-line-per-diagnostic report, grouped by line. */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return '';
  const byLine = new Map<number, Diagnostic[]>();
  for (const d of diagnostics) {
    const arr = byLine.get(d.line) || [];
    arr.push(d);
    byLine.set(d.line, arr);
  }
  const lines = [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, ds]) => {
      const parts = ds.map((d) => {
        let s = `${d.code} ${d.severity}: ${d.message}`;
        if (d.suggestion) s += ` (suggestion: ${d.suggestion})`;
        return s;
      });
      return `line ${line}: ${parts.join(' ')}`;
    });
  return lines.join('\n');
}

/**
 * LLM-repair-oriented rendering: a short `code at line L: message` line per
 * diagnostic, plus the offending source line when `source` is provided.
 */
export function formatDiagnosticsForLLM(diagnostics: Diagnostic[], source?: string): string {
  if (diagnostics.length === 0) return '';
  const sourceLines = source ? source.split('\n') : [];
  return diagnostics
    .map((d) => {
      const loc = d.column !== undefined ? `${d.line}:${d.column}` : `${d.line}`;
      const src = sourceLines[d.line - 1] !== undefined ? `\n    ${sourceLines[d.line - 1].trimEnd()}` : '';
      const fix = d.suggestion ? ` Fix: ${d.suggestion}` : '';
      return `${d.code} at line ${loc}: ${d.message}.${fix}${src}`;
    })
    .join('\n');
}
