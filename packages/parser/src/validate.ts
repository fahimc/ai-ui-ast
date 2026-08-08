import type { RawComponentDef, RawDocument, RawNode, RawValue } from './ast.ts';
import { dangerousSegment, isValidBindingPath } from './bindings.ts';
import type { Diagnostic } from './diagnostics.ts';
import { DiagnosticCode, error, info, warning } from './diagnostics.ts';
import { scan } from './lexer.ts';
import type { Token } from './lexer.ts';
import { CORE_REGISTRY, RESERVED_NODES, STRUCTURAL_NODES } from './registry.ts';
import type { NodeDefinition, Registry } from './registry.ts';

export interface ResourceLimits {
  maxSourceBytes: number;
  maxLines: number;
  maxDepth: number;
  maxNodes: number;
  maxPropsPerNode: number;
  maxDefs: number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxSourceBytes: 200_000,
  maxLines: 5_000,
  maxDepth: 100,
  maxNodes: 2_000,
  maxPropsPerNode: 30,
  maxDefs: 100,
};

export type ImportMode = 'registry' | 'explicit' | 'allow';

export interface ValidateOptions {
  /** Component registry. Defaults to CORE_REGISTRY. */
  registry?: Registry;
  /**
   * 'strict' (default): tabs are errors, indentation must move in exact
   * indent-width steps. 'llm': the unit is inferred from the first nested
   * line and inconsistencies are warnings.
   */
  indentMode?: 'strict' | 'llm';
  /** Indentation width used by strict mode. Default 2. */
  indentWidth?: number;
  /**
   * Import policy.
   *   - { mode: 'registry' } (default): explicit `import` lines are rejected;
   *     third-party components must be registered.
   *   - { mode: 'explicit', allow: ['recharts'] }: explicit imports allowed
   *     only from the allow-listed sources.
   *   - { unsafeImports: true }: any import passes through (compat mode).
   */
  imports?: { mode: ImportMode; allow?: string[] } | { unsafeImports?: boolean };
  /** Resource limits for untrusted/model-generated input. */
  limits?: Partial<ResourceLimits>;
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER_RE.test(name);
}

function valueText(v: RawValue): string {
  switch (v.kind) {
    case 'string':
      return v.value;
    case 'binding':
      return '$' + v.path;
    case 'number':
      return String(v.value);
    case 'boolean':
      return String(v.value);
    case 'bare':
      return v.value;
  }
}

