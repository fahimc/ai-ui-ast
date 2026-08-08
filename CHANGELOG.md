# Changelog

All notable changes to AI UI AST are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.1] — 2026-08-08

### Changed — positioning

- **Repositioned as an LLM-oriented UI DSL with a deterministic compiler** —
  not a generic token-compression parser. Updated the npm package description,
  package README, root README, docs index, architecture doc, and the site
  hero to lead with the DSL + compiler story; token savings are presented as
  a measured consequence of the design, not the identity.
- **Fixed a claim that contradicted our own measurements**: the site hero
  stat said "~3× fewer tokens than TSX"; the token report measures **1.9×**
  (48% fewer). Now says "~2× — measured, not claimed".
- Rebuilt and redeployed the site; published `@codedia/parser@0.1.1`.

## [0.1.0] — 2026-08-08

Initial public release. The `.aui` language, parser, React compiler, token
methodology, and full website.

### Added — language & parser (`@codedia/parser`)

- **Lexer** (`lexer.ts`) — tokenizes `.aui`: node types, labels, `key=value`
  props (including quoted multi-word values like `label="Active users"`),
  `$bindings`, actions, and line comments.
- **Parser** (`parser.ts`) — indentation-based parser producing a canonical
  `Document` (`rootNodes`, `imports`, `components`). Deterministic; no magic.
- **AST** (`ast.ts`) — types: `Node`, `Prop`, `ImportDecl`, `ComponentDef`,
  `Document`.
- **Text resolution** (`text.ts`) — pure helpers: `tokenizeText` (splits
  literal text from `$bindings`; keeps `$0` / `$129.00` literal),
  `interpolateText`, `resolvePath`, `stringifyResolved` (never emits
  `[object Object]` — arrays of primitives join, arrays of objects render
  their count, objects fall back to `name`/`label`).
- **React compiler** (`react.ts`) — `compileReact(doc)` emits readable React +
  TSX: third-party `import` statements, local `function` components for `def`
  templates with `$param` scope, ternaries for `If/Else`, `.map()` for `For`,
  named `action=` routed through `onAction`, and `$binding` interpolation
  inside text content. Pure and deterministic.
- **Language constructs** — `import { X } from "pkg"`, `def Name param=default`
  component templates, `Else` branches attached to their `If`, `For each=`,
  `State`, `$binding` data references, `action=` named actions.
- **Tests** — 19 unit tests covering the lexer, parser, defs/imports,
  If/Else/For, quoted props, text resolution, and compiler output.

### Added — token methodology & validation

- **Measurement** — all token counts use `gpt-tokenizer` (the real GPT-4 /
  GPT-3.5 BPE tokenizer, `cl100k_base`) — nothing minified or estimated.
- **Three-way comparison** — each gallery scenario counts the `.aui` source,
  the deterministic compiler output, and a realistic hand-written React
  implementation (`apps/www/src/lib/handwritten.ts`).
- **Validation script** — `npm run validate:tokens -w www` re-counts every
  scenario, prints a table, and rewrites `token-report.json`. With `--check`
  it verifies the committed report is still current and exits non-zero if
  `.aui` is ever larger than hand-written React.
- **Results** — six real screens save **1,080 tokens (48% fewer, 1.9×)** vs
  hand-written React; the tool's generated React is smaller than hand-written
  in every scenario.
- **Compiler compaction** — the validator drove a real improvement: the
  compiler now emits single-line text elements and compact imports, so its
  output is ≤ hand-written React everywhere.

### Added — website (`apps/www`)

- **Multi-page site** — hash-routed pages: Home, Language, Examples,
  Playground, Roadmap (works on static hosting, no server config).
- **Examples gallery** — six complex scenarios (third-party imports, reusable
  components, conditional UI logic, business-logic wiring, live-data
  dashboard, full composition), each with `.aui` vs generated React
  side-by-side, three-row token-savings bars, a "How we measure tokens"
  methodology section, and a per-scenario table. Every scenario opens in the
  playground.
- **Playground** — live editor with preview / AST / React tabs and
  diagnostics; loads gallery scenarios via "Open in playground".
- **Mobile nav** — hamburger menu on small screens so every page is reachable.
- **Rendering fixes** — `[object Object]` from array bindings, literal
  `$item.progress` inside quoted strings, and missing mock-data bindings were
  fixed; a regression test (`apps/www/src/lib/render.test.ts`) parses every
  sample and gallery scenario through the production resolution code.

### Added — docs, skill, release

- **Documentation** — root README, npm-facing package README, `docs/`
  (API, grammar, compiler, token methodology, architecture), CHANGELOG,
  CONTRIBUTING.
- **Agent skill** — `skills/write-aui-ui/SKILL.md` teaches coding agents to
  write `.aui` and use `@codedia/parser`.
- **Publishing** — `@codedia/parser@0.1.0` published to npm; MIT license;
  repo public at `github.com/fahimc/ai-ui-ast`; site live at
  `ai-ui-ast.netlify.app`.

[0.1.1]: https://github.com/fahimc/ai-ui-ast/releases/tag/v0.1.1
[0.1.0]: https://github.com/fahimc/ai-ui-ast/releases/tag/v0.1.0
