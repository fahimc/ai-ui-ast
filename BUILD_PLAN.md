# Build Plan

**Positioning:** AI UI AST is an **LLM-oriented UI DSL with a deterministic
compiler** — not a generic token-compression parser. The language is a small,
AST-shaped DSL; the compiler (not the model) owns imports, JSX, bindings, and
formatting. Token savings are a measured consequence of the design, tracked in
`docs/token-methodology.md`.

Status legend: ✅ shipped · 🚧 in progress · ⬜ planned

## Phase 1: Core Parsing and AST — ✅ shipped (v0.1)

**Goal**: Parse `.aui` syntax into a canonical in-memory AST.

- ✅ Indentation-sensitive lexer (`tokenize`) and parser (`parse`).
- ✅ Canonical AST types: `Node`, `Prop`, `ImportDecl`, `ComponentDef`, `Document`.
- ✅ Language constructs: `import`, `def` templates with `$param` scope,
  `If`/`Else`, `For`, `State`, `$bindings`, `action=` named actions, quoted
  multi-word prop values.
- ✅ Text/binding resolution helpers (`tokenizeText`, `interpolateText`,
  `resolvePath`, `stringifyResolved`) — never `[object Object]`.
- ⬜ Structural/schema validation as a first-class layer (currently the
  playground's `validate.ts` is a light registry check; the full
  schema/token/registry validator is the next milestone).

## Phase 2: Component Registry and Adapters — 🚧 contract shipped, adapters planned

**Goal**: Map canonical AST nodes to real-world UI components without bleeding
implementation details into `.aui`.

- ✅ The compiler emits a stable adapter contract: semantic imports from
  `@/components/ui`, `data` for bindings, `onAction` for actions.
- ✅ The playground ships a mini registry that renders the semantic nodes.
- ⬜ A generic registry + adapter layer (Radix, MUI, shadcn/ui) that turns
  `Button variant=primary` into the right import and props per target.
- ⬜ Design-token validation against a theme schema.

## Phase 3: React Compiler — ✅ shipped (v0.1)

**Goal**: Translate a validated AST into standard, human-readable React + TSX.

- ✅ `compileReact(doc)` — deterministic, readable output: imports (sorted,
  deduped), local `function` components for `def`, ternaries for `If/Else`,
  `.map()` for `For`, interpolated bindings in text, named actions.
- ✅ Compaction pass so generated output is ≤ hand-written React in every
  scenario (driven by the token validator — see Phase 4).
- ✅ 19 unit tests covering lexer, parser, text resolution, and compiler.
- ⬜ Prettier-grade formatting options and JSX `key` emission for `For` loops.
- ⬜ Round-trip: canonical source printing (`AST → .aui`).

## Phase 4: AI Integration and Benchmarking — ✅ token benchmarking shipped, real-LLM benchmarks planned

**Goal**: Prove that an LLM generates this syntax better than TSX.

- ✅ Token methodology: `apps/www/scripts/validate-tokens.ts` counts every
  scenario three ways (`.aui` / generated / hand-written) with the real GPT-4
  tokenizer (`cl100k_base`) and writes `token-report.json` (checked into git;
  `--check` verifies it stays current).
- ✅ Result: **1,080 tokens saved across six real screens — 48% fewer, 1.9×
  smaller than hand-written React** (see `docs/token-methodology.md`).
- ⬜ Live LLM benchmarks: have actual Claude/GPT models generate the same six
  screens in `.aui` vs TSX; compare validity, repair iterations, tokens, and
  visual fidelity.
- ⬜ Error-recovery loop: validation failures formatted back to the LLM for
  self-correction.

## Phase 5: Tooling and Ecosystem — ⬜ planned

- ⬜ CLI (`aui build` / `aui validate`) so the DSL is usable outside the site.
- ⬜ VS Code extension (syntax highlighting + live preview).
- ⬜ Non-React backends (HTML, React Native, SwiftUI) via a target-neutral IR.
- ⬜ Escape hatches (expression language) **after** the core stabilizes.

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Parser accepts valid v0 grammar; deterministic ASTs | ✅ (19 tests) |
| Repairable diagnostics suitable for an LLM | 🚧 partial (playground registry check) |
| Registry maps core components to ≥1 real library | 🚧 contract shipped; adapter planned |
| Compiler outputs accessible, type-safe React/TSX | ✅ (deterministic; a11y defaults via semantic nodes) |
| Measured token savings vs TSX | ✅ (1,080 tokens, 1.9×, reproducible) |
| Real-LLM generation benchmark | ⬜ next major milestone |