export function validate(input: string, options: ValidateOptions = {}): Diagnostic[] {
  const registry = options.registry ?? CORE_REGISTRY;
  const indentMode = options.indentMode ?? 'strict';
  const indentWidth = options.indentWidth ?? 2;
  const importPolicy = options.imports ?? { mode: 'registry' as ImportMode };
  const unsafeImports = 'unsafeImports' in importPolicy && importPolicy.unsafeImports === true;
  const importMode = 'mode' in importPolicy ? importPolicy.mode : unsafeImports ? 'allow' : 'registry';
  const allowList = 'allow' in importPolicy ? importPolicy.allow ?? [] : [];
  const limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };
  const diags: Diagnostic[] = [];

  // ── Resource limits (fail fast, before any deeper walk) ───────────────
  const bytes = Buffer.byteLength(input, 'utf8');
  if (bytes > limits.maxSourceBytes) {
    diags.push(
      error(DiagnosticCode.SOURCE_TOO_LARGE, `Source is ${bytes} bytes; the limit is ${limits.maxSourceBytes}.`, 1, undefined, 'Reduce the source size.'),
    );
    return diags;
  }
  const lineCount = input.split('\n').length;
  if (lineCount > limits.maxLines) {
    diags.push(error(DiagnosticCode.TOO_MANY_LINES, `Source has ${lineCount} lines; the limit is ${limits.maxLines}.`, 1));
    return diags;
  }

  // ── Lexical pass ───────────────────────────────────────────────────────
  const { tokens, diagnostics: lexDiags } = scan(input);
  diags.push(...lexDiags);

  const doc: RawDocument = { rootNodes: [], imports: [], components: [] };
  buildTree(tokens, doc);

  // ── Indentation pass ───────────────────────────────────────────────────
  indentDiagnostics(tokens, diags, { indentMode, indentWidth });

  // ── Declaration pass ───────────────────────────────────────────────────
  const defs = new Map<string, RawComponentDef>();
  for (const def of doc.components ?? []) {
    if (defs.has(def.name)) {
      diags.push(error(DiagnosticCode.DUPLICATE_DEF, `Duplicate component definition "${def.name}".`, def.line, undefined, 'Rename one of the defs.'));
    }
    defs.set(def.name, def);
    if (!isValidIdentifier(def.name)) {
      diags.push(
        error(DiagnosticCode.INVALID_IDENTIFIER, `Component definition name "${def.name}" is not a valid identifier.`, def.line, undefined, 'Use letters, digits and underscores, starting with a letter.'),
      );
    } else if (/^[a-z]/.test(def.name)) {
      diags.push(info(DiagnosticCode.INVALID_IDENTIFIER, `Component definition "${def.name}" starts with a lowercase letter; PascalCase is conventional.`, def.line));
    }
    const seen = new Set<string>();
    for (const p of def.params) {
      if (seen.has(p.name)) {
        diags.push(error(DiagnosticCode.DUPLICATE_PARAM, `Duplicate parameter "${p.name}" in def "${def.name}".`, def.line, undefined, 'Remove the duplicate parameter.'));
      }
      seen.add(p.name);
      if (!isValidIdentifier(p.name)) {
        diags.push(error(DiagnosticCode.INVALID_IDENTIFIER, `Parameter "${p.name}" in def "${def.name}" is not a valid identifier.`, def.line));
      }
      if (p.name === 'item' || p.name === 'index' || p.name === 'root') {
        diags.push(error(DiagnosticCode.INVALID_IDENTIFIER, `Parameter "${p.name}" is reserved in def "${def.name}".`, def.line, undefined, 'Rename the parameter.'));
      }
    }
    if (registry[def.name]) {
      diags.push(
        warning(DiagnosticCode.COLLISION, `Def "${def.name}" shadows a core registry component.`, def.line, undefined, 'Rename the def to avoid surprising renderers.'),
      );
    }
  }

  const importedNames = new Set<string>();
  for (const decl of doc.imports ?? []) {
    const all = [...(decl.defaultName ? [decl.defaultName] : []), ...decl.names];
    for (const n of all) {
      if (!isValidIdentifier(n)) {
        diags.push(error(DiagnosticCode.INVALID_IDENTIFIER, `Imported name "${n}" is not a valid identifier.`, 0));
      }
      if (defs.has(n)) {
        diags.push(warning(DiagnosticCode.COLLISION, `Imported name "${n}" collides with a def.`, 0, undefined, 'Rename one of them.'));
      }
    }
    for (const n of all) importedNames.add(n);
  }

  // ── Import policy ──────────────────────────────────────────────────────
  for (const decl of doc.imports ?? []) {
    const line = importLineFor(tokens, decl.source);
    if (unsafeImports || importMode === 'explicit' || importMode === 'allow') {
      if (importMode === 'explicit' && allowList.length > 0 && !allowList.includes(decl.source)) {
        diags.push(
          error(
            DiagnosticCode.COLLISION,
            `Import from "${decl.source}" is not allow-listed.`,
            line,
            undefined,
            `Add "${decl.source}" to imports.allow, or register the components in the registry.`,
          ),
        );
      }
      continue;
    }
    // registry mode: explicit imports are rejected
    diags.push(
      error(
        DiagnosticCode.COLLISION,
        `Explicit import from "${decl.source}" is not allowed in registry-only mode.`,
        line,
        undefined,
        `Register the component in the registry (e.g. defineRegistry({ ... })) instead of writing an import line.`,
      ),
    );
  }

  // ── Page / structural sanity ───────────────────────────────────────────
  const pages = doc.rootNodes.filter((n) => n.type === 'Page');
  if (pages.length > 1) {
    for (const p of pages.slice(1)) {
      diags.push(
        error(DiagnosticCode.MULTIPLE_PAGE_ROOTS, `Multiple Page roots in one source. v0.2 compiles one page per source file.`, p.line, undefined, 'Split into separate files.'),
      );
    }
  }

  // ── Tree walk: nodes, props, structure, bindings ───────────────────────
  let nodeCount = 0;
  const walk = (nodes: RawNode[], depth: number, parentType: string | undefined): void => {
    if (depth > limits.maxDepth) {
      diags.push(error(DiagnosticCode.TOO_DEEP, `Nesting exceeds the limit of ${limits.maxDepth} levels.`, nodes[0]?.line ?? 1, undefined, 'Flatten the tree.'));
      return;
    }
    for (const node of nodes) {
      nodeCount += 1;
      if (nodeCount > limits.maxNodes) {
        diags.push(error(DiagnosticCode.TOO_MANY_NODES, `Node count exceeds the limit of ${limits.maxNodes}.`, node.line));
        return;
      }
      if (node.props.length > limits.maxPropsPerNode) {
        diags.push(
          error(DiagnosticCode.TOO_MANY_PROPS, `<${node.type}> has ${node.props.length} props; the limit is ${limits.maxPropsPerNode}.`, node.line, undefined, 'Split the node or reduce props.'),
        );
      }

      validateNode(node, { registry, defs, importedNames, parentType, diags });
      walk(node.children, depth + 1, node.type);
    }
  };
  walk(doc.rootNodes, 1, undefined);
  for (const def of doc.components ?? []) walk(def.children, 1, undefined);

  if (doc.components && doc.components.length > limits.maxDefs) {
    diags.push(error(DiagnosticCode.TOO_MANY_DEFS, `Component definition count exceeds the limit of ${limits.maxDefs}.`, 1));
  }

  // Best-effort columns: where a diagnostic has no column, point at the
  // first non-whitespace character of its line (the start of the node).
  const sourceLines = input.split('\n');
  for (const d of diags) {
    if (d.column !== undefined) continue;
    const lineText = sourceLines[d.line - 1];
    if (lineText === undefined) continue;
    const leading = lineText.match(/^\s*/)?.[0] ?? '';
    d.column = leading.length + 1;
  }

  return diags;
}

