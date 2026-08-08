import type { CanonicalDocument, ComponentDef, ComponentNode, ForNode, IfNode, Node, Prop, Value } from './ast.ts';
import { bindingToTsxExpression } from './bindings.ts';
import { normalize } from './normalize.ts';
import { CORE_REGISTRY, importFor } from './registry.ts';
import type { Registry } from './registry.ts';
import { tokenizeText } from './text.ts';

/**
 * Deterministically compile canonical IR into readable React + TSX.
 *
 * The compiler consumes the canonical IR (typed values, explicit If/For
 * nodes, unified def params). It never guesses semantics from strings and
 * never invents imports: every component resolves through the registry.
 *
 * The compiler is pure: the same input always produces the same output.
 */

export interface CompileOptions {
  /** Name for the generated React component. Defaults to the Page label. */
  componentName?: string;
  /** Component registry (defaults to CORE_REGISTRY). */
  registry?: Registry;
}

interface Ctx {
  defs: Map<string, ComponentDef>;
  /** Param names currently in scope (inside a def body). */
  paramScope: Set<string>;
  registry: Registry;
  /** True while compiling inside a For body (for $item / $index). */
  inLoop: boolean;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function indentLines(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

/** Render a normalized value as a JSX attribute expression or string literal. */
function renderValue(value: Value, ctx: Ctx): string {
  switch (value.kind) {
    case 'string':
      return `"${esc(value.value)}"`;
    case 'token':
      return `"${esc(value.value)}"`;
    case 'binding':
      return `{${bindingToTsxExpression(value.path, { defParams: ctx.paramScope })}}`;
    case 'number':
      return `{${value.value}}`;
    case 'boolean':
      return `{${value.value}}`;
    case 'list':
      return `{${JSON.stringify(value.value)}}`;
  }
}

/**
 * Render expression children (ternary branches, map bodies, return roots).
 * JSX expression contexts require a single expression: 0 children → `null`,
 * 1 child → rendered directly, 2+ → wrapped in a fragment.
 */
function renderJsxChildren(nodes: Node[], ctx: Ctx): string {
  if (nodes.length === 0) return 'null';
  if (nodes.length === 1) return renderNode(nodes[0], ctx);
  const body = nodes.map((n) => renderNode(n, ctx)).join('\n');
  return `<>\n${indentLines(body, '  ')}\n</>`;
}

/** Render text content: bindings become JSX expressions, the rest stays literal. */
function renderTextContent(text: string, ctx: Ctx): string {
  return tokenizeText(text)
    .map((seg) =>
      seg.kind === 'binding'
        ? `{${bindingToTsxExpression(seg.value, { defParams: ctx.paramScope })}}`
        : /[{}]/.test(seg.value)
          ? `{"${esc(seg.value)}"}`
          : seg.value,
    )
    .join('');
}

function renderChildren(node: ComponentNode, ctx: Ctx): string {
  const lines: string[] = [];
  if (node.textContent !== undefined) {
    lines.push(renderTextContent(node.textContent, ctx));
  }
  for (const child of node.children) {
    lines.push(renderNode(child, ctx));
  }
  return lines.join('\n');
}

function renderIf(node: IfNode, ctx: Ctx): string {
  const cond = node.condition.kind === 'binding' ? bindingToTsxExpression(node.condition.path, { defParams: ctx.paramScope }) : 'true';
  const thenText = renderJsxChildren(node.then, ctx);
  if (node.else !== undefined) {
    const elseText = renderJsxChildren(node.else, ctx);
    return [`{${cond} ? (`, indentLines(thenText, '  '), `) : (`, indentLines(elseText, '  '), `)}`].join('\n');
  }
  return [`{${cond} && (`, indentLines(thenText, '  '), `)}`].join('\n');
}

function renderFor(node: ForNode, ctx: Ctx, keyExpr?: string): string {
  const listExpr = node.each.kind === 'binding' ? bindingToTsxExpression(node.each.path, { defParams: ctx.paramScope }) : 'items';
  const loopCtx: Ctx = { ...ctx, inLoop: true };
  const body = node.body;
  let inner: string;
  if (body.length === 0) {
    inner = 'null';
  } else if (body.length === 1 && body[0].kind === 'component') {
    // Single element: put the key directly on it (no extra imports).
    inner = renderNode(body[0], loopCtx, keyExpr ?? 'i');
  } else {
    const childrenText = body.map((n) => renderNode(n, loopCtx)).join('\n');
    inner = `<Fragment key={${keyExpr ?? 'i'}}>\n${indentLines(childrenText, '  ')}\n</Fragment>`;
  }
  return [`{${listExpr}.map((item, i) => (`, indentLines(inner, '  '), `))}`].join('\n');
}

/**
 * Render one node. `keyExpr`, when given, injects `key={expr}` into the
 * opening tag of a plain element (used by For loop bodies).
 */
function renderNode(node: Node, ctx: Ctx, keyExpr?: string): string {
  if (node.kind === 'if') return renderIf(node, ctx);
  if (node.kind === 'for') return renderFor(node, ctx);
  return renderComponent(node, ctx, keyExpr);
}

function renderComponent(node: ComponentNode, ctx: Ctx, keyExpr?: string): string {
  const props: string[] = [];
  if (keyExpr) props.push(`key={${keyExpr}}`);

  // Component templates are rendered as local components with passthrough props.
  if (ctx.defs.has(node.type)) {
    for (const { key, value } of node.props) {
      props.push(`${key}=${renderValue(value, ctx)}`);
    }
    const childrenText = renderChildren(node, ctx);
    if (childrenText) {
      return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>\n${indentLines(childrenText, '  ')}\n</${node.type}>`;
    }
    return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
  }

  const spec = ctx.registry[node.type];
  const isIf = node.type === 'If';
  const isFor = node.type === 'For';

  for (const { key, value } of node.props) {
    if (node.type === 'Page' && key === 'data') {
      // `Page data=` is a language-level contract (the page's data context),
      // consumed here — not a prop to pass to the adapter.
      continue;
    } else if (key === 'action') {
      const name = actionName(value);
      props.push(`onClick={() => onAction("${esc(name)}")}`);
    } else if (key === 'condition' || key === 'each' || key === 'in') {
      // Consumed by If/For structural compilation.
      void isIf;
      void isFor;
      continue;
    } else if (spec?.events && spec.events[key]) {
      const ev = spec.events[key];
      const name = actionName(value);
      if (ev.payload) {
        props.push(`${ev.target}={(e) => onAction("${esc(name)}", e.${ev.payload})}`);
      } else {
        props.push(`${ev.target}={() => onAction("${esc(name)}")}`);
      }
    } else {
      props.push(`${key}=${renderValue(value, ctx)}`);
    }
  }

  const childrenText = renderChildren(node, ctx);

  if (childrenText) {
    // Text-only children (no nested elements) stay on one line.
    if (!childrenText.includes('\n')) {
      return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>${childrenText}</${node.type}>`;
    }
    return `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>\n${indentLines(childrenText, '  ')}\n</${node.type}>`;
  }
  return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
}

/** Render a `def` template as a local function component. */
function renderDef(def: ComponentDef, ctx: Ctx): string {
  const scoped = new Set(ctx.paramScope);
  for (const p of def.params) scoped.add(p.name);
  const innerCtx: Ctx = { ...ctx, paramScope: scoped };

  const destructureParts: string[] = [];
  for (const p of def.params) {
    if (p.defaultValue !== undefined && (p.defaultValue.kind === 'string' || p.defaultValue.kind === 'token')) {
      destructureParts.push(`${p.name} = "${esc(p.defaultValue.value)}"`);
    } else if (p.defaultValue !== undefined && p.defaultValue.kind === 'number') {
      destructureParts.push(`${p.name} = ${p.defaultValue.value}`);
    } else if (p.defaultValue !== undefined && p.defaultValue.kind === 'boolean') {
      destructureParts.push(`${p.name} = ${p.defaultValue.value}`);
    } else {
      destructureParts.push(p.name);
    }
  }
  const destructure = destructureParts.join(', ');
  const body = renderJsxChildren(def.children, innerCtx);
  return [`function ${def.name}({ ${destructure} }: any) {`, `  return (`, indentLines(body, '    '), `  )`, `}`, ``].join('\n');
}

function collectComponents(nodes: Node[], defs: Map<string, ComponentDef>, out: Set<string>): void {
  for (const n of nodes) {
    if (n.kind === 'component') {
      if (!defs.has(n.type)) out.add(n.type);
      collectComponents(n.children, defs, out);
    } else if (n.kind === 'if') {
      collectComponents(n.then, defs, out);
      if (n.else) collectComponents(n.else, defs, out);
    } else {
      collectComponents(n.body, defs, out);
    }
  }
}

/** Named-action identifiers are strings after normalization. */
function actionName(value: Value): string {
  if (value.kind === 'string' || value.kind === 'token') return value.value;
  if (value.kind === 'number') return String(value.value);
  if (value.kind === 'boolean') return String(value.value);
  if (value.kind === 'binding') return value.path;
  return value.value.join(',');
}

/** True when any node in the tree uses a semantic event prop (e.g. change=). */
function usesEvents(nodes: Node[], registry: Registry): boolean {
  for (const n of nodes) {
    if (n.kind === 'component') {
      const spec = registry[n.type];
      if (spec?.events && n.props.some((p) => spec.events![p.key])) return true;
      if (usesEvents(n.children, registry)) return true;
    } else if (n.kind === 'if') {
      if (usesEvents(n.then, registry)) return true;
      if (n.else && usesEvents(n.else, registry)) return true;
    } else if (usesEvents(n.body, registry)) {
      return true;
    }
  }
  return false;
}

/** True when the tree needs a Fragment import (keyed multi-child loops). */
function needsFragmentImport(nodes: Node[]): boolean {
  for (const n of nodes) {
    if (n.kind === 'for') {
      if (n.body.length !== 1 || n.body[0].kind !== 'component') return true;
      if (needsFragmentImport(n.body)) return true;
    } else if (n.kind === 'if') {
      if (needsFragmentImport(n.then)) return true;
      if (n.else && needsFragmentImport(n.else)) return true;
    } else {
      if (needsFragmentImport(n.children)) return true;
    }
  }
  return false;
}

/**
 * Compile a document to React + TSX. Accepts a canonical IR document or a
 * raw document (which is normalized on the fly). For strict,
 * validated compilation use `compile()` from compile.ts.
 */
export function compileReact(doc: CanonicalDocument | { rootNodes: unknown[] } & Record<string, unknown>, opts: CompileOptions = {}): string {
  const registry = opts.registry ?? CORE_REGISTRY;
  let canonical: CanonicalDocument;
  if (doc.rootNodes.length > 0 && typeof doc.rootNodes[0] === 'object' && doc.rootNodes[0] !== null && 'kind' in (doc.rootNodes[0] as object)) {
    canonical = doc as CanonicalDocument;
  } else {
    const result = normalize(doc as unknown as import('./ast.ts').RawDocument, { registry });
    canonical = result.value!;
  }

  const roots = canonical.rootNodes;
  const defs = new Map((canonical.components ?? []).map((d) => [d.name, d]));
  const ctx: Ctx = { defs, paramScope: new Set(), registry, inLoop: false };

  const page = roots.find((n) => n.kind === 'component' && n.type === 'Page');
  const titleProp = page && page.kind === 'component' ? page.props.find((p) => p.key === 'title') : undefined;
  const titleValue =
    titleProp && (titleProp.value.kind === 'string' || titleProp.value.kind === 'token') ? titleProp.value.value : undefined;
  const pageLabel = page && page.kind === 'component' ? page.label ?? titleValue : undefined;
  const componentName = opts.componentName || pageLabel || 'View';
  const name =
    componentName
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('') || 'View';

  const used = new Set<string>();
  collectComponents(roots, defs, used);
  for (const def of canonical.components ?? []) collectComponents(def.children, defs, used);

  const importedNames = new Set<string>();
  const importLines: string[] = [];
  for (const decl of canonical.imports ?? []) {
    const names = [...(decl.defaultName ? [decl.defaultName] : []), ...decl.names];
    names.forEach((n) => importedNames.add(n));
    if (decl.sideEffect) {
      importLines.push(`import "${decl.source}"`);
    } else if (decl.names.length > 0) {
      importLines.push(`import ${decl.defaultName ? decl.defaultName + ', ' : ''}{ ${decl.names.join(', ')} } from "${decl.source}"`);
    } else {
      importLines.push(`import ${decl.defaultName ?? ''} from "${decl.source}"`.replace(/\s{2,}/g, ' '));
    }
  }

  // Registry-derived imports, grouped and deduplicated.
  const bySource = new Map<string, { export: string; nodeName: string }[]>();
  const toImport = [...used].filter((n) => !importedNames.has(n) && !defs.has(n)).sort();
  for (const nodeName of toImport) {
    const mapping = importFor(registry, nodeName);
    const entry = { export: mapping.export, nodeName };
    const list = bySource.get(mapping.source) ?? [];
    list.push(entry);
    bySource.set(mapping.source, list);
  }
  const registryImportLines = [...bySource.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([source, entries]) => {
      const names = entries
        .map((e) => (e.export === e.nodeName ? e.export : `${e.export} as ${e.nodeName}`))
        .sort();
      return `import { ${names.join(', ')} } from "${source}"`;
    });

  const needsFragment = needsFragmentImport(roots) || (canonical.components ?? []).some((d) => needsFragmentImport(d.children));
  const header: string[] = [];
  if (needsFragment) header.push(`import { Fragment } from 'react'`);
  for (const line of registryImportLines) header.push(line);
  for (const line of importLines) header.push(line);

  const defBlocks = (canonical.components ?? []).map((d) => renderDef(d, ctx));
  const body = renderJsxChildren(roots, ctx);
  const hasEvents =
    usesEvents(roots, registry) || (canonical.components ?? []).some((d) => usesEvents(d.children, registry));
  const onActionType = hasEvents ? '(name: string, payload?: unknown) => void' : '(name: string) => void';

  return [
    ...header,
    ...(header.length ? [''] : []),
    ...defBlocks,
    `export function ${name}({ data, onAction }: { data: any; onAction: ${onActionType} }) {`,
    `  return (`,
    indentLines(body, '    '),
    `  )`,
    `}`,
    ``,
  ].join('\n');
}

export type { CanonicalDocument };
