# API Reference (v0.2)

`@codedia/parser` is ESM-only (Node ≥ 18, works in the browser). It has
**zero runtime dependencies**.

```ts
import {
  parse, scan, validate, normalize, compile, compileReact, printAui,
  defineRegistry, extendRegistry, CORE_REGISTRY,
  formatDiagnostics, formatDiagnosticsForLLM,
  tokenizeText, interpolateText, resolvePath, stringifyResolved,
  resolveBindingValue,
} from '@codedia/parser';
import type {
  RawDocument, RawNode, RawValue, CanonicalDocument, Node, Value,
  Diagnostic, Registry, NodeDefinition, ImportDecl, ComponentDef,
} from '@codedia/parser';
```

---

## High-level pipeline

### `compile(source, options?): CompileResult`

Runs parse → validate → normalize → compile. **This is the API consumers
should use** — no need to sequence low-level calls.

```ts
const result = compile(source, {
  target: 'react',        // only 'react' is implemented in v0.2
  registry,               // default CORE_REGISTRY
  strict: true,           // refuse to emit code when error-level diagnostics exist
  imports: { mode: 'registry' },   // 'registry' | { mode: 'explicit', allow: [...] } | { unsafeImports: true }
  indentMode: 'strict',   // 'strict' | 'llm'
  indentWidth: 2,
  limits: { maxDepth: 100, maxNodes: 2000, /* ... */ },
});
```

**`CompileResult`**

| Field | Meaning |
|---|---|
| `code?: string` | Generated target code (absent when strict compilation fails). |
| `rawAst: RawDocument` | The raw syntax tree. |
| `ast?: CanonicalDocument` | The canonical IR (present when normalization succeeded). |
| `diagnostics: Diagnostic[]` | All diagnostics from every stage. |
| `ok: boolean` | False when any error-level diagnostic exists. |

`compile(source, { strict: true })` returns `{ ok: false, code: undefined }`
when any error-level diagnostic exists — invalid AUI never produces code.

---

## Parsing

### `parse(source: string): RawDocument`

Parse `.aui` into the raw syntax tree. The parser is deliberately lenient:
semantic/structural problems are reported by `validate()`, not thrown. Every
node carries its 1-based `line`.

```ts
const doc = parse(`Page Dashboard data=$metrics
  Stack gap=md
    Heading level=2 "Welcome"`);
doc.rootNodes[0].type;                 // 'Page'
doc.rootNodes[0].props[0].value;       // { kind: 'binding', path: 'metrics' }
doc.rootNodes[0].children[0].line;     // 2
```

**`RawDocument`** — `{ rootNodes: RawNode[]; imports?: ImportDecl[]; components?: RawComponentDef[] }`

**`RawNode`** — `{ type: string; props: RawProp[]; label?: string; textContent?: string; children: RawNode[]; line: number }`

**`RawValue`** — the syntax-level value classification (no semantics):

```ts
type RawValue =
  | { kind: 'string'; value: string }    // "hello", label="$user.name"
  | { kind: 'binding'; path: string }    // $user.name
  | { kind: 'number'; value: number }    // level=2, min=280
  | { kind: 'boolean'; value: boolean }  // round=true
  | { kind: 'bare'; value: string };     // variant=primary, gap=md
```

**`ImportDecl`** — `{ names: string[]; defaultName?: string; source: string; sideEffect?: boolean }`.
Supports `import { A, B } from "pkg"`, `import Default from "pkg"`,
`import Default, { A } from "pkg"`, and side-effect `import "pkg"`. Aliases
(`import { A as B }`) and namespace imports are rejected with a repairable
diagnostic.

### `scan(source): { tokens, diagnostics }`

Lex `.aui` into tokens plus lexical diagnostics (unterminated strings,
malformed imports). `tokenize(source): Token[]` is the lenient compatibility
wrapper.

---

## Registry

The registry is the host-owned contract that constrains the language. Strict
compilation derives every import from it.

```ts
const registry = defineRegistry({
  AreaChart: {
    imports: { source: '@company/charts', export: 'AreaChart' },
    props: { data: { type: 'binding' }, height: { type: 'number' } },
    children: 'nodes',
  },
  Button: {
    props: {
      variant: { type: 'token', tokens: ['primary', 'secondary', 'ghost', 'danger'] },
      action: { type: 'string' },
      disabled: { type: 'boolean' },
    },
    children: 'text',
    events: {}, // Button has no semantic events
  },
  Input: {
    props: { value: { type: 'binding' }, placeholder: { type: 'string' } },
    children: 'none',
    events: { change: { target: 'onChange', payload: 'target.value' } },
  },
});
```

- `props: Record<string, PropSpec>` — `type` ∈ `token | string | binding |
  number | boolean | list`; `tokens` for enums; `required`; `description`.
- `children` — `'none' | 'text' | 'nodes' | 'any'` (default `'nodes'`).
- `events` — semantic event props and their target mapping.
- `imports` — registry-owned third-party mapping; the compiler emits
  `import { export } from "source"` automatically.
- `extendRegistry(base, extra)` merges two registries (extension wins);
  `CORE_REGISTRY` is the design-system-neutral default.

---

## Validation

### `validate(source, options?): Diagnostic[]`

Registry, structural, indentation, identifier, binding, and resource-limit
checks. Returns an empty array for valid input.

```ts
validate('Page P\n  Button variant=purple');
// [{ code: 'AUI_INVALID_TOKEN', severity: 'error', line: 2, column: 3,
//    message: '<Button> prop "variant=purple" is invalid. Expected one of: primary, secondary, ghost, danger.',
//    suggestion: 'Use variant=primary.' }]
```