interface NodeCheckCtx {
  registry: Registry;
  defs: Map<string, RawComponentDef>;
  importedNames: Set<string>;
  parentType: string | undefined;
  diags: Diagnostic[];
}

function validateNode(node: RawNode, ctx: NodeCheckCtx): void {
  const { registry, defs, importedNames, parentType, diags } = ctx;
  // Text content may contain `$bindings` — validate their paths too.
  if (node.textContent !== undefined) {
    const match = node.textContent.match(/\$([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)/g) ?? [];
    for (const m of match) {
      const path = m.slice(1);
      if (!isValidBindingPath(path)) {
        diags.push(error(DiagnosticCode.INVALID_IDENTIFIER, `Binding "${m}" is not a valid path.`, node.line, undefined, 'Use dotted identifiers, e.g. $user.name.'));
      }
      const dangerous = dangerousSegment(path);
      if (dangerous) {
        diags.push(error(DiagnosticCode.BINDING_DANGEROUS, `Binding "${m}" uses the forbidden segment "${dangerous}".`, node.line, undefined, 'Bindings are data references, never prototype access.'));
      }
    }
  }
  const d = (code: string, message: string, suggestion?: string, severity: 'error' | 'warning' | 'info' = 'error') =>
    severity === 'error' ? error(code, message, node.line, undefined, suggestion) : severity === 'warning' ? warning(code, message, node.line, undefined, suggestion) : info(code, message, node.line, undefined, suggestion);

  // Reserved-but-unimplemented nodes.
  if (RESERVED_NODES[node.type]) {
    diags.push(error(DiagnosticCode.STATE_RESERVED, `<${node.type}>: ${RESERVED_NODES[node.type]}`, node.line));
    return;
  }

  // Structural constructs.
  if (node.type === 'If') {
    const cond = node.props.find((p) => p.key === 'condition');
    if (!cond) {
      diags.push(warning(DiagnosticCode.MISSING_REQUIRED_PROP, '<If> has no condition= binding; it will always render.', node.line, undefined, 'Add condition=$someBinding.'));
    } else {
      checkBindingValue(cond.value, diags, node.line, 'condition');
    }
    validateDuplicateProps(node, diags);
    checkStructuralElse(node, diags);
    return;
  }
  if (node.type === 'For') {
    const list = node.props.find((p) => p.key === 'each' || p.key === 'in');
    if (!list) {
      diags.push(error(DiagnosticCode.FOR_MISSING_LIST, '<For> needs each=$list (or in=$list) to iterate.', node.line, undefined, 'Add each=$items.'));
    } else if (list.value.kind !== 'binding') {
      diags.push(error(DiagnosticCode.FOR_MISSING_LIST, '<For> list must be a binding, got "${' + valueText(list.value) + '}".', node.line, undefined, 'Use each=$items.'));
    } else {
      checkBindingValue(list.value, diags, node.line, 'each');
    }
    validateDuplicateProps(node, diags);
    checkStructuralElse(node, diags);
    return;
  }
  if (node.type === 'Else') {
    if (parentType === 'Else') {
      diags.push(error(DiagnosticCode.NESTED_ELSE, '<Else> cannot be nested inside another <Else>.', node.line));
    } else if (parentType !== 'If') {
      diags.push(
        error(DiagnosticCode.ORPHAN_ELSE, '<Else> is not attached to an <If>. It must appear at the same indentation as a preceding <If>.', node.line, undefined, 'Move it under an If at the same indent.'),
      );
    }
    return;
  }

  // Component-template usage.
  const def = defs.get(node.type);
  if (def) {
    const params = new Map(def.params.map((p) => [p.name, p]));
    const seen = new Set<string>();
    for (const prop of node.props) {
      if (seen.has(prop.key)) {
        diags.push(d(DiagnosticCode.DUPLICATE_PROP, `<${node.type}> has duplicate prop "${prop.key}".`, 'Remove the duplicate.'));
      }
      seen.add(prop.key);
      if (!params.has(prop.key)) {
        diags.push(
          warning(DiagnosticCode.UNKNOWN_PARAM, `<${node.type}> has no param "${prop.key}". Declared params: ${[...params.keys()].join(', ') || 'none'}.`, node.line, undefined, 'Use a declared param.'),
        );
      }
    }
    for (const param of def.params) {
      if (param.required && !seen.has(param.name)) {
        diags.push(
          warning(DiagnosticCode.MISSING_REQUIRED_PARAM, `<${node.type}> is missing required param "${param.name}".`, node.line, undefined, `Add ${param.name}=…`),
        );
      }
    }
    return;
  }

  // Imported third-party component: names pass through; props are not
  // validated unless the registry knows them.
  if (importedNames.has(node.type)) {
    validateDuplicateProps(node, diags);
    checkChildrenConstraint(node, 'any', diags);
    return;
  }

  if (!isValidIdentifier(node.type)) {
    diags.push(d(DiagnosticCode.INVALID_IDENTIFIER, `Node type "${node.type}" is not a valid identifier.`, 'Use letters, digits and underscores.'));
    return;
  }

  const spec = registry[node.type];
  if (!spec) {
    diags.push(
      error(DiagnosticCode.UNKNOWN_NODE, `Unknown component "${node.type}". Not part of the registry.`, node.line, undefined, 'Use a registered component or add it to the registry.'),
    );
    return;
  }

  validateRegistryNode(node, spec, diags);
}

function validateRegistryNode(node: RawNode, spec: NodeDefinition, diags: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const prop of node.props) {
    if (seen.has(prop.key)) {
      diags.push(error(DiagnosticCode.DUPLICATE_PROP, `<${node.type}> has duplicate prop "${prop.key}".`, node.line, undefined, 'Remove the duplicate.'));
    }
    seen.add(prop.key);
    const propSpec = spec.props[prop.key];
    if (!propSpec) {
      if (spec.events && spec.events[prop.key]) {
        // semantic event prop: value must be a named action identifier
        const ev = spec.events[prop.key];
        if (prop.value.kind !== 'bare' && prop.value.kind !== 'string') {
          diags.push(
            warning(DiagnosticCode.INVALID_PROP_TYPE, `<${node.type}> ${prop.key}= should be a named action identifier, e.g. ${prop.key}=nameChanged.`, node.line),
          );
        }
        void ev;
        continue;
      }
      diags.push(
        warning(
          DiagnosticCode.UNKNOWN_PROP,
          `<${node.type}> has no prop "${prop.key}". Valid props: ${Object.keys(spec.props).join(', ') || 'none'}.`,
          node.line,
          undefined,
          'Use a declared prop.',
        ),
      );
      continue;
    }
    checkPropValue(node, prop.key, prop.value, propSpec, diags);
  }

  for (const [name, propSpec] of Object.entries(spec.props)) {
    if (propSpec.required && !seen.has(name)) {
      diags.push(error(DiagnosticCode.MISSING_REQUIRED_PROP, `<${node.type}> is missing required prop "${name}".`, node.line, undefined, `Add ${name}=…`));
    }
  }

  checkChildrenConstraint(node, spec.children, diags);
}

