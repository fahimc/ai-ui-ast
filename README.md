# AI UI AST

**An LLM-first, validated UI language with a deterministic compiler.** Express
screens in `.aui` — a small DSL that *is* the UI tree — and a deterministic
pipeline validates it against a host-owned registry and compiles it to
readable React. The model expresses intent; deterministic software owns
imports, JSX, bindings, events, and formatting.

This is a DSL plus a compiler, not a generic token-compression parser. The
token savings are real — and measured, not claimed — but they are a
consequence of the design, not the identity.

## The core proposition

**The UI tree is the interface.** An LLM writes a small, AST-shaped DSL that
*is* the tree; validation + a deterministic compiler turn it into production
React. The messy, error-prone work — imports, JSX, binding resolution,
framework conventions — moves from the model to code, where it is
deterministic and testable. The model's job shrinks to the one thing it does
well: deciding what the UI should be.

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
event wiring, and output formatting. The language removes framework
boilerplate, dependency decisions, arbitrary CSS, and most syntax from the
representation an AI has to generate.

React is deliberately **not** replaced — it stays the mature runtime and
compiler target. `.aui` is the input format; React is the output.

## What's in this repo

| Path | What |
|---|---|
| `packages/parser` | **`@codedia/parser`** — lexer, parser, registry, validator, diagnostics, normalizer (canonical IR), React compiler, canonical printer. Zero runtime deps, ESM. |
| `apps/www` | The public website: docs, language reference, examples gallery, interactive playground, token methodology, and the LLM benchmark harness. |
| `docs/` | Full documentation: [API](docs/api.md), [grammar](docs/grammar.md), [compiler](docs/compiler.md), [token methodology](docs/token-methodology.md), [architecture](docs/architecture.md). |
| `skills/write-aui-ui` | An agent skill that teaches coding agents to write `.aui` and use the module. |
| `LANGUAGE_SPEC_V0.md` | The original v0 language specification. |
| `BUILD_PLAN.md` | Phased implementation plan and acceptance criteria. |

## Quickstart

```bash
npm install @codedia/parser
```

```ts
import { compile } from '@codedia/parser';

const result = compile(`
Page Dashboard data=$metrics
  Stack gap=md
    Heading level=1 "Overview"
    Metric label="Active users" value=$metrics.active
    Button variant=primary action=refresh "Refresh"
`, { strict: true });

if (!result.ok) {
  console.error(formatDiagnostics(result.diagnostics)); // repairable, line-anchored
} else {
  console.log(result.code); // deterministic React + TSX
}
```

`compile()` runs the whole pipeline — parse → validate → normalize → compile —
so consumers never sequence low-level calls. Low-level APIs (`parse`,
`validate`, `normalize`, `compileReact`, `printAui`) are all exported for
tooling. Full API and grammar: [`packages/parser/README.md`](packages/parser/README.md)
and [`docs/`](docs/).

## The v0.2 pipeline

```text
.aui source
   │
   ▼
lexer + indent parser ──────► RawDocument (typed raw values, line numbers)
   │
   ▼
validate(doc, registry) ────► Diagnostic[] (registry, structural, indent,
   │                           identifiers, bindings, resource limits)
   ▼
normalize(doc, registry) ────► CanonicalDocument (typed values, If/For nodes,
   │                            unified def params, registry-derived imports)
   ▼
compileReact(canonical) ─────► React + TSX (fragments, keys, events, adapter)
```

Key properties:

- **Host-owned registry.** `defineRegistry({ ... })` declares which nodes
  exist, their prop types/tokens, event mappings, and third-party imports.
  Strict compilation is registry-only: models never invent package specifiers.
- **Typed values.** `$user.name`, `label="hello"`, `label="$user.name"`,
  `level=2`, `round=true`, and `variant=primary` are distinct from parse to
  compile — no string guessing.
- **Repairable diagnostics.** Stable codes (`AUI_INVALID_TOKEN`, …), line and
  column, and fix hints — designed to be fed straight back to an LLM.
