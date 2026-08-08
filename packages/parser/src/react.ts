import type { ComponentDef, Document, Node } from './ast.ts';
import { tokenizeText } from './text.ts';

/**
 * Deterministically compile a parsed .aui Document into readable React + TSX.
 * The output is what a registry adapter would produce: semantic components,
 * token props, bindings resolved against a `data` prop, and named actions
 * routed through an `onAction` callback.
 *
 * The compiler is pure: the same source always produces the same output, and
 * the output imports semantic components from a design-system adapter
 * (`@/components/ui`) rather than inventing imports or CSS.
 */

export interface CompileOptions {
  /** Name for the generated React component. Defaults to the Page label. */
  componentName?: string;
}

interface Ctx {
  /** Component templates defined with `def`, keyed by name. */
  defs: Map<string, ComponentDef>;
  /** Param names currently in scope (inside a def body). */
  paramScope: string[];
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function bindingToTsx(value: string, ctx: Ctx): string {
  // $label -> label (def param) ; $item -> item (loop var) ; $index -> i ;
  // $customer.name -> data.customer.name
  const path = value.slice(1);
  const root = path.split('.')[0];
  if (ctx.paramScope.includes(root)) return path;
  if (root === 'index') return 'i' + path.slice('index'.length);
  if (root === 'item') return path;
  return `data.${path}`;
}

function indentLines(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

function renderPropValue(value: string, ctx: Ctx): string {
  if (value.startsWith('$')) return `{${bindingToTsx(value, ctx)}}`;
  return `"${esc(value)}"`;
}

/** Render text content: bindings become JSX expressions, the rest stays literal. */
function renderTextContent(text: string, ctx: Ctx): string {
  return tokenizeText(text)
    .map((seg) =>
      seg.kind === 'binding'
        ? `{${bindingToTsx('$' + seg.value, ctx)}}`
        : /[{}]/.test(seg.value)
          ? `{"${esc(seg.value)}"}`
          : seg.value,
    )
    .join('');
}

function renderChildren(node: Node, ctx: Ctx): string {
  const lines: string[] = [];
  if (node.textContent !== undefined) {
    lines.push(renderTextContent(node.textContent, ctx));
  }
  for (const child of node.children) {
    if (child.type !== 'Else') lines.push(renderNode(child, ctx));
  }
  return lines.join('\n');
}

/** Render the JSX element for one node (no surrounding fragment/ternary). */
function renderNode(node: Node, ctx: Ctx): string {
  // Component templates are rendered as local components with passthrough props.
  if (ctx.defs.has(node.type)) {
    const props = node.props.map(({ key, value }) => `${key}=${renderPropValue(value, ctx)}`).join(' ');
    const childrenText = renderChildren(node, ctx);
    if (childrenText) {
      return `<${node.type}${props ? ' ' + props : ''}>\n${indentLines(childrenText, '  ')}\n</${node.type}>`;
    }
    return `<${node.type}${props ? ' ' + props : ''} />`;
  }

  const props: string[] = [];
  const isIf = node.type === 'If';
  const isFor = node.type === 'For';

  for (const { key, value } of node.props) {
    if (key === 'action') {
      props.push(`onClick={() => onAction("${esc(value)}")}`);
    } else if (key === 'condition') {
      props.push(`condition={${bindingToTsx(value, ctx)}}`);
    } else if (key === 'each' || key === 'in') {
      props.push(`items={${bindingToTsx(value, ctx)}}`);
    } else if (key === 'checked') {
      props.push(`checked={${bindingToTsx(value, ctx)}}`);
    } else {
      props.push(`${key}=${renderPropValue(value, ctx)}`);
    }
  }

  const childrenText = renderChildren(node, ctx);

  if (isFor) {
    const listBinding = node.props.find((p) => p.key === 'each' || p.key === 'in')?.value;
    const listExpr = listBinding?.startsWith('$') ? bindingToTsx(listBinding, ctx) : 'items';
    const body = childrenText
      .split('\n')
      .map((l) => (l ? '  ' + l : l))
      .join('\n');
    return [`{${listExpr}.map((item, i) => (`, body, `))}`].join('\n');
  }

  if (isIf) {
    const cond = node.props.find((p) => p.key === 'condition');
    const expr = cond ? bindingToTsx(cond.value, ctx) : 'true';
    const elseNode = node.children.find((c) => c.type === 'Else');
    const thenText = childrenText || 'null';

    if (elseNode) {
      const elseText = renderChildren(elseNode, ctx) || 'null';
      return [
        `{${expr} ? (`,
        indentLines(thenText, '  '),
        `) : (`,
        indentLines(elseText, '  '),
        `)}`,
      ].join('\n');
    }
    return [`{${expr} && (`, indentLines(thenText, '  '), `)}`].join('\n');
  }

  if (childrenText) {
    // Text-only children (no nested elements) stay on one line, matching how
    // hand-written React reads: <Heading level={1}>Projects</Heading>.
    if (!childrenText.includes('\n')) {
      return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>${childrenText}</${node.type}>`;
    }
    return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>\n${indentLines(childrenText, '  ')}\n</${node.type}>`;
  }
  return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
}

/** Render a `def` template as a local function component. */
function renderDef(def: ComponentDef, ctx: Ctx): string {
  const paramList = def.params.join(', ');
  // Defaulted props (e.g. `tone=default`) are params too once destructured.
  const scoped = [...def.params, ...def.defaultProps.map((p) => p.key)];
  const body = def.children.map((c) => renderNode(c, { ...ctx, paramScope: [...ctx.paramScope, ...scoped] })).join('\n');
  const defaults = def.defaultProps.map((p) => `${p.key} = ${renderPropValue(p.value, ctx)}`).join(', ');
  const destructure = [paramList, defaults].filter(Boolean).join(', ');
  return [
    `function ${def.name}({ ${destructure} }: any) {`,
    `  return (`,
    indentLines(body || 'null', '    '),
    `  )`,
    `}`,
    ``,
  ].join('\n');
}

/** Structural nodes are language constructs, not registry components. */
const STRUCTURAL = new Set(['If', 'Else', 'For']);

function collectCoreNodes(nodes: Node[], defs: Map<string, ComponentDef>, out: Set<string>): void {
  for (const n of nodes) {
    if (!defs.has(n.type) && !STRUCTURAL.has(n.type)) out.add(n.type);
    collectCoreNodes(n.children, defs, out);
  }
}

export function compileReact(doc: Document, opts: CompileOptions = {}): string {
  const roots = doc.rootNodes;
  const defs = new Map((doc.components ?? []).map((d) => [d.name, d]));
  const ctx: Ctx = { defs, paramScope: [] };

  const page = roots.find((n) => n.type === 'Page');
  const componentName =
    opts.componentName || (page ? page.label || page.props.find((p) => p.key === 'title')?.value : undefined) || 'View';
  const name =
    componentName
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('') || 'View';

  const used = new Set<string>();
  collectCoreNodes(roots, defs, used);
  for (const def of doc.components ?? []) collectCoreNodes(def.children, defs, used);

  const importedNames = new Set<string>();
  const importLines: string[] = [];
  for (const decl of doc.imports ?? []) {
    const names = [...(decl.defaultName ? [decl.defaultName] : []), ...decl.names];
    names.forEach((n) => importedNames.add(n));
    importLines.push(
      decl.names.length > 0
        ? `import ${decl.defaultName ? decl.defaultName + ', ' : ''}{ ${decl.names.join(', ')} } from "${decl.source}"`
        : `import ${decl.defaultName ?? ''} from "${decl.source}"`.replace(/\s{2,}/g, ' '),
    );
  }

  const coreImports = [...used].filter((n) => !importedNames.has(n)).sort();
  const header: string[] = [];
  if (coreImports.length > 0) {
    header.push(`import { ${coreImports.join(', ')} } from '@/components/ui'`);
  }
  for (const line of importLines) header.push(line);

  const defBlocks = (doc.components ?? []).map((d) => renderDef(d, ctx));
  const body = roots.map((n) => renderNode(n, ctx)).join('\n');

  return [
    ...header,
    ...(header.length ? [''] : []),
    ...defBlocks,
    `export function ${name}({ data, onAction }: { data: any; onAction: (name: string) => void }) {`,
    `  return (`,
    indentLines(body || 'null', '    '),
    `  )`,
    `}`,
    ``,
  ].join('\n');
}