function checkPropValue(node: RawNode, key: string, value: RawValue, propSpec: { type: string; tokens?: string[] }, diags: Diagnostic[]): void {
  const text = valueText(value);
  if (propSpec.type === 'token') {
    if (value.kind === 'binding') {
      checkBindingValue(value, diags, node.line, key);
      return;
    }
    if (value.kind === 'number' || value.kind === 'boolean') {
      diags.push(warning(DiagnosticCode.INVALID_PROP_TYPE, `<${node.type}> prop "${key}" expects a token, got ${value.kind} "${text}".`, node.line, undefined, 'Use a bare token value.'));
      return;
    }
    if (propSpec.tokens && !propSpec.tokens.includes(text)) {
      diags.push(
        error(
          DiagnosticCode.INVALID_TOKEN,
          `<${node.type}> prop "${key}=${text}" is invalid. Expected one of: ${propSpec.tokens.join(', ')}.`,
          node.line,
          undefined,
          `Use ${key}=${propSpec.tokens[0]}.`,
        ),
      );
    }
    return;
  }
  if (propSpec.type === 'number') {
    if (value.kind === 'number') return;
    if (value.kind === 'binding') {
      checkBindingValue(value, diags, node.line, key);
      return;
    }
    if (value.kind === 'string' || value.kind === 'bare') {
      if (/^-?\d+(\.\d+)?$/.test(text)) return; // "280" is a number even when quoted
      diags.push(warning(DiagnosticCode.INVALID_PROP_TYPE, `<${node.type}> prop "${key}" expects a number, got "${text}".`, node.line));
    }
    return;
  }
  if (propSpec.type === 'boolean') {
    if (value.kind === 'boolean') return;
    if (value.kind === 'binding') {
      checkBindingValue(value, diags, node.line, key);
      return;
    }
    diags.push(warning(DiagnosticCode.INVALID_PROP_TYPE, `<${node.type}> prop "${key}" expects true/false or a $binding, got "${text}".`, node.line));
    return;
  }
  if (propSpec.type === 'binding') {
    if (value.kind === 'binding') checkBindingValue(value, diags, node.line, key);
    return;
  }
  // string / list accept anything; list props validate shape.
  if (propSpec.type === 'list' && value.kind === 'number') {
    diags.push(warning(DiagnosticCode.INVALID_PROP_TYPE, `<${node.type}> prop "${key}" expects a comma-separated list, got a number.`, node.line));
  }
}

