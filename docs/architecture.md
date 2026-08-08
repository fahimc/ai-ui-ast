# Architecture

AI UI AST is **an LLM-oriented UI DSL with a deterministic compiler** — not a
generic token-compression parser. The language is a small, AST-shaped DSL;
the value is that a compiler (not the model) owns imports, JSX, bindings, and
formatting. Token savings are a measured consequence of the small grammar,
and `docs/token-methodology.md` is the receipt.

It is a TypeScript monorepo with two workspaces and a documentation layer.

```text
ai-ui-ast/
├── packages/parser/       # @codedia/parser — the published npm module
│   └── src/
│       ├── lexer.ts       # tokenize(source) → Token[]
│       ├── parser.ts      # parse(source) → Document
│       ├── ast.ts         # types: Node, Prop, ImportDecl, ComponentDef, Document
│       ├── text.ts        # $binding tokenization + resolution helpers
│       ├── react.ts       # compileReact(Document) → React + TSX
│       └── *.test.ts      # 19 unit tests (node:test, run via --experimental-strip-types)
├── apps/www/              # the website (Vite + React 19, hash-routed)
│   ├── src/pages/         # Home, Language, Examples, Playground, Roadmap
│   ├── src/components/    # Playground, CodeBlock, Section
│   └── src/lib/           # registry, samples, gallery, mockData, resolve,
│                          # handwritten corpus, token report, regression tests
├── docs/                  # API, grammar, compiler, token methodology, architecture
└── skills/write-aui-ui/   # agent skill
```

## Data flow

```text
.aui source
   │
   ▼
lexer.ts ── tokenize ──► Token[]
   │
   ▼
parser.ts ── parse ────► Document { rootNodes, imports?, components? }
   │
   ├──────────────────────────────┐
   ▼                              ▼
compileReact (react.ts)      text.ts helpers
   │                              │
   ▼                              ▼
React + TSX                 interpolated display values
```

The pipeline is deliberately shallow: `.aui` is already AST-shaped, so the
lexer/parser produce the tree with almost no interpretation, and the compiler
walks that tree directly. There is no intermediate IR yet — that's the
documented next step (`BUILD_PLAN.md`), needed before adding non-React
backends.

## Key design decisions

### 1. The parser is trivial by design
Indentation encodes nesting, so `Page > Stack > Card` is literally
`Page` / two spaces / `Stack` / four spaces / `Card`. The AST (`Node` with
`type`, `props`, optional `label`/`textContent`, `children`) mirrors the
source 1:1.

### 2. `def` components are compiler-local
`def StatCard label value tone=default` declares a template. The parser
collects defs into `Document.components`; `compileReact` renders each as a
local `function` component and inlines usages as `<StatCard ... />` with
passthrough props. The preview renderer does the same at runtime.

### 3. `If`/`Else` are sibling-linked
`Else` is parsed as a child of its `If` at the same indent (Python-style), not
a stack pop — the compiler emits `{cond ? (…) : (…)}` and the preview evaluates
the condition against mock data.

### 4. `@/components/ui` is an adapter contract
The compiler emits `import { Heading, Button, … } from '@/components/ui'` —
semantic names, not model-invented imports. A real deployment maps that alias
to a design system (shadcn/ui, MUI, …). The playground supplies the mapping
for preview.

### 5. Token measurement is a first-class tool
`apps/www/scripts/validate-tokens.ts` uses `gpt-tokenizer` (the real GPT-4
BPE tokenizer) to count every scenario three ways — `.aui`, generated React,
hand-written React — and writes `apps/www/token-report.json`, which the
Examples page renders. The report is committed so the site needs no 2 MB
tokenizer chunk at runtime.

## Testing strategy

- **Parser package** — `node:test` unit tests per concern (lexer, parser,
  text resolution, compiler output). `--experimental-strip-types` runs TS
  directly; `tsc` builds `dist/` for consumers.
- **www rendering regression test** — parses *every* sample and gallery
  scenario and walks it through the same resolution code the preview uses,
  asserting no `[object Object]`, no `undefined`, no unresolved `$binding`.
- **Token validation** — `validate:tokens --check` fails CI-style if the
  committed report drifts from reality.

## Future targets

- Schema/design-token validation before codegen (registry)
- Canonical source printing (round-trip)
- CLI (`aui build`)
- Non-React backends (HTML, React Native, SwiftUI) via the IR
- Escape hatches (expression language) after the core stabilizes
