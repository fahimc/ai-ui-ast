import type {
  CanonicalDocument,
  ComponentDef,
  ComponentNode,
  ComponentParam,
  ForNode,
  IfNode,
  Node,
  Prop,
  RawComponentDef,
  RawDocument,
  RawNode,
  RawValue,
  Value,
} from './ast.ts';
import type { Diagnostic } from './diagnostics.ts';
import { DiagnosticCode, error } from './diagnostics.ts';
import { CORE_REGISTRY } from './registry.ts';
import type { Registry } from './registry.ts';
import { DEFAULT_LIMITS } from './validate.ts';

export interface NormalizeOptions {
  registry?: Registry;
  maxDepth?: number;
  maxNodes?: number;
}

export interface Result<T> {
  ok: boolean;
  value?: T;
  diagnostics: Diagnostic[];
}

/**
 * Normalize a raw document into the canonical IR:
 *
 *  - bare values are classified against registry prop metadata (token / list
 *    / string) — compilers never guess semantics from strings,
 *  - `If`/`Else` become an explicit `IfNode` with `then`/`else`,
 *  - `For` becomes a `ForNode` with `body`,
 *  - def params carry one unified model with typed defaults.
 *
 * Compilers and previews consume the canonical IR only.
 */
export function normalize(doc: RawDocument, options: NormalizeOptions = {}): Result<CanonicalDocument> {
  const registry = options.registry ?? CORE_REGISTRY;
  const maxDepth = options.maxDepth ?? DEFAULT_LIMITS.maxDepth;
  const maxNodes = options.maxNodes ?? DEFAULT_LIMITS.maxNodes;
  const diagnostics: Diagnostic[] = [];
  let nodeCount = 0;

  const defs = new Map<string, RawComponentDef>((doc.components ?? []).map((d) => [d.name, d]));

  const splitList = (raw: string): string[] => raw.split(',').map((s) => s.trim()).filter(Boolean);
  const normalizeValue = (raw: RawValue, propType?: string): Value => {
    switch (raw.kind) {
      case 'string':
        // A quoted list prop (`options="Pro,Team"`) is split on commas.
        if (propType === 'list') return { kind: 'list', value: splitList(raw.value) };
        return { kind: 'string', value: raw.value };
      case 'binding':
        return { kind: 'binding', path: raw.path };
      case 'number':
        return { kind: 'number', value: raw.value };
      case 'boolean':
        return { kind: 'boolean', value: raw.value };
      case 'bare': {
        if (propType === 'token') return { kind: 'token', value: raw.value };
        if (propType === 'list') return { kind: 'list', value: splitList(raw.value) };
        if (propType === 'boolean') return { kind: 'boolean', value: raw.value === 'true' };
        return { kind: 'string', value: raw.value };
      }
    }
  };

  const normalizeParam = (param: ComponentParam<RawValue>): ComponentParam<Value> => ({
    name: param.name,
    required: param.required,
    ...(param.defaultValue !== undefined ? { defaultValue: normalizeValue(param.defaultValue) } : {}),
  });

  const walk = (nodes: RawNode[], depth: number): Node[] => {
    if (depth > maxDepth) {
      diagnostics.push(error(DiagnosticCode.TOO_DEEP, `Nesting exceeds the limit of ${maxDepth} levels during normalization.`, nodes[0]?.line ?? 1));
      return [];
    }
    const out: Node[] = [];
    for (const raw of nodes) {
      nodeCount += 1;
      if (nodeCount > maxNodes) {
        diagnostics.push(error(DiagnosticCode.TOO_MANY_NODES, `Node count exceeds the limit of ${maxNodes} during normalization.`, raw.line));
        return out;
      }

      // Structural: If with an attached Else.
      if (raw.type === 'If') {
        const condProp = raw.props.find((p) => p.key === 'condition');
        const condition: Value = condProp ? normalizeValue(condProp.value) : { kind: 'boolean', value: true };
        const elseIdx = raw.children.findIndex((c) => c.type === 'Else');
        const then = walk(raw.children.filter((_, i) => i !== elseIdx), depth + 1);
        const elseNode = elseIdx >= 0 ? raw.children[elseIdx] : undefined;
        const ifNode: IfNode = {
          kind: 'if',
          condition,
          then,
          ...(elseNode ? { else: walk(elseNode.children, depth + 1) } : {}),
          line: raw.line,
        };
        out.push(ifNode);
        continue;
      }

      // Structural: For.
      if (raw.type === 'For') {
        const listProp = raw.props.find((p) => p.key === 'each' || p.key === 'in');
        const each: Value = listProp ? normalizeValue(listProp.value) : { kind: 'binding', path: 'items' };
        const forNode: ForNode = {
          kind: 'for',
          each,
          body: walk(raw.children.filter((c) => c.type !== 'Else'), depth + 1),
          line: raw.line,
        };
        out.push(forNode);
        continue;
      }

      // Component (registry, imported, def usage, or unknown — incl. orphan
      // Else, which validation flags).
      const def = defs.get(raw.type);
      const spec = registry[raw.type];
      const props: Prop[] = raw.props.map((p) => {
        const propSpec = spec?.props[p.key];
        const isEvent = spec?.events && spec.events[p.key];
        // Event props are named-action identifiers; propType undefined keeps
        // bare values as plain strings.
        return { key: p.key, value: normalizeValue(p.value, isEvent ? undefined : propSpec?.type) };
      });
      const node: ComponentNode = {
        kind: 'component',
        type: raw.type,
        props,
        ...(raw.label !== undefined ? { label: raw.label } : {}),
        ...(raw.textContent !== undefined ? { textContent: raw.textContent } : {}),
        children: walk(raw.children, depth + 1),
        line: raw.line,
      };
      void def;
      out.push(node);
    }
    return out;
  };

  const components: ComponentDef[] = (doc.components ?? []).map((d): ComponentDef => ({
    name: d.name,
    params: d.params.map(normalizeParam),
    children: walk(d.children, 1),
    line: d.line,
  }));

  const canonical: CanonicalDocument = {
    rootNodes: walk(doc.rootNodes, 1),
    ...(doc.imports && doc.imports.length > 0 ? { imports: doc.imports } : {}),
    ...(components.length > 0 ? { components } : {}),
  };

  return { ok: diagnostics.length === 0, value: canonical, diagnostics };
}
