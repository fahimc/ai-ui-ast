# AI UI AST

**An LLM-oriented UI DSL with a deterministic compiler.** Express screens in
`.aui` — a small DSL that *is* the UI tree — and a compiler turns it into
readable, testable React. Small grammar, no invented imports or CSS.

This is a DSL plus a compiler, not a generic token-compression parser. The
point is that an LLM writes a tiny, predictable tree instead of framework
boilerplate; the compiler absorbs the messy parts deterministically. The
token savings are real — and measured, not claimed — but they are a
consequence of the design, not the identity.

> **Try the live playground: <https://ai-ui-ast.netlify.app>**
>
> **npm: [`@codedia/parser`](https://www.npmjs.com/package/@codedia/parser)**
> · **GitHub: [`fahimc/ai-ui-ast`](https://github.com/fahimc/ai-ui-ast)**

[![npm version](https://img.shields.io/npm/v/@codedia/parser)](https://www.npmjs.com/package/@codedia/parser)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-playground-blueviolet)](https://ai-ui-ast.netlify.app)

---

## The idea

Ask an LLM to build a screen and it produces React + JSX + imports +
`className` strings + CSS — a huge, error-prone surface. Instead of asking it
to emit all of that, `.aui` asks for the **UI tree itself**:

```aui
Card max=md pad=lg
  Stack gap=md
    Heading level=2 "Welcome back"
    Text tone=muted "Continue where you left off."
    Button variant=primary action=continue "Continue"
```

The compiler owns imports, JSX syntax, token resolution, component lookup,
accessibility defaults, and output formatting. The language removes framework
boilerplate, dependency decisions, arbitrary CSS, and most syntax from the
representation an AI has to generate.

React is deliberately **not** replaced — it stays the mature runtime and
compiler target. `.aui` is the input format; React is the output.

## What's in this repo

| Path | What |
|---|---|
| `packages/parser` | **`@codedia/parser`** — lexer, parser, AST, React compiler, text/binding resolution. Zero runtime deps, ESM. |
| `apps/www` | The public website: docs, language reference, examples gallery, and an interactive playground (preview / AST / React tabs, diagnostics). |
| `docs/` | Full documentation: [API](docs/api.md), [grammar](docs/grammar.md), [compiler](docs/compiler.md), [token methodology](docs/token-methodology.md), [architecture](docs/architecture.md). |
| `skills/write-aui-ui` | An agent skill that teaches coding agents to write `.aui` and use the module. |
| `LANGUAGE_SPEC_V0.md` | The original v0 language specification. |
| `BUILD_PLAN.md` | Phased implementation plan and acceptance criteria. |

## Quickstart

```bash
npm install @codedia/parser
```

```ts
import { parse, compileReact } from '@codedia/parser';

const doc = parse(`
Page Dashboard data=$metrics
  Stack gap=md
    Heading level=1 "Overview"
    Metric label="Active users" value=$metrics.active
`);

console.log(doc.rootNodes[0].type);   // 'Page'
const tsx = compileReact(doc);        // deterministic React + TSX
```

Full API and grammar: [`packages/parser/README.md`](packages/parser/README.md)
and [`docs/`](docs/).

## Design goals

1. **LLM-first syntax** — small output surface, low token count, predictable grammar.
2. **AST-shaped** — the source maps almost 1:1 to the internal tree; parsing is trivial and deterministic.
3. **Design-system native** — components and tokens come from a registry, not model-invented imports/CSS.
4. **Safe by construction** — no arbitrary JavaScript, CSS, package imports, or executable expressions in the core language.
5. **Strong validation** — invalid components, props, tokens, bindings, and actions fail before React generation.
6. **Accessible defaults** — semantic nodes and component contracts carry accessibility behaviour.
7. **Framework-separated** — React is the first compiler backend, not part of the grammar.
8. **Round-trip friendly** — source → AST → canonical source is deterministic.
9. **Measurably better for AI** — token use, validity, and repair iterations are benchmarked against TSX.

## Token efficiency (why it matters)

The Examples gallery measures every scenario with the **real GPT-4 tokenizer**
(`cl100k_base`), comparing `.aui` against the generated React *and* hand-written
React implementations of the same screens:

> **Six real screens — 1,080 tokens saved, 48% fewer, 1.9× smaller than
> hand-written React.** The tool's generated React is smaller than hand-written
> code in every scenario.

Every number is reproducible via `npm run validate:tokens` (in `apps/www`),
which re-counts the corpus and rewrites `token-report.json`. See
[docs/token-methodology.md](docs/token-methodology.md) and the live
[Examples page](https://ai-ui-ast.netlify.app/#/examples).

## The pipeline

```text
Prompt / Figma / agent
        |
        v
      .aui
        |
        v
  lexer + indent parser
        |
        v
   canonical UI AST
        |
        +--> schema/type validation
        +--> design-token validation
        +--> component-registry resolution
        +--> accessibility rules
        +--> data/action validation
        |
        v
  target-neutral IR
        |
        +-------------------+
        |                   |
        v                   v
 React compiler        future targets
        |             HTML / RN / SwiftUI
        v
 React + TypeScript
```

## Development

```bash
git clone https://github.com/fahimc/ai-ui-ast.git
cd ai-ui-ast
npm install                # installs workspaces, builds @codedia/parser
npm test -w @codedia/parser   # 19 unit tests (parser, compiler, text resolution)
npm test -w www            # 3 rendering regression tests (every sample + gallery scenario)
npm run validate:tokens -w www   # re-measure token savings; --check verifies the committed report
npm run dev -w www         # the playground, http://localhost:5173
```

## Repository layout

```text
ai-ui-ast/
├── packages/parser/       # the published npm module (@codedia/parser)
│   └── src/
│       ├── lexer.ts       # tokenizer
│       ├── parser.ts      # indentation-based parser → Document
│       ├── ast.ts         # types: Node, Prop, ImportDecl, ComponentDef, Document
│       ├── text.ts        # $binding tokenization + resolution helpers
│       └── react.ts       # compileReact: Document → React + TSX
├── apps/www/              # the website (Vite + React)
│   ├── src/pages/         # Home, Language, Examples, Playground, Roadmap
│   ├── src/lib/           # registry, mock data, resolution, gallery, handwritten corpus
│   └── scripts/           # validate-tokens.ts (token methodology checker)
├── docs/                  # API, grammar, compiler, token methodology, architecture
├── skills/write-aui-ui/   # agent skill (SKILL.md)
├── LANGUAGE_SPEC_V0.md
├── BUILD_PLAN.md
└── LICENSE                # MIT
```

## Documentation

- [docs/README.md](docs/README.md) — documentation index
- [docs/api.md](docs/api.md) — full API reference
- [docs/grammar.md](docs/grammar.md) — the current grammar
- [docs/compiler.md](docs/compiler.md) — how React generation works
- [docs/token-methodology.md](docs/token-methodology.md) — how we measure token savings
- [docs/architecture.md](docs/architecture.md) — monorepo architecture
- [CHANGELOG.md](CHANGELOG.md) — release history
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute

## License

MIT © Fahim Chowdhury. See [LICENSE](LICENSE).
