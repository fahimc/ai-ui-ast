import type { ImportDecl } from './ast.ts';

export interface Token {
  indent: number;
  type: string;
  props: { key: string; value: string }[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  /** Bare identifiers after the label on a `def` line (component params). */
  params?: string[];
  /** Parsed import declaration for `import … from "…"` lines. */
  importDecl?: ImportDecl;
  textContent?: string;
  line: number;
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

/**
 * Parse the tail of an `import` line into a structured declaration.
 * Supports: `import { A, B } from "pkg"`, `import Default from "pkg"`,
 * `import Default, { A } from "pkg"`, and bare `import "pkg"`.
 */
function parseImport(rest: string): ImportDecl | undefined {
  const m = rest.match(/^(.*?)\s+from\s+"([^"]+)"$/);
  if (!m) {
    // side-effect import: `import "pkg"`
    const bare = rest.match(/^"([^"]+)"$/);
    return bare ? { names: [], source: bare[1] } : undefined;
  }
  const spec = m[1].trim();
  const source = m[2];
  const names: string[] = [];
  let defaultName: string | undefined;

  const braceMatch = spec.match(/\{([^}]*)\}/);
  if (braceMatch) {
    braceMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((n) => names.push(n));
    const before = spec.slice(0, braceMatch.index).replace(/[,\s]+$/, '').trim();
    if (before) defaultName = before;
  } else if (spec) {
    defaultName = spec;
  }

  return { names, defaultName, source };
}

export function tokenize(input: string): Token[] {
  const lines = input.split('\n');
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim() === '') continue;

    const matchIndent = rawLine.match(/^(\s*)/);
    const indent = matchIndent ? matchIndent[1].length : 0;

    const words = splitWords(rawLine.trim());
    const type = words[0];
    if (!type) continue;

    // `import … from "pkg"` lines are declarations, not nodes.
    if (type === 'import') {
      const importDecl = parseImport(words.slice(1).join(' '));
      tokens.push({ indent, type, props: [], importDecl, line: i + 1 });
      continue;
    }

    const props: { key: string; value: string }[] = [];
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
        props.push({
          key: part.substring(0, eqIndex),
          value: unquote(part.substring(eqIndex + 1)),
        });
      } else {
        bare.push(part);
      }
    }

    // The first bare identifier after the type is the node's label.
    const label = bare.find((w) => !w.startsWith('$'));

    const token: Token = {
      indent,
      type,
      props,
      label,
      textContent,
      line: i + 1,
    };

    // On a `def` line, the remaining bare identifiers are component params.
    if (type === 'def' && label) {
      token.params = bare.filter((w) => w !== label);
    }

    tokens.push(token);
  }

  return tokens;
}
