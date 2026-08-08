# @codedia/parser

**An LLM-first, validated UI language with a deterministic compiler, in one
package.** Express screens in `.aui` — a small DSL that is the UI tree
itself — then run a deterministic pipeline: parse, validate against a
host-owned registry, normalize to a canonical IR, and compile to React +
TypeScript. This is a DSL plus a compiler, not a token-compression trick: the
token savings are a *measured consequence* of the small grammar.

```
npm install @codedia/parser
```

[![npm version](https://img.shields.io/npm/v/@codedia/parser)](https://www.npmjs.com/package/@codedia/parser)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/fahimc/ai-ui-ast/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/website-playground-blueviolet)](https://ai-ui-ast.netlify.app)

---

## Why

Ask an LLM to build a screen and it emits React + JSX + imports + className
strings + CSS — a large, error-prone surface. `.aui` is the opposite: the
source **is** the UI tree, expressed in a small, predictable DSL. The
compiler — not the model — owns every decision an LLM is bad at: imports,
JSX syntax, binding resolution, event wiring, and output formatting.

```aui
Card max=md pad=lg
  Stack gap=md
    Heading level=2 "Welcome back"
    Text tone=muted "Continue where you left off."
    Button variant=primary action=continue "Continue"
```

The language has no arbitrary JavaScript, CSS, or invented imports. In
strict mode, every component, prop, token, and import is constrained by the
registry you own.

## Quickstart

```ts
import { compile, defineRegistry, CORE_REGISTRY, extendRegistry, formatDiagnostics } from '@codedia/parser';

// Extend the core registry with your design system and third-party components.
const registry = extendRegistry(CORE_REGISTRY, {
  AreaChart: {
    imports: { source: '@company/charts', export: 'AreaChart' },
    props: { data: { type: 'binding' }, height: { type: 'number' } },
    children: 'nodes',
  },
});

const result = compile(`
Page Dashboard data=$metrics
  Stack gap=md
    Heading level=1 "Overview"
    Metric label="Active users" value=$metrics.active
    Button variant=primary action=refresh "Refresh"
`, { registry, strict: true });

if (!result.ok) {
  console.error(formatDiagnostics(result.diagnostics));
} else {
  console.log(result.code); // deterministic React + TSX
}
```

`compile(source, options)` runs the whole pipeline — parse → validate →
normalize → compile — and **refuses to emit code in `strict` mode when
error-level diagnostics exist**. You never sequence low-level calls to get
safe output.

## Pipeline & API

```text
source → lexer/parser → RawDocument → validate() → normalize() → CanonicalDocument → compileReact() → TSX
```

| Export | Description |
|---|---|
| `parse(source): RawDocument` | Parse `.aui` into the raw syntax tree (typed raw values, line numbers). |
| `validate(source, opts?): Diagnostic[]` | Registry, structural, indentation, identifier, binding, and resource-limit checks. |
| `normalize(doc, opts?): Result<CanonicalDocument>` | Raw → canonical IR: typed values, explicit `If`/`For` nodes, unified def params. |
| `compile(source, opts?): CompileResult` | High-level pipeline (`{ code?, rawAst, ast?, diagnostics, ok }`). `strict: true` refuses to emit code on errors. |
| `compileReact(doc, opts?): string` | Low-level canonical IR → React + TSX (also accepts raw docs for migration). |
| `printAui(doc): string` | Canonical `.aui` printer — deterministic, round-trip friendly. |
| `defineRegistry(defs) / extendRegistry(base, extra)` | Host-owned registry of nodes, props, tokens, events, and imports. |
| `CORE_REGISTRY` | The default/design-system-neutral registry shipped with the package. |
| `formatDiagnostics(diags)` / `formatDiagnosticsForLLM(diags, source?)` | Line-anchored reports designed for LLM repair loops. |
| `tokenize`, `scan`, `tokenizeText`, `interpolateText`, `resolvePath`, `stringifyResolved`, `resolveBindingValue` | Lexing and text/binding helpers. |

## Registry — the safety boundary

The registry is how third-party components and your design system enter the
language. `strict` compilation is **registry-only by default**: models write
`AreaChart data=$series` and the compiler derives `import { AreaChart } from
"@company/charts"` — models never write import lines and cannot invent
dependencies. Explicit `import` lines are an advanced/compatibility mode:

```ts
// Advanced: allow explicit imports from a specific allowlist.
compile(source, { imports: { mode: 'explicit', allow: ['recharts'] } });
// Or fully permissive (documented as unsafe):
compile(source, { imports: { unsafeImports: true } });
```

## Semantic events

`.aui` uses framework-neutral event names; the registry owns the target
mapping:

```aui
Input value=$form.email change=emailChanged
Checkbox checked=$form.remember change=rememberChanged "Remember me"
```

compiles to (for a React target):

```tsx
<Input value={data.form.email} onChange={(e) => onAction('emailChanged', e.target.value)} />
<Checkbox checked={data.form.remember} onChange={(e) => onAction('rememberChanged', e.target.checked)}>Remember me</Checkbox>
```

`events: { change: { target: 'onChange', payload: 'target.value' } }` lives in
the registry, so the language never hard-codes React event objects.

## Diagnostics

Diagnostics carry a stable machine-readable `code`, severity, line (and
column where feasible), message, and optional fix hint — intentionally easy
to feed back to an LLM for one-shot repair:

```
line 7: AUI_INVALID_TOKEN error: <Button> prop "variant=purple" is invalid. Expected one of: primary, secondary, ghost, danger. (suggestion: use variant=primary)
```

## Token efficiency

Measured with the real GPT tokenizers (`o200k_base` primary, `cl100k_base`
legacy — pinned explicitly, no approximation), six real screens save
**1,140 tokens (`o200k_base`) — 50% fewer, 2.0× smaller than hand-written
React**, under a functional-equivalence gate (every scenario declares a
feature contract; the validator fails if either implementation is missing a
declared feature). Reproduce with `npm run validate:tokens` in
[`apps/www`](../../apps/www). See
[`docs/token-methodology.md`](../../docs/token-methodology.md).

## Grammar at a glance

```text
Page Dashboard data=$metrics              # root; label becomes component name
  Stack gap=md
    Heading level=2 "Overview"            # quoted text content
    Metric label="Active users" value=$metrics.active
    Input value=$form.email change=emailChanged   # semantic events
    If condition=$user.admin              # conditional branch
      Badge tone=success "Admin"
    Else
      Badge tone=muted "Member"
    For each=$tasks                       # loop over a binding
      Row
        Text "Task $item.title"           # bindings interpolate inside text
```

- **Nodes** — `Page Stack Row Grid Card Section Spacer Heading Text Image
  Icon Divider Button Link Input Select Checkbox Switch Alert Badge Spinner
  Metric Field` (+ structural `If Else For`; `State` is reserved).
- **Props** — `key=value`; bare values (`gap=md`, `variant=primary`) are
  semantic tokens; `$path` are data bindings; quoted strings
  (`label="Active users"`) are literal (a quoted `"$user.name"` is a literal
  string, not a binding).
- **Bindings** — `$user.name` → `data.user.name`; `$item` / `$index` inside
  `For`; `$param` inside `def` bodies; `$root.path` for explicit absolute
  access.
- **Actions** — `action=name` only, routed through `onAction("name")`.
- **def** — `def StatCard label value tone=default` declares a reusable
  template; params are one unified model (required + defaulted).
- **Imports** — via the registry in strict mode (advanced: allowlisted
  explicit imports). Side-effect imports are supported in compat mode.
- **No** arbitrary JS, CSS, className, or eval — ever.

Full spec: [`docs/grammar.md`](../../docs/grammar.md) ·
[`docs/api.md`](../../docs/api.md) · [`docs/compiler.md`](../../docs/compiler.md)

## Development

```bash
git clone https://github.com/fahimc/ai-ui-ast.git
cd ai-ui-ast
npm install          # installs workspaces, builds @codedia/parser
npm test -w @codedia/parser
```

Run the playground locally:

```bash
npm run dev -w www   # http://localhost:5173
```

## Links

- **Website & playground** — <https://ai-ui-ast.netlify.app>
- **Docs** — [`docs/`](../../docs): [API](../../docs/api.md) ·
  [Grammar](../../docs/grammar.md) · [Compiler](../../docs/compiler.md) ·
  [Token methodology](../../docs/token-methodology.md) ·
  [Architecture](../../docs/architecture.md)
- **Repository** — <https://github.com/fahimc/ai-ui-ast>
- **Agent skill** — [`skills/write-aui-ui`](../../skills/write-aui-ui) teaches
  coding agents to write `.aui` and use this module.

## License

MIT © Fahim Chowdhury. See [LICENSE](../../LICENSE).
