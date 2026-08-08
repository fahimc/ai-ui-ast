import type { RawComponentDef, RawDocument, RawNode, RawProp } from './ast.ts';
import { scan } from './lexer.ts';
import type { Token } from './lexer.ts';

interface Container {
  children: RawNode[];
}

/**
 * Parse `.aui` source into the raw syntax tree. The parser is deliberately
 * lenient: semantic/structural/indentation problems are reported by
 * `validate()`, not thrown here. Every node carries its 1-based source line.
 */
export function parse(input: string): RawDocument {
  const { tokens } = scan(input);
  const doc: RawDocument = { rootNodes: [], imports: [], components: [] };
  const root: Container = { children: doc.rootNodes };
  const stack: { indent: number; container: Container }[] = [];

  for (const token of tokens) {
    // `import` declarations are collected, never part of the tree.
    if (token.importDecl) {
      doc.imports!.push(token.importDecl);
      continue;
    }

    // `def` starts a component template; its indented children become the
    // template body. The def itself is a declaration, not a tree node.
    if (token.type === 'def') {
      while (stack.length > 0 && stack[stack.length - 1].indent >= token.indent) {
        stack.pop();
      }
      const def: RawComponentDef = {
        name: token.label || '',
        params: token.params ?? [],
        children: [],
        line: token.line,
      };
      doc.components!.push(def);
      stack.push({ indent: token.indent, container: def as unknown as Container });
      continue;
    }

    const node: RawNode = {
      type: token.type,
      props: token.props.map((p): RawProp => ({ key: p.key, value: p.value })),
      label: token.label,
      textContent: token.textContent,
      children: [],
      line: token.line,
    };

    // `Else` continues the sibling block at the same indent (it belongs to
    // the matching `If`), so it must not pop that block's container. A second
    // `Else` at the same indent becomes a sibling of the first so the
    // validator can reject it as a duplicate instead of silently nesting it.
    const minIndent = token.type === 'Else' ? token.indent + 1 : token.indent;
    while (stack.length > 0 && stack[stack.length - 1].indent >= minIndent) {
      stack.pop();
    }
    if (
      token.type === 'Else' &&
      stack.length > 0 &&
      stack[stack.length - 1].indent === token.indent &&
      'type' in stack[stack.length - 1].container &&
      (stack[stack.length - 1].container as unknown as { type: string }).type === 'Else'
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.children.push(node);
    } else {
      stack[stack.length - 1].container.children.push(node);
    }

    stack.push({ indent: token.indent, container: node });
  }

  return doc;
}
