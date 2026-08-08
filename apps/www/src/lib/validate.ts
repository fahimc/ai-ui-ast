import { tokenize, type Token } from '@ai-ui-ast/parser';
import { nodeSpec } from './registry';

export interface Diagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

interface Ctx {
  /** Component template names declared with `def`. */
  defs: Map<string, { params: string[] }>;
  /** Component names brought in via `import`. */
  imported: Set<string>;
}

/**
 * Walk the token stream exactly like the parser does, but emit
 * line-numbered diagnostics against the component registry instead of an AST.
 */
export function validate(input: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let tokens: Token[];
  try {
    tokens = tokenize(input);
  } catch {
    return [{ line: 1, message: 'Could not tokenize input.', severity: 'error' }];
  }

  const ctx: Ctx = { defs: new Map(), imported: new Set() };

  // First pass: collect declarations so definitions can be referenced later
  // in the file (and vice versa — unknown names are still flagged).
  for (const token of tokens) {
    if (token.type === 'def' && token.label) {
      ctx.defs.set(token.label, { params: token.params ?? [] });
    }
    if (token.importDecl) {
      for (const n of [...(token.importDecl.defaultName ? [token.importDecl.defaultName] : []), ...token.importDecl.names]) {
        ctx.imported.add(n);
      }
    }
  }

  for (const token of tokens) {
    // Declarations are validated on their own terms.
    if (token.type === 'import') {
      if (!token.importDecl) {
        diagnostics.push({ line: token.line, message: 'Malformed import. Use: import { A, B } from "pkg".', severity: 'error' });
      }
      continue;
    }
    if (token.type === 'def') {
      if (!token.label) {
        diagnostics.push({ line: token.line, message: 'A component definition needs a name: def StatCard label value.', severity: 'error' });
      }
      continue;
    }
    if (token.type === 'Else') {
      // Structural check happens at the tree level; nothing to validate here.
      continue;
    }

    // Component-template usage: props must be declared params.
    const def = ctx.defs.get(token.type);
    if (def) {
      for (const prop of token.props) {
        if (!def.params.includes(prop.key)) {
          diagnostics.push({
            line: token.line,
            message: `<${token.type}> has no param "${prop.key}". Declared params: ${def.params.join(', ') || 'none'}.`,
            severity: 'warning',
          });
        }
      }
      continue;
    }

    // Imported third-party component: accept anything, flag nothing.
    if (ctx.imported.has(token.type)) continue;

    const spec = nodeSpec(token.type);

    if (!spec) {
      diagnostics.push({
        line: token.line,
        message: `Unknown component "${token.type}". Not part of the v0 language surface.`,
        severity: 'error',
      });
      continue;
    }

    const specProps = new Map(spec.props.map((p) => [p.name, p]));

    for (const prop of token.props) {
      const propSpec = specProps.get(prop.key);
      if (!propSpec) {
        diagnostics.push({
          line: token.line,
          message: `<${token.type}> has no prop "${prop.key}". Valid props: ${spec.props.map((p) => p.name).join(', ') || 'none'}.`,
          severity: 'warning',
        });
        continue;
      }
      if (propSpec.tokens && !propSpec.tokens.includes(prop.value)) {
        diagnostics.push({
          line: token.line,
          message: `<${token.type}> prop "${prop.key}=${prop.value}" is not a valid token. Expected one of: ${propSpec.tokens.join(', ')}.`,
          severity: 'warning',
        });
      }
    }

    for (const req of spec.props.filter((p) => p.required)) {
      if (!token.props.some((p) => p.key === req.name)) {
        diagnostics.push({
          line: token.line,
          message: `<${token.type}> is missing required prop "${req.name}".`,
          severity: 'warning',
        });
      }
    }
  }

  return diagnostics;
}

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
    .map(([line, ds]) => `line ${line}: ${ds.map((d) => `${d.severity === 'error' ? 'error' : 'warn'}: ${d.message}`).join(' ')}`);
  return lines.join('\n');
}
