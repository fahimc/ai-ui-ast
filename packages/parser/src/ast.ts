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

export interface Document {
  rootNodes: Node[];
}
