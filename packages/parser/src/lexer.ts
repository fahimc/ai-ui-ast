import type { ImportDecl, RawValue } from './ast.ts';
import type { Diagnostic } from './diagnostics.ts';
import { DiagnosticCode, error, warning } from './diagnostics.ts';

export interface TokenProp {
  key: string;
  value: RawValue;
}

export interface Token {
  /** Indentation width in columns. */
  indent: number;
  /** True when this line's leading whitespace contains a tab. */
  indentHasTab: boolean;
  type: string;
  props: TokenProp[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  /** Component params on a `def` line (required + defaulted). */
  params?: { name: string; defaultValue?: RawValue; required: boolean }[];
  /** Parsed import declaration for `import … from "…"` lines. */
  importDecl?: ImportDecl;
  textContent?: string;
  line: number;
}

export interface ScanResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/** Strip surrounding quotes and resolve escapes from a quoted value. */
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n');
  }
  return value;
}

/**
 * Remove `#` comments quote/escape-aware: `#` starts a comment only when it
 * appears outside a quoted string. `Heading "Dashboard" # title` keeps the
 * quote intact, and `Area stroke="#a78bfa"` keeps the hex colour inside the
 * string. Returns { text, unterminated }.
 */
export function stripComment(raw: string): { text: string; unterminated: boolean } {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      out += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '#') {
      break;
    } else {
      out += c;
    }
  }
  return { text: out, unterminated: inString };
}

/**
 * Split a line into words, treating quoted strings (which may contain
 * spaces) as single atomic tokens — both standalone text and `key="…"`
 * prop values, so `label="Active users"` stays one word.
 */
function splitWords(line: string): string[] {
  const words: string[] = [];
  const re = /[A-Za-z][A-Za-z0-9_-]*="([^"\\]*(?:\\.[^"\\]*)*)"|"([^"\\]*(?:\\.[^"\\]*)*)"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    words.push(m[0]);
  }
  return words;
}

/** Classify a raw `key=value` value (already unquoted where quoted). */
export function classifyValue(raw: string): RawValue {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return { kind: 'string', value: unquote(raw) };
  }
  if (raw.startsWith('$')) {
    return { kind: 'binding', path: raw.slice(1) };
  }
  if (raw === 'true') return { kind: 'boolean', value: true };
  if (raw === 'false') return { kind: 'boolean', value: false };
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { kind: 'number', value: Number(raw) };
  return { kind: 'bare', value: raw };
}

/**
 * Parse the tail of an `import` line into a structured declaration.
 * Supported in v0.2:
 *   import { A, B } from "pkg"
 *   import Default from "pkg"
 *   import Default, { A } from "pkg"
 *   import "pkg"                       (side-effect import)
 * Explicitly rejected (repairable diagnostic, not partial parse):
 *   import { A as B } from "pkg"       (aliases)
 *   import * as NS from "pkg"          (namespace imports)
 */
export function parseImport(rest: string): { decl?: ImportDecl; error?: { code: string; message: string } } {
  // Side-effect import: `import "pkg"` (possibly with a trailing comment).
  const bare = rest.match(/^"([^"]+)"$/);
  if (bare) return { decl: { names: [], source: bare[1], sideEffect: true } };

  // Namespace or alias forms — reject explicitly.
  if (/\bas\b/.test(rest)) {
    return {
      error: {
        code: DiagnosticCode.IMPORT_GRAMMAR_UNSUPPORTED,
        message: 'Import aliases (`import { A as B } from "pkg"`) are not supported in v0.2. Use the exported name directly.',
      },
    };
  }
  if (/\*\s*as/.test(rest)) {
    return {
      error: {
        code: DiagnosticCode.IMPORT_GRAMMAR_UNSUPPORTED,
        message: 'Namespace imports (`import * as NS from "pkg"`) are not supported in v0.2. Import the names you use.',
      },
    };
  }

  const m = rest.match(/^(.*?)\s+from\s+"([^"]+)"$/);
  if (!m) {
    return {
      error: {
        code: DiagnosticCode.MALFORMED_IMPORT,
        message: 'Malformed import. Use: import { A, B } from "pkg", import Default from "pkg", or import "pkg".',
      },
    };
  }
  const spec = m[1].trim();
  const source = m[2];
  const names: string[] = [];
  let defaultName: string | undefined;

  const braceMatch = spec.match(/\{([^}]*)\}/);
  if (braceMatch) {
    const parsed = braceMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const n of parsed) {
      if (/\bas\b/.test(n)) {
        return {
          error: {
            code: DiagnosticCode.IMPORT_GRAMMAR_UNSUPPORTED,
            message: `Import alias "${n.trim()}" is not supported in v0.2. Use the exported name directly.`,
          },
        };
      }
      names.push(n);
    }
    const before = spec.slice(0, braceMatch.index).replace(/[,\s]+$/, '').trim();
    if (before) defaultName = before;
  } else if (spec) {
    defaultName = spec;
  }

  return { decl: { names, defaultName, source } };
}

