export interface Prop {
  key: string;
  value: string;
}

export interface Node {
  type: string;
  props: Prop[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  textContent?: string;
  children: Node[];
}

/** `import { A, B } from "pkg"` or `import Default from "pkg"`. */
export interface ImportDecl {
  /** Named imports, e.g. `AreaChart`, `Tooltip`. */
  names: string[];
  /** Default import, e.g. `import X from "pkg"`. */
  defaultName?: string;
  /** Package specifier. */
  source: string;
}

/**
 * `def ComponentName param1 param2 prop=default`
 *
 * Bare identifiers declare required params; `key=value` declare params with
 * defaults. Inside the template, `$paramName` references a param.
 */
export interface ComponentDef {
  name: string;
  params: string[];
  defaultProps: Prop[];
  children: Node[];
}

export interface Document {
  rootNodes: Node[];
  imports?: ImportDecl[];
  components?: ComponentDef[];
}
