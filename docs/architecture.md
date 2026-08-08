# Architecture (v0.2)

AI UI AST is **an LLM-first, validated UI language with a deterministic
compiler** — not a generic token-compression parser. The value is that a
compiler (not the model) owns imports, JSX, bindings, events, and formatting,
and a host-owned registry constrains what the model may express. Token
savings are a measured consequence of the small grammar, and
`docs/token-methodology.md` is the receipt.

It is a TypeScript monorepo with two workspaces and a documentation layer.

```text
ai-ui-ast/
├── packages/parser/       # @codedia/parser — the published npm module
│   └── src/
│       ├── lexer.ts       # quote-aware comments, indentation metadata, typed RawValue
│       ├── parser.ts      # parse(source) → RawDocument
│       ├── ast.ts         # raw AST + canonical IR types
│       ├── diagnostics.ts # stable codes, line/column, LLM-repair formatting
│       ├── registry.ts    # defineRegistry + CORE_REGISTRY + event/import metadata
│       ├── validate.ts    # registry/structural/indentation/identifier/limits
│       ├── normalize.ts   # RawDocument → CanonicalDocument
│       ├── bindings.ts    # binding paths, scope model, path safety
│       ├── react.ts       # canonical IR → React + TSX
│       ├── print.ts       # canonical .aui printer (round-trip)
│       ├── compile.ts     # high-level parse→validate→normalize→compile
│       └── *.test.ts      # 79 unit tests (node:test)
├── apps/www/              # the website (Vite + React 19, hash-routed)
│   ├── src/pages/         # Home, Language, Examples, Playground, Roadmap
│   ├── src/lib/           # website registry (extends the package), samples,
│   │                      # gallery + feature contracts, mock data, resolution,
│   │                      # handwritten corpus, token counting, regression tests
│   └── scripts/           # validate-tokens.ts + benchmark/ (LLM harness, briefs)
├── docs/                  # API, grammar, compiler, token methodology, architecture
└── skills/write-aui-ui/   # agent skill
```

## Data flow

```text
.aui source
   │
   ▼
lexer.ts ── scan ──► Token[] + lexical diagnostics
   │
   ▼
parser.ts ── parse ─► RawDocument { rootNodes, imports?, components? }
   │
   ├───────────────────────────────┐
   ▼                               ▼
validate.ts                  normalize.ts
(registry, structural,       (bare → token/list/string via registry,
 indentation, identifiers,    If/Else → IfNode, For → ForNode,
 bindings, limits)            def params unified, typed defaults)
   │                               │
   │                               ▼
   │                       CanonicalDocument
   │                               │
   └──────────────┬────────────────┤
                  ▼                ▼
            compileReact      preview (www)
            (react.ts)        (canonical IR + shared scope frames)
                  │
                  ▼
            React + TSX
```

The pipeline is deliberately staged so that semantics live in exactly one
place: the **canonical IR**. Compilers and the preview consume the same
typed values, the same explicit `If`/`For` nodes, the same def-param model,
and the same binding-scope rules (`packages/parser/src/bindings.ts`). There
is no second implementation to drift.

## Key design decisions

### 1. Two AST layers: raw and canonical
`parse()` produces a **raw** tree with syntax-level value kinds (`string`,
`binding`, `number`, `boolean`, `bare`) — no semantics. `normalize()` produces
the **canonical** IR, classifying bare values against the registry and
materializing structural nodes. Compilers and previews only see canonical
nodes; the compiler never guesses semantics from strings.

### 2. The registry is the safety boundary
`defineRegistry({ ... })` declares nodes, prop types/tokens, child
constraints, event mappings, and third-party imports. Strict compilation is
registry-only: using `AreaChart` imports it from its mapped source, and no
import line can invent a dependency. Explicit imports exist only behind a
documented compat/allowlist option.

### 3. Validation is first-class and repairable
`validate(source, opts)` runs in the package (not the website) and emits
stable-code diagnostics with line/column and fix hints — designed for LLM
repair loops (`formatDiagnosticsForLLM`). Structural checks (orphan/duplicate
`Else`, `For` without a list), indentation (strict vs LLM-friendly), binding
safety, and resource limits are all covered.

### 4. Compiler output is valid by construction
One shared `renderJsxChildren` helper handles every JSX expression context
(`null` / direct / fragment), so multi-child branches, loops, defs, and
document roots always emit valid TSX. Loops get deterministic keys; event
props map through the registry; the package test suite runs every golden
fixture through a TSX transpile gate.

### 5. The website is a thin consumer
The website no longer re-implements validation or semantics: the playground
calls the package `compile()`, the preview renders the canonical IR with the
package's scope model, and only UI-specific rendering concerns (styles,
icons, mock data) live in `apps/www`.

### 6. Token measurement is a first-class tool
`apps/www/scripts/validate-tokens.ts` uses explicitly pinned encodings
(`o200k_base` primary, `cl100k_base` legacy), a functional-equivalence gate
per scenario, a TSX syntax gate, and cold/warm instruction-overhead
accounting — and writes `apps/www/token-report.json`, which the Examples page
renders. No approximation on the benchmark path.

## Testing strategy

- **Parser package** — 79 `node:test` unit tests across lexer, parser,
  validator, normalizer, compiler (with the TSX transpile gate), printer
  (round-trip), and the high-level `compile()` API.
- **www rendering regression test** — compiles *every* sample and gallery
  scenario through the strict pipeline and walks the canonical IR with the
  shared resolver, asserting no `[object Object]`, no `undefined`, no
  unresolved `$binding`.
- **Token validation** — `validate:tokens --check` fails if the committed
  report drifts, a scenario fails strict compilation, a feature is missing
  from either implementation, or generated TSX fails the syntax gate.
- **LLM benchmark** — `benchmark:llm` runs the 36-brief corpus in fixture
  mode (CI-safe) and opt-in live mode.

## Future targets

- CLI (`aui build` / `aui validate`)
- VS Code extension (syntax highlighting + live preview)
- Non-React backends (HTML, React Native, SwiftUI) via the canonical IR
- Escape hatches (expression language) after the core stabilizes