**`Diagnostic`** — `{ code, severity: 'error' | 'warning' | 'info', message, line, column?, suggestion? }`.
Codes are stable and machine-readable (`AUI_UNKNOWN_NODE`,
`AUI_ORPHAN_ELSE`, `AUI_INDENT_MIXED_TABS_SPACES`, `AUI_BINDING_DANGEROUS`,
…). `formatDiagnostics(diags)` renders a compact line-anchored report;
`formatDiagnosticsForLLM(diags, source?)` includes the offending source lines
for one-shot repair loops.

### Indentation modes

- **`strict` (default)** — spaces only; tabs are errors; every nesting
  transition must move exactly `indentWidth` (default 2) spaces.
- **`llm`** — infers the unit from the first nested line and emits warnings
  instead of errors for inconsistencies.

### Import policy

- `{ mode: 'registry' }` (default) — explicit `import` lines are rejected;
  third-party components must be registered.
- `{ mode: 'explicit', allow: ['recharts'] }` — explicit imports allowed from
  the allowlist only.
- `{ unsafeImports: true }` — any import passes through (compat mode).

### Resource limits

`limits: { maxSourceBytes, maxLines, maxDepth, maxNodes, maxPropsPerNode, maxDefs }`
(defaults in `DEFAULT_LIMITS`). Untrusted/model-generated input returns
diagnostics instead of stack overflow or runaway recursion.

---

## Normalization

### `normalize(doc: RawDocument, options?): Result<CanonicalDocument>`

Convert the raw tree into the canonical IR:

- bare values are classified against registry prop metadata
  (`variant=primary` → `{ kind: 'token', value: 'primary' }`,
  `options="A,B"` → `{ kind: 'list', value: ['A', 'B'] }`);
- `If`/`Else` become an explicit `IfNode` with `then`/`else`;
- `For` becomes a `ForNode` with `body`;
- def params carry one unified `ComponentParam` model with typed defaults.

**`Value`** (canonical):

```ts
type Value =
  | { kind: 'string'; value: string }
  | { kind: 'binding'; path: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'token'; value: string }
  | { kind: 'list'; value: string[] };
```

**`Node`** (canonical) — `ComponentNode | IfNode | ForNode`, discriminated by
`kind`. Compilers and previews consume this, never the raw tree.

`Result<T>` — `{ ok: boolean; value?: T; diagnostics: Diagnostic[] }`.

---

## Compiling

### `compileReact(doc, options?): string`

Deterministically compile canonical IR (or a raw document, for migration)
into readable React + TSX.

- `options.registry` — component registry (default `CORE_REGISTRY`).
- `options.componentName` — override the generated component name (defaults
  to the `Page` label/title, else `View`).

The output is a contract:

- Every component resolves through the registry; core nodes import from
  `@/components/ui`, registered third-party nodes from their mapped source.
- `If`/`Else` compile to ternaries, `For` to `.map()` with deterministic
  `key`s — multi-child branches are wrapped in fragments (valid TSX, always).
- `action=name` → `onClick={() => onAction("name")}`.
- Semantic `change=event` props compile to target handlers with payloads
  through registry event metadata.
- `$bindings` resolve against a `data` prop; `$item`/`$index` inside loops;
  `$param` inside defs; `$root.path` for explicit absolute access.
- The `onAction` signature is `(name: string) => void` unless events are
  used, in which case it is `(name: string, payload?: unknown) => void`.

### `printAui(doc: CanonicalDocument): string`

Print canonical IR back to deterministic `.aui` source. Round-trip invariant:

```
normalize(parse(printAui(normalize(parse(source)))))   // preserves the canonical AST
```

---

## Text & binding resolution

### `tokenizeText(text): TextSegment[]`

Split text into literal and binding segments. Bindings start with a
letter/underscore, so `$0` and `Pay $129.00` stay literal.

### `resolvePath(data, path)` / `resolvePathSafe(data, path)`

Walk a dotted path through an object. `resolvePathSafe` uses own-property
checks only (never traverses inherited members; the one exception is
`length` on arrays, so `$items.length` works). `resolvePath` is the
legacy/v0.1 behavior (inherited lookup).

### `stringifyResolved(value): string | null`

Safe display string — **never** `[object Object]`; arrays of primitives join,
arrays of objects render their count, objects fall back to `name`/`label`.

### `interpolateText(text, resolve): string`

Replace `$bindings` in text; unresolved paths keep their `$path` visible.

### `resolveBindingValue(path, frames, rootData): unknown`

Resolve a binding path against the shared scope model: `$root.*` absolute
access, `def` param frames (innermost first), `For` `$item`/`$index` frames,
then the root data object. This is the same model the compiler uses when it
emits expressions and the preview uses when it renders values.

---

## Errors & determinism

- `parse` and `tokenize` are total functions: any string produces a result.
  Validation is a separate, first-class layer (`validate`), not thrown.
- `compileReact`, `printAui`, and `compile` are pure — identical input always
  yields identical output. No random ordering, no time dependence, no ambient
  state.

## Migration from v0.1

v0.2 is a public AST/API change:

- `Document` → `RawDocument`; `Node` → `RawNode`; `Prop` → `RawProp` with
  typed `RawValue` values (`Prop.value` is no longer a string).
- `ComponentDef.params` is now `ComponentParam[]` (`{ name, defaultValue?,
  required }`); `defaultProps` is gone.
- `compileReact(doc)` still accepts raw documents (it normalizes internally),
  but new code should use `compile(source, { strict: true })`.
- `validate` and `normalize` moved from the website into the package.
- Value kinds: `level=2` is a number, `round=true` is a boolean, and
  `label="$user.name"` is a literal string — not a binding.
