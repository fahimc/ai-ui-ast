# @codedia/parser

**The AI UI AST language, in one package.** Parse `.aui` — an LLM-first UI
language that expresses the UI tree directly — into a canonical AST, then
compile it deterministically to React + TypeScript.

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
source **is** the UI tree, expressed in a small, predictable grammar that an
LLM can generate reliably and with fewer tokens.

```aui
Card max=md pad=lg
  Stack gap=md
    Heading level=2 "Welcome back"
    Text tone=muted "Continue where you left off."
    Button variant=primary action=continue "Continue"
```

The compiler owns the React: imports, JSX syntax, binding resolution, and
output formatting. The language has no arbitrary JavaScript, CSS, or invented
imports — it is safe by construction.

## Quickstart

```ts
import { parse, compileReact } from '@codedia/parser';

const doc = parse(`
Page Dashboard data=$metrics
  Stack gap=md
    Heading level=1 "Overview"
    Metric label="Active users" value=$metrics.active
    Button variant=primary action=refresh "Refresh"
`);

console.log(doc.rootNodes[0].type); // 'Page'
const tsx = compileReact(doc);
```

`compileReact` returns a complete, readable React component:

```tsx
import { Button, Heading, Metric, Page, Stack } from '@/components/ui'

export function Dashboard({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page><Stack gap="md"><Heading level="1">Overview</Heading><Metric label="Active users" value={data.metrics.active} /><Button variant="primary" onClick={() => onAction("refresh")}>Refresh</Button></Stack></Page>
  )
}
```

The output is a contract, not a black box: `@/components/ui` is your
design-system adapter, `data` carries bindings, and `onAction` routes named
actions. Swap the adapter target and the same `.aui` produces different
frameworks later.

## Features

- **Lexer + indentation parser** — `tokenize(source)` → tokens, `parse(source)` → AST. Deterministic, no magic.
- **Real UI constructs** — `import` (third-party libraries), `def` (reusable
  component templates with `$param` bindings), `If`/`Else`, `For`, `State`,
  and 27 semantic nodes (Page, Stack, Card, Grid, Input, Metric, …).
- **React compiler** — `compileReact(doc)` emits imports, local components,
  ternaries for `If/Else`, `.map()` for `For`, and interpolated bindings inside
  text. Pure: same input, same output.
- **Text/binding resolution** — `tokenizeText`, `interpolateText`,
  `resolvePath`, and `stringifyResolved` for turning `$user.name` into display
  values without ever producing `[object Object]`.
- **Zero runtime dependencies** — ESM, Node ≥ 18, works in the browser.

## API

| Export | Description |
|---|---|
| `tokenize(source): Token[]` | Lex `.aui` source into tokens. |
| `parse(source): Document` | Parse tokens into the canonical AST (`rootNodes`, `imports`, `components`). |
| `compileReact(doc, opts?): string` | Deterministically compile a `Document` to React + TSX. `opts.componentName` overrides the generated component name. |
| `tokenizeText(text): TextSegment[]` | Split literal text from `$bindings` (keeps `$0`, `$129.00` literal). |
| `interpolateText(text, scope): string` | Replace `$bindings` in text with resolved values. |
| `resolvePath(data, path): unknown` | Walk a dotted path (`user.name`) through an object. |
| `stringifyResolved(value): string \| null` | Safe display string — never `[object Object]`; arrays of objects render their count. |

Types: `Document`, `Node`, `Prop`, `ImportDecl`, `ComponentDef`, `Token`.

## Grammar at a glance

```text
import { AreaChart } from "recharts"      # third-party imports
def StatCard label value tone=default     # reusable component template
  Card
    Text $label
    Metric value=$value tone=$tone

Page Dashboard data=$metrics              # nodes: indent = nesting
  Stack gap=md
    StatCard label="Active users" value=$metrics.active
    If condition=$user.admin              # conditionals
      Badge tone=success "Admin"
    Else
      Badge tone=muted "Member"
    For each=$users                       # loops
      Row
        Text $item.name
```

- **Nodes** — `Page Stack Row Grid Card Section Spacer Heading Text Image Icon
  Divider Button Link Input Select Checkbox Switch Alert Badge Spinner Metric
  Field` (+ structural `If Else For State`).
- **Props** — `key=value`; bare values (`gap=md`, `variant=primary`) are
  semantic tokens; `$path` are data bindings; quoted strings
  (`label="Active users"`) are literal.
- **Actions** — `action=name` only; the compiler routes them through
  `onAction("name")`.
- **No** arbitrary JS, CSS, className, or eval — ever.

Full spec: [`docs/grammar.md`](../../docs/grammar.md) ·
[`LANGUAGE_SPEC_V0.md`](../../LANGUAGE_SPEC_V0.md)

## Token efficiency

The language exists because tokens matter. The Examples gallery on the website
measures every scenario with the real GPT-4 tokenizer (`cl100k_base`),
comparing `.aui` against the generated React and hand-written React:

> **Six real screens: 1,080 tokens saved — 48% fewer, 1.9× smaller than
> hand-written React.**

The numbers are reproducible: `npm run validate:tokens` in
[`apps/www`](../../apps/www) re-counts every scenario and rewrites
[`token-report.json`](../../apps/www/token-report.json). See
[`docs/token-methodology.md`](../../docs/token-methodology.md).

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
