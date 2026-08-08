import type { ComponentDef, Document, Node } from './ast.ts';
import { tokenize } from './lexer.ts';
import type { Token } from './lexer.ts';

interface Container {
  children: Node[];
}

export function parse(input: string): Document {
  const tokens = tokenize(input);
  const doc: Document = { rootNodes: [], imports: [], components: [] };
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
      const def: ComponentDef = {
        name: token.label || '',
        params: token.params || [],
        defaultProps: token.props,
        children: [],
      };
      doc.components!.push(def);
      stack.push({ indent: token.indent, container: def as unknown as Container });
      continue;
    }

    const node: Node = {
      type: token.type,
      props: token.props,
      label: token.label,
      textContent: token.textContent,
      children: [],
    };

    // `Else` continues the sibling block at the same indent (it belongs to
    // the matching `If`), so it must not pop that block's container.
    const minIndent = token.type === 'Else' ? token.indent + 1 : token.indent;
    while (stack.length > 0 && stack[stack.length - 1].indent >= minIndent) {
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