function checkBindingValue(value: RawValue, diags: Diagnostic[], line: number, key: string): void {
  if (value.kind !== 'binding') return;
  if (!isValidBindingPath(value.path)) {
    diags.push(error(DiagnosticCode.INVALID_IDENTIFIER, `Binding "${'$' + value.path}" is not a valid path.`, line, undefined, 'Use dotted identifiers, e.g. $user.name.'));
  }
  const dangerous = dangerousSegment(value.path);
  if (dangerous) {
    diags.push(
      error(DiagnosticCode.BINDING_DANGEROUS, `Binding "${'$' + value.path}" uses the forbidden segment "${dangerous}".`, line, undefined, 'Bindings are data references, never prototype access.'),
    );
  }
}

function validateDuplicateProps(node: RawNode, diags: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const prop of node.props) {
    if (seen.has(prop.key)) {
      diags.push(error(DiagnosticCode.DUPLICATE_PROP, `<${node.type}> has duplicate prop "${prop.key}".`, node.line, undefined, 'Remove the duplicate.'));
    }
    seen.add(prop.key);
  }
}

function checkStructuralElse(node: RawNode, diags: Diagnostic[]): void {
  const elses = node.children.filter((c) => c.type === 'Else');
  if (elses.length > 1) {
    for (const e of elses.slice(1)) {
      diags.push(error(DiagnosticCode.DUPLICATE_ELSE, '<If> has more than one <Else> branch.', e.line, undefined, 'Merge the else branches.'));
    }
  }
}

