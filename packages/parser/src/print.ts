import type { CanonicalDocument, ComponentDef, ImportDecl, Node, Value } from './ast.ts';
import { BINDING_PATH_RE } from './bindings.ts';

/**
 * Canonical `.aui` printer.
 *
 * Prints a canonical IR document back to `.aui` source with deterministic
 * formatting: 2-space indentation, normalized quoting/escaping, structural
 * If/Else/For rendered explicitly. Useful for LLM repair loops, formatting
 * tools, and semantic round-trip testing:
 *
 *   normalize(parse(printAui(normalize(parse(source)))))
 *
 * should preserve the canonical AST.
 */

const INDENT = '  ';

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function printValue(value: Value): string {
  switch (value.kind) {
    case 'string':
      return `"${escapeString(value.value)}"`;
    case 'token':
      return value.value;
    case 'number':
      return String(value.value);
    case 'boolean':
      return String(value.value);
    case 'binding':
      return '$' + value.path;
    case 'list':
      return `"${escapeString(value.value.join(','))}"`;
  }
}

/** Text content: a pure binding prints unquoted; everything else is quoted. */
function printTextContent(text: string): string {
  if (text.startsWith('$') && BINDING_PATH_RE.test(text.slice(1))) return text;
  return `"${escapeString(text)}"`;
}

function printNode(node: Node, depth: number): string[] {
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];

  if (node.kind === 'if') {
    const cond = node.condition.kind === 'binding' ? '$' + node.condition.path : printValue(node.condition);
    lines.push(`${pad}If condition=${cond}`);
    for (const child of node.then) lines.push(...printNode(child, depth + 1));
    if (node.else !== undefined) {
      lines.push(`${pad}Else`);
      for (const child of node.else) lines.push(...printNode(child, depth + 1));
    }
    return lines;
  }

  if (node.kind === 'for') {
    const each = node.each.kind === 'binding' ? '$' + node.each.path : printValue(node.each);
    lines.push(`${pad}For each=${each}`);
    for (const child of node.body) lines.push(...printNode(child, depth + 1));
    return lines;
  }

  // Component node.
  const parts = [node.type];
  if (node.label !== undefined) parts.push(node.label);
  for (const prop of node.props) {
    parts.push(`${prop.key}=${printValue(prop.value)}`);
  }
  if (node.textContent !== undefined) parts.push(printTextContent(node.textContent));
  lines.push(pad + parts.join(' '));
  for (const child of node.children) lines.push(...printNode(child, depth + 1));
  return lines;
}

function printImport(decl: ImportDecl): string {
  if (decl.sideEffect) return `import "${decl.source}"`;
  if (decl.names.length > 0) {
    return `import ${decl.defaultName ? decl.defaultName + ', ' : ''}{ ${decl.names.join(', ')} } from "${decl.source}"`;
  }
  return `import ${decl.defaultName ?? ''} from "${decl.source}"`.replace(/\s{2,}/g, ' ');
}

function printDef(def: ComponentDef): string[] {
  const parts = ['def', def.name];
  for (const p of def.params) {
    if (p.defaultValue !== undefined) {
      parts.push(`${p.name}=${printValue(p.defaultValue)}`);
    } else {
      parts.push(p.name);
    }
  }
  const lines = [parts.join(' ')];
  for (const child of def.children) lines.push(...printNode(child, 1));
  return lines;
}

/** Print a canonical document to deterministic `.aui` source. */
export function printAui(doc: CanonicalDocument): string {
  const lines: string[] = [];
  const imports = doc.imports ?? [];
  for (const decl of imports) lines.push(printImport(decl));
  if (imports.length > 0 && (doc.components?.length || doc.rootNodes.length)) lines.push('');
  for (const def of doc.components ?? []) {
    lines.push(...printDef(def));
    lines.push('');
  }
  for (const root of doc.rootNodes) lines.push(...printNode(root, 0));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
