# Changelog

All notable changes to AI UI AST are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-08-08

### Added — validated, deterministic v0.2 pipeline

- **Typed raw AST** (`ast.ts`) — `RawValue` kinds (`string` / `binding` /
  `number` / `boolean` / `bare`) replace string-typed props. `level=2` is a
  number, `round=true` is a boolean, `label="$user.name"` is a literal
  string, and `value=$user.name` is a binding — the compiler never guesses
  semantics from strings.
- **Canonical IR** (`normalize.ts`) — bare values are classified against the
  registry (`token` / `list` / `string`), `If`/`Else` become explicit
  `IfNode` with `then`/`else`, `For` becomes a `ForNode`, and def params
  carry one unified `ComponentParam` model. Compilers and the website preview
  consume the same IR.
- **First-class validation** (`validate.ts`, `diagnostics.ts`) — moved from
  the website into the package: registry checks, structural checks (orphan /
  duplicate `Else`, `For` without a list), indentation validation (strict and
  LLM-friendly modes), identifier validation, binding-path safety, resource
  limits, and stable machine-readable diagnostic codes with line/column and
  fix hints designed for LLM repair loops.
- **Package-level registry** (`registry.ts`) — `defineRegistry`,
  `extendRegistry`, `CORE_REGISTRY`, plus semantic event metadata
  (`change=` → target handler + payload) and registry-owned third-party
  imports. Strict compilation is **registry-only** by default; explicit
  imports require an allowlist or `unsafeImports` compat mode.
- **High-level API** (`compile.ts`) — `compile(source, { strict: true })`
  runs parse → validate → normalize → compile and refuses to emit code when
  error-level diagnostics exist.
- **Compiler correctness fixes** (`react.ts`) — one shared
  `renderJsxChildren` helper guarantees valid TSX for every expression
  context (multi-child `If`/`Else`/`For`/def/document roots now wrap in
  fragments); loops emit deterministic `key`s; `Page data=` is consumed as a
  contract instead of a passthrough prop; numeric/boolean/list props emit
  typed JSX; registry-derived imports are deterministic and deduplicated;
  `$root.` absolute bindings; every golden fixture passes a TSX transpile
  gate.
- **Semantic events** — `change=emailChanged` on Input/Select/Checkbox/Switch
  compiles to `onChange={(e) => onAction("emailChanged", e.target.value)}`
  (or `target.checked`) through registry metadata. Form examples now express
  the same behavior as their hand-written React baselines.
- **Canonical printer** (`print.ts`) — `printAui()` with a tested semantic
  round-trip invariant.
- **Lexer hardening** — quote-aware `#` comment stripping (hex colours and
  `#` inside strings survive), typed value classification, import alias /
  namespace rejection with repairable diagnostics, indentation metadata.
- **State** — `State` is now reported as reserved/not-yet-supported instead
  of being advertised as implemented.
- **Tests** — 79 unit tests (up from 19) across lexer, parser, validator,
  normalizer, compiler (with TSX gate), printer, and the high-level API.

### Changed — token methodology

- Tokenizer encodings are **pinned explicitly** (`o200k_base` primary,
  `cl100k_base` legacy) and named in `token-report.json`; the silent chars/4
  approximation fallback was removed from the benchmark path.
- Every gallery scenario carries a machine-readable **feature contract**
  (render / bindings / actions / events); the validator fails if a declared
  feature is missing from either implementation, so `.aui` is only compared
  against functionally equivalent React.
- Generated TSX runs through a transpile gate in the validator; every
  scenario must pass the strict package pipeline.
- **Instruction-overhead accounting** — cold (full AUI skill charged per
  request) vs warm (amortized to 0) are recorded in the report and shown on
  the site.
- Regenerated numbers: **1,140 tokens saved (`o200k_base`) — 50% fewer,
  2.0× smaller than hand-written React** (1,128 / 50% / 2.0× under
  `cl100k_base`).

### Added — LLM generation benchmark

- `apps/www/scripts/benchmark/` — a versioned corpus of **36 UI briefs** with
  functional contracts, deterministic fixture mode (CI-safe, runs without API
  keys), opt-in live mode via `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, and
  metrics for output tokens (both encodings), first-pass parse/validation/
  TSX success, repair turns, completion, contract pass rate, and estimated
  cost. Failures are retained and scored.
- `npm run benchmark:llm -w www`.

### Changed — website (`apps/www`)

- The playground now calls the package `compile()` pipeline; the preview
  renders the **canonical IR** with the package's shared binding-scope model.
  Duplicate language validation was removed from `apps/www`.
- Gallery scenarios use registry-owned chart imports (no `import` lines) and
  declare feature contracts; the business-logic form uses `change=` events.
- The Examples page reports both tokenizer encodings and instruction
  overhead.

### Changed — breaking AST/API (migration notes)

- `Document` → `RawDocument`; `Node` → `RawNode`; `Prop.value` is now a typed
  `RawValue`, not a string.
- `ComponentDef.params` is `ComponentParam[]` (`{ name, defaultValue?,
  required }`); `defaultProps` was removed.
- `validate` / `normalize` / `compile` / `printAui` / `defineRegistry` were
  added; `compileReact` still accepts raw documents for migration but new code
  should use `compile(source, { strict: true })`.
- See `docs/api.md` → Migration from v0.1.

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
