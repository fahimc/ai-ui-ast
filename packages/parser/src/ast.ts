/**
 * AST types for @codedia/parser v0.2.
 *
 * There are two layers:
 *
 * 1. Raw AST — the syntax-level tree produced by `parse()`. Values are
 *    classified lexically (string / binding / number / boolean / bare) but
 *    nothing semantic is inferred. `bare` values (e.g. `variant=primary`,
 *    `gap=md`) are not yet tokens or strings.
 *
 * 2. Canonical IR — the normalized tree produced by `normalize()`. Bare
 *    values are classified against the registry (token / string / list),
 *    structural nodes (`If`/`Else`/`For`) become explicit kinds, and def
 *    params carry one unified model. Compilers and previews consume this,
 *    never the raw tree.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Raw AST
// ─────────────────────────────────────────────────────────────────────────────

/** Syntax-level value kinds. The parser does not know component semantics. */
export type RawValue =
  | { kind: 'string'; value: string }
  | { kind: 'binding'; path: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'bare'; value: string };

export interface RawProp {
  key: string;
  value: RawValue;
}

export interface RawNode {
  type: string;
  props: RawProp[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  /** Trailing quoted string or bare `$binding` — the node's text content. */
  textContent?: string;
  children: RawNode[];
  /** 1-based source line, for diagnostics. */
  line: number;
}

/** `import { A, B } from "pkg"` / `import Default from "pkg"` / `import "pkg"`. */
export interface ImportDecl {
  /** Named imports, e.g. `AreaChart`, `Tooltip`. */
  names: string[];
  /** Default import, e.g. `import X from "pkg"`. */
  defaultName?: string;
  /** Package specifier. */
  source: string;
  /** True for a bare side-effect import: `import "pkg"`. */
  sideEffect?: boolean;
}

/**
 * One component parameter. `def StatCard label value tone=default` yields
 * `label`/`value` as required params and `tone` as a param with a default —
 * a single model consumed by the validator, normalizer, preview, and every
 * compiler backend.
 */
export interface ComponentParam<V = RawValue> {
  name: string;
  defaultValue?: V;
  required: boolean;
}

export interface RawComponentDef {
  name: string;
  params: ComponentParam<RawValue>[];
  children: RawNode[];
  line: number;
}

export interface RawDocument {
  rootNodes: RawNode[];
  imports?: ImportDecl[];
  components?: RawComponentDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical IR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized value kinds. `bare` is resolved against registry metadata:
 * token-typed props become `token`, list-typed props become `list`, and
 * anything else becomes a plain `string`. Bindings, numbers, and booleans
 * pass through unchanged. Compilers never guess semantics from strings.
 */
export type Value =
  | { kind: 'string'; value: string }
  | { kind: 'binding'; path: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'token'; value: string }
  | { kind: 'list'; value: string[] };

export interface Prop {
  key: string;
  value: Value;
}

export interface IfNode {
  kind: 'if';
  condition: Value;
  then: Node[];
  else?: Node[];
  line: number;
}

export interface ForNode {
  kind: 'for';
  each: Value;
  body: Node[];
  line: number;
}

export interface ComponentNode {
  kind: 'component';
  type: string;
  props: Prop[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  textContent?: string;
  children: Node[];
  line: number;
}

/** Canonical node: a registry/def component, an If, or a For. */
export type Node = ComponentNode | IfNode | ForNode;

export interface ComponentDef {
  name: string;
  params: ComponentParam<Value>[];
  children: Node[];
  line: number;
}

export interface CanonicalDocument {
  rootNodes: Node[];
  imports?: ImportDecl[];
  components?: ComponentDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility aliases (v0.1 names kept for migration; new code should use
// the Raw* names above).
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use `RawNode`. */
export type NodeV0 = RawNode;
/** @deprecated Use `RawDocument`. */
export type Document = RawDocument;