function checkChildrenConstraint(node: RawNode, constraint: NodeDefinition['children'] | undefined, diags: Diagnostic[]): void {
  const resolved = constraint ?? 'nodes';
  const hasElementChildren = node.children.length > 0;
  const hasText = node.textContent !== undefined;

  if (resolved === 'none') {
    if (hasElementChildren) {
      diags.push(error(DiagnosticCode.CHILD_CONSTRAINT, `<${node.type}> cannot have child nodes.`, node.line, undefined, 'Remove the children.'));
    }
    if (hasText) {
      diags.push(warning(DiagnosticCode.TEXT_CONSTRAINT, `<${node.type}> does not take text content.`, node.line, undefined, 'Move the text out.'));
    }
    return;
  }
  if (resolved === 'text') {
    if (hasElementChildren) {
      diags.push(error(DiagnosticCode.CHILD_CONSTRAINT, `<${node.type}> takes text content only, not child nodes.`, node.line, undefined, 'Use a quoted string as text.'));
    }
    return;
  }
  if (resolved === 'nodes') {
    if (hasText) {
      diags.push(warning(DiagnosticCode.TEXT_CONSTRAINT, `<${node.type}> takes child nodes, not text content.`, node.line, undefined, 'Nest a Text node instead.'));
    }
    return;
  }
  // 'any': no constraint.
}

// ── Tree building (shared with parser; kept local to validate) ─────────────

