import type { Document, Node } from '@ai-ui-ast/parser';

/**
 * Deterministically compile a parsed .aui Document into readable React + TSX.
 * The output is what a registry adapter would produce: semantic components,
 * token props, bindings resolved against a `data` prop, and named actions
 * routed through an `onAction` callback.
 */

export interface CompileOptions {
  componentName?: string;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function bindingToTsx(value: string): string {
  // $customer.name -> data.customer.name ; $item.name -> item.name ; $index -> i
  const path = value.slice(1);
  if (path === 'index' || path.startsWith('index.')) {
    return 'i' + path.slice('index'.length);
  }
  if (path === 'item' || path.startsWith('item.')) {
    return path; // `item` is already the loop variable
  }
  return `data.${path}`;
}

function indentLines(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

function renderPropValue(value: string): string {
  if (value.startsWith('$')) return `{${bindingToTsx(value)}}`;
  return `"${esc(value)}"`;
}

function renderChildren(node: Node): string {
  const lines: string[] = [];
  if (node.textContent !== undefined) {
    const t = node.textContent;
    lines.push(t.startsWith('$') ? `{${bindingToTsx(t)}}` : t);
  }
  for (const child of node.children) {
    lines.push(renderNode(child));
  }
  return lines.join('\n');
}

function renderNode(node: Node): string {
  const props: string[] = [];
  const isIf = node.type === 'If';
  const isFor = node.type === 'For';

  for (const { key, value } of node.props) {
    if (key === 'action') {
      props.push(`onClick={() => onAction("${esc(value)}")}`);
    } else if (key === 'condition') {
      props.push(`condition={${bindingToTsx(value)}}`);
    } else if (key === 'each' || key === 'in') {
      props.push(`items={${bindingToTsx(value)}}`);
    } else if (key === 'checked') {
      props.push(`checked={${bindingToTsx(value)}}`);
    } else {
      props.push(`${key}=${renderPropValue(value)}`);
    }
  }

  const childrenText = renderChildren(node);

  if (isFor) {
    const body = childrenText
      .split('\n')
      .map((l) => (l ? '  ' + l : l))
      .join('\n');
    return [
      `{${node.props.find((p) => p.key === 'each' || p.key === 'in')?.value?.startsWith('$')
        ? bindingToTsx(node.props.find((p) => p.key === 'each' || p.key === 'in')!.value)
        : 'items'}.map((item, i) => (`,
      body,
      `))}`,
    ].join('\n');
  }

  if (isIf) {
    const cond = node.props.find((p) => p.key === 'condition');
    const expr = cond ? bindingToTsx(cond.value) : 'true';
    return [
      `{${expr} && (`,
      indentLines(childrenText || 'null', '  '),
      `)}`,
    ].join('\n');
  }

  if (childrenText) {
    return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>\n${indentLines(childrenText, '  ')}\n</${node.type}>`;
  }
  return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
}

export function compileReact(doc: Document, opts: CompileOptions = {}): string {
  const roots = doc.rootNodes;
  const page = roots.find((n) => n.type === 'Page');
  const componentName =
    opts.componentName || (page ? page.label || page.props.find((p) => p.key === 'title')?.value : undefined) || 'View';
  const name = componentName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('') || 'View';

  const used = new Set<string>();
  const walk = (n: Node) => {
    used.add(n.type);
    n.children.forEach(walk);
  };
  roots.forEach(walk);

  const imports = [...used].sort().join(',\n  ');
  const body = roots.map((n) => renderNode(n)).join('\n');

  return [
    `import {`,
    `  ${imports},`,
    `} from '@/components/ui'`,
    ``,
    `export function ${name}({ data, onAction }: { data: any; onAction: (name: string) => void }) {`,
    `  return (`,
    indentLines(body || 'null', '    '),
    `  )`,
    `}`,
    ``,
  ].join('\n');
}
