# API Reference

`@codedia/parser` is ESM-only (Node ≥ 18, works in the browser). It has
**zero runtime dependencies**.

```ts
import { tokenize, parse, compileReact, tokenizeText, interpolateText, resolvePath, stringifyResolved } from '@codedia/parser';
import type { Document, Node, Prop, ImportDecl, ComponentDef, Token, TextSegment } from '@codedia/parser';
```

---

## Parsing

### `tokenize(source: string): Token[]`

Lex `.aui` source into tokens — one per non-empty line. No nesting logic here;
that's the parser's job.

```ts
const tokens = tokenize('Page Dashboard\n  Stack gap=md');
// tokens[0]: { indent: 0, type: 'Page', props: [], label: 'Dashboard', line: 1 }
// tokens[1]: { indent: 2, type: 'Stack', props: [{ key: 'gap', value: 'md' }], line: 2 }
```

**`Token`**

| Field | Type | Meaning |
|---|---|---|
| `indent` | `number` | Leading whitespace count (nesting level). |
| `type` | `string` | Node type (`Page`, `Stack`, `Button`, `If`, …). |
| `props` | `Prop[]` | `key=value` pairs (`{ key: 'gap', value: 'md' }`). Values are unquoted. |
| `label` | `string?` | First bare identifier after the type, e.g. `Page CustomerDetail` → `'CustomerDetail'`. |
| `params` | `string[]?` | On `def` lines, the remaining bare identifiers (component params). |
| `importDecl` | `ImportDecl?` | Set on `import` lines (declarations, not nodes). |
| `textContent` | `string?` | Trailing quoted string or `$binding`. |
| `line` | `number` | 1-based source line. |

### `parse(source: string): Document`

Parse tokens into the canonical AST. Indentation encodes nesting; `import` and
`def` lines are collected as declarations rather than tree nodes; `Else`
attaches to its sibling `If` at the same indent.

```ts
const doc = parse(`
import { AreaChart } from "recharts"
def StatCard label value tone=default
  Card
    Text $label
Page Dashboard data=$metrics
  StatCard label="Active users" value=$metrics.active
`);
```

**`Document`**

| Field | Type | Meaning |
|---|---|---|
| `rootNodes` | `Node[]` | Top-level tree nodes. |
| `imports` | `ImportDecl[]?` | Third-party import declarations. |
| `components` | `ComponentDef[]?` | `def` component templates. |

**`Node`**

| Field | Type | Meaning |
|---|---|---|
| `type` | `string` | Node type. |
| `props` | `Prop[]` | `key=value` props. |
| `label` | `string?` | Bare identifier label (e.g. the `Page` name). |
| `textContent` | `string?` | Trailing text (quoted string or `$binding`). |
| `children` | `Node[]` | Nested nodes. |

**`Prop`** — `{ key: string; value: string }` (values are unquoted).

**`ImportDecl`** — `{ names: string[]; defaultName?: string; source: string }`.
Supports `import { A, B } from "pkg"`, `import Default from "pkg"`,
`import Default, { A } from "pkg"`, and bare side-effect `import "pkg"`.

**`ComponentDef`** — `{ name: string; params: string[]; defaultProps: Prop[]; children: Node[] }`.
`def StatCard label value tone=success` → `params: ['label','value']`,
`defaultProps: [{ key: 'tone', value: 'success' }]`.

---

## Compiling

### `compileReact(doc: Document, opts?: CompileOptions): string`

Deterministically compile a parsed `Document` into readable React + TSX.

- `opts.componentName?: string` — override the generated component name
  (defaults to the `Page` label/title, else `View`).

```ts
const tsx = compileReact(doc, { componentName: 'CustomerDashboard' });
```

The output is a contract:

- Core semantic nodes import from `@/components/ui` — your design-system
  adapter alias.
- Third-party `import` declarations pass through as written.
- `def` templates become local `function` components; usages become
  `<StatCard label="…" value={…} />` with passthrough props.
- `If`/`Else` compile to `{cond ? (…) : (…)}`; `For each=$items` compiles to
  `{data.items.map((item, i) => (…))}`.
- `action=name` compiles to `onClick={() => onAction("name")}`.
- `$bindings` resolve against a `data` prop (`$user.name` → `data.user.name`);
  inside `def` bodies, `$param` resolves to the local prop; inside `For`,
  `$item`/`$index` resolve to `item`/`i`.
- Bindings inside text (`"Welcome back, $user.name"`) are interpolated into
  JSX expressions.

See [compiler.md](compiler.md) for the full rule set.

---

## Text & binding resolution

These helpers turn `$user.name` into display values. They are pure and shared
by the compiler, the playground preview, and the regression tests.

### `tokenizeText(text: string): TextSegment[]`

Split text into literal and binding segments. Bindings start with a
letter/underscore and continue through dots, so `$0` and `Pay $129.00` stay
literal.

```ts
tokenizeText('Welcome back, $user.name');
// [{ kind: 'text', value: 'Welcome back, ' }, { kind: 'binding', value: 'user.name' }]
```

**`TextSegment`** — `{ kind: 'text' | 'binding'; value: string }`
(for bindings, `value` is the path without the `$`).

### `resolvePath(data: unknown, path: string): unknown`

Walk a dotted path through an object; returns `undefined` for missing keys.

```ts
resolvePath({ user: { name: 'Grace' } }, 'user.name'); // 'Grace'
resolvePath({}, 'user.name');                            // undefined
```

### `stringifyResolved(value: unknown): string | null`

Render a resolved value as display text — **never** `[object Object]`:

| Value | Result |
|---|---|
| `undefined` / `null` | `null` |
| string / number / boolean | `String(value)` |
| array of primitives | joined with `', '` (`'a, b'`) |
| array of objects / empty array | `String(length)` (`'3'` / `'0'`) |
| object with `name` string | `name` |
| object with `label` string | `label` |
| anything else | `null` |

### `interpolateText(text: string, resolve: (path: string) => string | null): string`

Replace `$bindings` in text. `resolve` returns the display string for a path,
or `null` to keep the `$path` literal (unresolved or no friendly string).

```ts
interpolateText('Welcome, $user.name', (p) => p === 'user.name' ? 'Grace' : null);
// 'Welcome, Grace'
```

---

## Errors & determinism

- `parse` and `tokenize` are total functions: any string produces a result.
  Validation of components/props/tokens is a separate (registry) layer, not
  part of the core parser.
- `compileReact` is a pure function — identical input always yields identical
  output. There is no random ordering, no time dependence, no ambient state.
