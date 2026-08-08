# Build Plan

**Positioning:** AI UI AST is an **LLM-first, validated UI language with a
deterministic compiler** — not a generic token-compression parser. The
language is a small, AST-shaped DSL; the pipeline (validator + compiler, not
the model) owns imports, JSX, bindings, events, and formatting. Token savings
are a measured consequence of the design, tracked in
`docs/token-methodology.md`.

Status legend: ✅ shipped · 🚧 in progress · ⬜ planned

## Phase 1: Core Parsing and Typed AST — ✅ shipped (v0.2)

**Goal**: Parse `.aui` syntax into a raw, typed, line-annotated AST.

- ✅ Indentation-sensitive lexer with **quote-aware comments**, indentation
  metadata, and typed `RawValue` classification (string / binding / number /
  boolean / bare).
- ✅ `parse(source)` → `RawDocument` with 1-based line numbers.
- ✅ Language constructs: `import` (registry-first), `def` templates with a
  unified `ComponentParam` model, `If`/`Else`, `For`, `$bindings`,
  `action=` named actions, `change=` semantic events, quoted multi-word
  values.

## Phase 2: Registry, Validation, Diagnostics, Normalization — ✅ shipped (v0.2)

**Goal**: Constrain the language with a host-owned registry and fail with
repairable diagnostics before code generation.

- ✅ `defineRegistry` / `extendRegistry` / `CORE_REGISTRY` — nodes, prop
  types/tokens, child constraints, event mappings, third-party imports.
- ✅ Structured diagnostics with stable codes (`AUI_*`), line/column, and fix
  hints; `formatDiagnosticsForLLM` for one-shot repair loops.
- ✅ Node/prop/token/type/required/child validation, structural checks
  (orphan/duplicate `Else`, `For` without a list), indentation validation
  (strict + LLM-friendly), identifier validation, binding-path safety,
  duplicate/collision checks, resource limits.
- ✅ `normalize()` — RawDocument → CanonicalDocument with typed values and
  explicit `If`/`For` nodes.
- ✅ npm consumers validate without importing website code.

## Phase 3: React Compiler — ✅ shipped (v0.2)

**Goal**: Translate validated canonical IR into valid, human-readable,
deterministic React + TSX.

- ✅ Shared `renderJsxChildren` helper — 0/1/2+ children → `null` / direct /
  fragment, fixing the multi-child invalid-JSX bug across If/Else/For/defs/
  document roots.
- ✅ Deterministic loop `key`s; numeric/boolean/list props emit typed JSX;
  `Page data=` consumed as a contract; `$root.` absolute bindings.
- ✅ Registry-derived imports (core adapter + third-party mappings),
  deterministic and deduplicated; side-effect imports supported in compat
  mode; aliases/namespace imports rejected with diagnostics.
- ✅ Semantic `change=` events compile to target handlers with payloads.
- ✅ Every golden fixture passes a real TSX transpile gate.
- ✅ Canonical printer `printAui()` with round-trip tests.

## Phase 4: AI Integration and Benchmarking — ✅ token methodology rebuilt; 🚧 live LLM runs opt-in

- ✅ Token methodology rebuilt: tokenizer encodings pinned explicitly
  (`o200k_base` primary, `cl100k_base` legacy), no chars/4 approximation on
  the benchmark path, per-encoding reports, functional-equivalence feature
  contracts per scenario, TSX syntax gate, cold/warm instruction-overhead
  accounting.
- ✅ Result: **1,140 tokens saved (`o200k_base`) — 50% fewer, 2.0× smaller
  than hand-written React** across six real screens.
- ✅ LLM generation benchmark harness (`npm run benchmark:llm -w www`): 36
  versioned UI briefs with functional contracts, AUI vs React conditions,
  fixture mode (CI-safe) and opt-in live mode (env API keys), metrics for
  tokens, first-pass validity, repairs, completion, contract pass rate, and
  cost.
- 🚧 Live provider runs against real paid models (opt-in via credentials).
- 🚧 Error-recovery loop in live mode: validation failures formatted back to
  the LLM for self-correction.

## Phase 5: Tooling and Ecosystem — ⬜ planned

- ⬜ CLI (`aui build` / `aui validate`) so the DSL is usable outside the site.
- ⬜ VS Code extension (syntax highlighting + live preview).
- ⬜ Non-React backends (HTML, React Native, SwiftUI) via the canonical IR.
- ⬜ Escape hatches (expression language) **after** the core stabilizes.

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Parser accepts valid v0.2 grammar; deterministic raw AST with typed values | ✅ (79 tests) |
| Repairable diagnostics suitable for an LLM (stable codes, line/column, hints) | ✅ |
| Registry maps core components + third-party imports; strict mode is registry-only | ✅ |
| Compiler outputs valid, type-safe React/TSX for every canonical fixture | ✅ (TSX transpile gate) |
| Measured token savings with pinned encodings and equivalence metadata | ✅ (1,140 tokens, 50%, 2.0×) |
| LLM generation benchmark harness runs end-to-end | ✅ (fixture mode; live opt-in) |
| Playground preview and compiler consume the same canonical semantics | ✅ |