- **Semantic events.** `change=emailChanged` compiles to the target handler
  with the right payload through registry metadata — never framework syntax
  in the language.
- **Shared semantics.** The website preview and the compiler consume the same
  canonical IR and the same binding-scope rules — no independent
  re-implementations to drift.

## Design goals

1. **LLM-first syntax** — small output surface, low token count, predictable grammar.
2. **AST-shaped** — the source maps almost 1:1 to the internal tree; parsing is trivial and deterministic.
3. **Design-system native** — components, tokens, events, and imports come from a registry, not model-invented code.
4. **Constrained, not unsafe** — no arbitrary JavaScript, CSS, or executable expressions in the core language.
5. **Strong validation** — invalid components, props, tokens, bindings, and nesting fail with repairable diagnostics before React generation.
6. **Accessible defaults** — semantic nodes and component contracts carry accessibility behaviour.
7. **Framework-separated** — React is the first compiler backend, not part of the grammar.
8. **Round-trip friendly** — `normalize(parse(printAui(normalize(parse(source)))))` preserves the canonical AST.
9. **Measurably better for AI** — token use, validity, and repair iterations are benchmarked against TSX.

## Token efficiency (why it matters)

The Examples gallery measures every scenario with the **real GPT tokenizers**
(`o200k_base` primary, `cl100k_base` legacy — both pinned explicitly), comparing
`.aui` against the generated React *and* hand-written React implementations of
the same screens, under a **functional-equivalence gate** (every scenario
declares a machine-readable feature contract; the validator fails if a
declared feature is missing from either implementation):

> **Six real screens — 1,140 tokens saved (`o200k_base`), 50% fewer, 2.0×
> smaller than hand-written React** (1,128 tokens / 50% / 2.0× under
> `cl100k_base`). The tool's generated React is smaller than hand-written code
> in every scenario.

Every number is reproducible via `npm run validate:tokens` (in `apps/www`),
which re-counts the corpus and rewrites `token-report.json`. There is no
chars/4 approximation on the benchmark path — tokenizer failures fail loudly.
See [docs/token-methodology.md](docs/token-methodology.md).

## Development

```bash
git clone https://github.com/fahimc/ai-ui-ast.git
cd ai-ui-ast
npm install                 # installs workspaces, builds @codedia/parser
npm test -w @codedia/parser # 79 unit tests (lexer, parser, validate, normalize, compiler, printer)
npm test -w www             # rendering regression tests (every sample + gallery scenario)
npm run validate:tokens -w www   # re-measure token savings; --check verifies the committed report
npm run benchmark:llm -w www     # LLM-vs-React generation benchmark (fixture mode; live is opt-in)
npm run dev -w www          # the playground, http://localhost:5173
```

## Repository layout

```text
ai-ui-ast/
├── packages/parser/       # the published npm module (@codedia/parser)
│   └── src/
│       ├── lexer.ts       # quote-aware comments, indentation metadata, typed raw values
│       ├── parser.ts      # indentation-based parser → RawDocument
│       ├── ast.ts         # raw AST + canonical IR types
│       ├── diagnostics.ts # stable codes, line/column, LLM-repair formatting
│       ├── registry.ts    # defineRegistry + core registry + event/import metadata
│       ├── validate.ts    # registry/structural/indentation/identifier/limits checks
│       ├── normalize.ts   # RawDocument → CanonicalDocument
│       ├── bindings.ts    # binding paths, scope model, path safety
│       ├── react.ts       # canonical IR → React + TSX
│       ├── print.ts       # canonical .aui printer (round-trip)
│       ├── compile.ts     # high-level parse→validate→normalize→compile
│       └── *.test.ts      # 79 unit tests (node:test)
├── apps/www/              # the website (Vite + React)
│   ├── src/lib/           # website registry, mock data, resolution, gallery, corpus
│   └── scripts/           # validate-tokens.ts, benchmark/ (LLM harness + brief corpus)
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