export interface ScanOptions {
  /** 1-based starting line for diagnostics (used by tests embedding snippets). */
  offsetLine?: number;
}

/**
 * Lex `.aui` source into tokens, one per non-empty line, plus any lexical
 * diagnostics (unterminated strings, malformed imports, indentation flags).
 */
export function scan(input: string, opts: ScanOptions = {}): ScanResult {
  const lines = input.split('\n');
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const offset = opts.offsetLine ?? 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim() === '') continue;
    const line = i + 1 + offset;

    const { text: stripped, unterminated } = stripComment(rawLine);
    if (unterminated) {
      diagnostics.push(
        error(DiagnosticCode.UNTERMINATED_STRING, `Unterminated string literal on line ${line}.`, line, undefined, 'Close the quote with ".'),
      );
    }
    if (stripped.trim() === '') continue;

    const indentMatch = stripped.match(/^(\s*)/);
    const indentRaw = indentMatch ? indentMatch[1] : '';
    const indent = indentRaw.length;
    const indentHasTab = indentRaw.includes('\t');

    const words = splitWords(stripped.trim());
    const type = words[0];
    if (!type) continue;

    // `import … from "pkg"` lines are declarations, not nodes.
    if (type === 'import') {
      const parsed = parseImport(words.slice(1).join(' '));
      if (parsed.error) {
        diagnostics.push(error(parsed.error.code, parsed.error.message, line));
        tokens.push({ indent, indentHasTab, type, props: [], line });
        continue;
      }
      tokens.push({ indent, indentHasTab, type, props: [], importDecl: parsed.decl, line });
      continue;
    }

    const props: TokenProp[] = [];
    const bare: string[] = [];
    let rest = words.slice(1);
    let textContent: string | undefined;

    // A trailing quoted string or bare binding is the node's text content.
    const last = rest[rest.length - 1];
    if (last && (last.startsWith('"') || (last.startsWith('$') && !last.includes('=')))) {
      textContent = last.startsWith('"') ? unquote(last) : last;
      rest = rest.slice(0, -1);
    }

    for (const part of rest) {
      const eqIndex = part.indexOf('=');
      if (eqIndex > 0) {
        const key = part.substring(0, eqIndex);
        props.push({ key, value: classifyValue(part.substring(eqIndex + 1)) });
      } else {
        bare.push(part);
      }
    }

    // The first bare identifier after the type is the node's label.
    const label = bare.find((w) => !w.startsWith('$'));

    const token: Token = {
      indent,
      indentHasTab,
      type,
      props,
      label,
      textContent,
      line,
    };

    // On a `def` line, bare identifiers are required params and `key=value`
    // props are params with defaults — one unified param model.
    if (type === 'def' && label) {
      const params: { name: string; defaultValue?: RawValue; required: boolean }[] = [];
      for (const w of bare.filter((w) => w !== label)) {
        params.push({ name: w, required: true });
      }
      for (const p of props) {
        params.push({ name: p.key, defaultValue: p.value, required: false });
      }
      token.params = params;
      token.props = [];
    }

    tokens.push(token);
  }

  return { tokens, diagnostics };
}

/**
 * Compatibility entry point: `tokenize(source)` → tokens (lexical
 * diagnostics are discarded; use `scan` for them). Prefer `scan` in new code.
 */
export function tokenize(input: string): Token[] {
  return scan(input).tokens;
}