function buildTree(tokens: Token[], doc: RawDocument): void {
  interface Container {
    children: RawNode[];
  }
  const root: Container = { children: doc.rootNodes };
  const stack: { indent: number; container: Container }[] = [];

  for (const token of tokens) {
    if (token.importDecl) {
      doc.imports!.push(token.importDecl);
      continue;
    }
    if (token.type === 'def') {
      while (stack.length > 0 && stack[stack.length - 1].indent >= token.indent) stack.pop();
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
      props: token.props.map((p) => ({ key: p.key, value: p.value })),
      label: token.label,
      textContent: token.textContent,
      children: [],
      line: token.line,
    };
    const minIndent = token.type === 'Else' ? token.indent + 1 : token.indent;
    while (stack.length > 0 && stack[stack.length - 1].indent >= minIndent) stack.pop();
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
}

function importLineFor(tokens: Token[], source: string): number {
  return tokens.find((t) => t.importDecl?.source === source)?.line ?? 0;
}

// ── Indentation ────────────────────────────────────────────────────────────

function indentDiagnostics(
  tokens: Token[],
  diags: Diagnostic[],
  opts: { indentMode: 'strict' | 'llm'; indentWidth: number },
): void {
  const { indentMode, indentWidth } = opts;
  if (tokens.length === 0) return;

  const hasTabs = tokens.some((t) => t.indentHasTab);
  if (hasTabs) {
    const first = tokens.find((t) => t.indentHasTab)!;
    const code = DiagnosticCode.INDENT_MIXED_TABS_SPACES;
    if (indentMode === 'strict') {
      diags.push(error(code, `Line ${first.line} uses a tab in its indentation. Strict mode requires spaces only.`, first.line, undefined, 'Replace tabs with spaces.'));
    } else {
      diags.push(warning(code, `Line ${first.line} uses a tab in its indentation. Prefer spaces for consistent nesting.`, first.line));
    }
  }

  // Infer the unit in LLM mode from the first nested transition.
  let unit = indentWidth;
  if (indentMode === 'llm') {
    const nested = tokens.find((t, i) => i > 0 && t.indent > 0);
    if (nested && nested.indent % indentWidth === 0) unit = indentWidth;
  }

  const stack: number[] = [];
  for (const token of tokens) {
    if (token.type === 'import' || token.type === 'def') {
      if (token.indent !== 0) {
        diags.push(error(DiagnosticCode.INDENT_INCONSISTENT, `Line ${token.line}: ${token.type} declarations must start at column 0.`, token.line, undefined, 'Remove the leading whitespace.'));
      }
      if (token.type === 'def') stack.push(0);
      continue;
    }

    const minIndent = token.type === 'Else' ? token.indent + 1 : token.indent;
    while (stack.length > 0 && stack[stack.length - 1] >= minIndent) stack.pop();

    if (stack.length === 0) {
      if (token.indent !== 0) {
        diags.push(error(DiagnosticCode.INDENT_INCONSISTENT, `Line ${token.line}: root nodes must start at column 0 (found ${token.indent}).`, token.line, undefined, 'Remove the leading whitespace.'));
      }
      stack.push(token.indent);
      continue;
    }

    const parentIndent = stack[stack.length - 1];
    const delta = token.indent - parentIndent;
    if (delta % unit !== 0) {
      const code = DiagnosticCode.INDENT_INCONSISTENT;
      const msg = `Line ${token.line}: indentation ${token.indent} is not a multiple of ${unit} past its parent (${parentIndent}).`;
      if (indentMode === 'strict') {
        diags.push(error(code, msg, token.line, undefined, `Indent by ${unit} spaces per nesting level.`));
      } else {
        diags.push(warning(code, msg, token.line, undefined, `Indent by ${unit} spaces per nesting level.`));
      }
    } else if (delta > unit) {
      const code = DiagnosticCode.INDENT_INCONSISTENT;
      const msg = `Line ${token.line}: indentation jumps ${delta} spaces in one level (expected exactly ${unit}).`;
      if (indentMode === 'strict') {
        diags.push(error(code, msg, token.line, undefined, `Indent by exactly ${unit} spaces per nesting level.`));
      } else {
        diags.push(warning(code, msg, token.line, undefined, `Indent by exactly ${unit} spaces per nesting level.`));
      }
    }
    stack.push(token.indent);
  }
}
