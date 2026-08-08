import type { Document, Node } from './ast.ts';
import { tokenize } from './lexer.ts';
import type { Token } from './lexer.ts';

export function parse(input: string): Document {
  const tokens = tokenize(input);
  const rootNodes: Node[] = [];
  const stack: { indent: number; node: Node }[] = [];

  for (const token of tokens) {
    const node: Node = {
      type: token.type,
      props: token.props,
      label: token.label,
      textContent: token.textContent,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= token.indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ indent: token.indent, node });
  }

  return { rootNodes };
}
