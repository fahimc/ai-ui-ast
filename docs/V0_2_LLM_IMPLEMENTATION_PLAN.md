# AI UI AST v0.2 — LLM Implementation Plan

> **Status: implemented (v0.2.0).** All phases (0–11) were executed in
> `packages/parser` and `apps/www`. See `CHANGELOG.md` for the release notes
> and `docs/architecture.md` for the resulting pipeline.

> **Purpose:** This document is an implementation brief for a coding LLM/agent. It captures the findings from a code-level review of `@codedia/parser` v0.1.0 and turns them into an ordered, test-driven plan for v0.2.
>
> **Primary goal:** evolve AI UI AST from a strong proof of concept into a validated, deterministic, LLM-first UI language whose generated output is syntactically valid, semantically consistent, design-system constrained, and honestly benchmarked.

---

## 1. Product thesis to preserve

Do **not** turn `.aui` into another general-purpose programming language.

The product is strongest when the model expresses **UI intent** in a small declarative language and deterministic software owns implementation details:

```text
LLM -> .aui -> parse -> validate/normalize -> canonical UI IR -> target compiler
                                                       -> React
                                                       -> HTML
                                                       -> future targets
```

Keep these properties:

- indentation-based UI tree
- semantic names such as `Stack`, `Card`, `Heading`, `Button`
- `$binding` references
- named actions rather than inline JavaScript
- reusable `def` templates
- no arbitrary JavaScript expressions in `.aui`
- no raw CSS/className/style in the core language
- deterministic compiler output
- host-owned design-system mapping
- minimal runtime dependencies

The v0.2 objective is **not** to chase a larger raw token-reduction percentage by making the syntax cryptic. The objective is to prove that AUI uses fewer tokens **and** generates valid, brand-consistent UI more reliably than direct React generation.

---

## 2. Execution rules for the coding LLM

Implement this plan autonomously phase by phase.

1. Inspect the current implementation before changing a subsystem.
2. Work in the phase order below unless a dependency requires a small prerequisite change.
3. Add or update tests with every behavioral change.
4. At the end of every phase run the relevant package tests, TypeScript build, website tests, and benchmark validation where applicable.
5. Do not weaken existing tests to make new code pass.
6. Do not silently change language semantics. Update grammar/API/compiler docs whenever semantics change.
7. Preserve the zero-runtime-dependency goal for `@codedia/parser` unless a dependency has a compelling reason to be runtime code. Dev/test-only dependencies are acceptable.
8. Do not fabricate benchmark numbers. If a live LLM benchmark cannot run because API credentials are absent, implement the harness and document how to run it.
9. Keep public claims aligned with implemented behavior. If a feature is not implemented, remove or clearly mark the claim until it is.
10. Continue automatically through the phases. Only stop for a genuine external blocker that cannot be resolved in-repo.

Recommended validation command after major phases:

```bash
npm install
npm test -w @codedia/parser
npm run build -w @codedia/parser
npm test -w www
npm run build -w www
npm run validate:tokens -w www -- --check
```

If scripts change as part of this plan, update the command set accordingly.

---

# 3. Confirmed findings from the v0.1.0 review

## P0 — Generated React can be syntactically invalid for multiple direct children

`compileReact()` joins rendered children with newlines. This fails when JSX expression contexts require a single expression/root.

Affected shapes include:

```aui
For each=$users
  Text $item.name
  Badge $item.status
```

which can become conceptually:

```tsx
{data.users.map((item, i) => (
  <Text>{item.name}</Text>
  <Badge>{item.status}</Badge>
))}
```

That is invalid JSX because there are adjacent siblings without a fragment/container.

The same class of failure can affect:

- `If` branches with multiple direct children
- `Else` branches with multiple direct children
- `def` bodies with multiple root children
- document output with multiple root nodes

The preview renderer often hides this because it independently wraps children in React fragments.

### Required fix

Create one shared compiler helper for expression/root children:

```ts
renderJsxChildren(nodes, ctx, mode)
```

Behavior:

- 0 children -> `null` when an expression is required
- 1 child -> render directly
- 2+ children -> wrap in `<>...</>`

Use it consistently for `If`, `Else`, `For`, `def` bodies, and component/page roots.

### Required tests

Add generated-code fixtures for all multi-child cases and make the test suite actually parse/type-check the emitted TSX rather than relying only on regex assertions.

---

## P0 — The AST loses value types

Current `Prop` stores:

```ts
interface Prop {
  key: string
  value: string
}
```

This collapses important distinctions:

```aui
level=2
round=true
tone=success
value=$user.name
label="hello"
label="$user.name"
```

The compiler therefore has to guess from string contents. Numeric and boolean props can be emitted as strings, and a quoted literal beginning with `$` can become indistinguishable from a binding.

### Required architecture

Introduce lexical/raw value kinds, then normalize them against the registry.

Suggested raw value shape:

```ts
export type RawValue =
  | { kind: 'string'; value: string }
  | { kind: 'binding'; path: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'bare'; value: string }
```

The parser can identify syntax-level facts without knowing component semantics. A later normalization step may turn `bare` into a token/enum/string according to registry metadata.

Suggested canonical value shape:

```ts
export type Value =
  | { kind: 'string'; value: string }
  | { kind: 'binding'; path: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'token'; value: string }
  | { kind: 'list'; value: string[] }
```

Do not infer semantic types in the React compiler. The compiler should consume normalized values.

### Compatibility

This is a public AST change. Treat it as a v0.2 API change, document migration, and add tests showing old source syntax still parses as intended.

---

## P0 — Validation exists only in the website, not the published parser package

`apps/www/src/lib/validate.ts` contains useful registry-based validation, but npm consumers calling:

```ts
const doc = parse(source)
const code = compileReact(doc)
```

bypass it completely.

### Required fix

Move validation into `packages/parser` and make it first-class API.

Suggested modules:

```text
packages/parser/src/
  diagnostics.ts
  registry.ts
  validate.ts
  normalize.ts
```

Suggested API:

```ts
parse(source): RawDocument
validate(doc, registry?, options?): Diagnostic[]
normalize(doc, registry?, options?): Result<CanonicalDocument>
compileReact(doc, options?): string
compile(source, options?): CompileResult
```

Suggested convenience result:

```ts
interface CompileResult {
  code?: string
  rawAst: RawDocument
  ast?: CanonicalDocument
  diagnostics: Diagnostic[]
  ok: boolean
}
```

`compile(source, { strict: true })` must refuse to emit code if error-level diagnostics exist.

Diagnostics must include at minimum:

- line
- column where feasible
- code (stable machine-readable identifier)
- severity
- human/LLM-readable message
- optional suggestion/fix hint

Example:

```text
AUI_INVALID_TOKEN at line 7:
<Button> variant="purple" is invalid.
Expected one of: primary, secondary, ghost, danger.
```

Diagnostics should be intentionally easy to feed back to an LLM for one-shot repair.

---

## P0 — Benchmark scenarios are not always functionally equivalent

The current "Business logic wiring" hand-written React includes real `onChange` handlers, while AUI currently only binds `value=` and does not generate equivalent change behavior.

This means the React side pays tokens for functionality the AUI side does not express.

Other equivalence issues to audit include:

- numeric/boolean prop typing
- loop keys
- form change events
- actual state mutation semantics
- imported component prop behavior

### Required rule

A token benchmark may compare two implementations only when they have equivalent user-visible and interaction behavior.

Add a machine-readable feature checklist to every scenario, for example:

```ts
interface BenchmarkScenario {
  id: string
  features: {
    render: string[]
    bindings: string[]
    actions: string[]
    events: string[]
  }
  auiCode: string
  handwritten: string
}
```

The benchmark should fail when the declared feature contract is missing from either implementation where this can be statically checked.

---

## P0 — "Safe by construction" is stronger than the current implementation

The parser accepts arbitrary node names and props. More importantly, explicit model-authored imports allow arbitrary package specifiers to enter generated source.

The core safety story should be:

> AUI is constrained by a host-owned registry and does not permit arbitrary executable expressions.

### Required import design

Make the registry the normal way third-party components are exposed.

Host application:

```ts
const registry = defineRegistry({
  AreaChart: {
    source: '@company/charts',
    export: 'AreaChart',
    props: { /* ... */ }
  }
})
```

Model output:

```aui
AreaChart data=$series
```

The compiler derives imports from the registry.

Keep raw `import` syntax only as an explicit compatibility/advanced mode, for example:

```ts
{ imports: { mode: 'explicit', allow: ['recharts'] } }
```

or:

```ts
{ unsafeImports: true }
```

Default strict compilation should be registry-only or allowlist-only.

Also validate identifiers and import specifiers. Do not permit malformed names to reach generated TypeScript.

---

## P1 — Side-effect import support is inconsistent

The lexer recognizes:

```aui
import "pkg"
```

but the React compiler's import construction path is designed around named/default imports and can emit malformed output for a side-effect-only import.

### Required fix

Either:

1. correctly support side-effect imports end-to-end, including tests, or
2. reject them in strict v0.2 if registry-only imports become the default.

Do not advertise unsupported import forms.

Also explicitly decide whether aliases such as `import { A as B } ...` and namespace imports are supported. Reject unsupported import grammar with a repairable diagnostic rather than partially parsing it.

---

## P1 — Comments are documented but not actually lexed correctly

The docs advertise `#` line comments. The current lexer does not perform quote-aware comment stripping before tokenization.

This can break examples such as:

```aui
Heading "Dashboard" # title
Area stroke="#a78bfa" # hex colour must remain inside the string
```

### Required fix

Implement a quote/escape-aware line scanner that removes `# ...` only when `#` occurs outside a quoted string.

Do not use naive `line.split('#')` logic.

Test:

- full-line comments
- trailing comments
- `#` inside quoted strings
- escaped quotes before `#`
- comments after imports
- comments after bindings/text

---

## P1 — Indentation is parsed but not validated

The grammar says indentation must be consistent, but the lexer simply counts whitespace characters.

Mixed tabs/spaces and arbitrary indentation jumps can silently produce a different tree from the author's intent.

### Required behavior

Support two modes:

#### Strict mode

- spaces only by default
- infer or configure indent width (default 2)
- every nesting transition must match valid levels
- mixed tabs/spaces are errors

#### LLM-friendly mode

- infer indentation unit from the first nested line
- normalize consistent visual levels where safe
- emit warnings for suspicious inconsistencies
- never silently reinterpret an ambiguous tree

Diagnostics should point to the offending line and expected indentation level.

---

## P1 — `Else` is attached without verifying it belongs to an `If`

The parser has custom stack behavior that makes valid `If`/`Else` syntax work, but an orphan `Else` is not rejected. The website validator explicitly skips `Else` with a comment saying structural validation occurs later, but that later structural validation is absent.

### Required fix

Run tree-level structural validation after parse.

Rules:

- `Else` must belong to exactly one preceding `If` at the same logical indentation level
- an `If` may have at most one `Else`
- `Else` cannot contain another `Else` as its structural partner
- orphan `Else` is an error

Prefer normalizing `If` into an explicit canonical node:

```ts
interface IfNode {
  kind: 'if'
  condition: Value
  then: Node[]
  else?: Node[]
}
```

rather than carrying `Else` as a pseudo-child into every backend. This is one reason a canonical IR is useful.

---

## P1 — `def` parameter semantics diverge between compiler, validator, and preview

Current representation separates required parameters and default props. Different code paths treat defaulted parameters differently.

Example:

```aui
def StatCard label value tone=default
```

`tone` is semantically a parameter, but it can disappear from validator/preview parameter scope because it lives in `defaultProps` rather than `params`.

### Required fix

Represent component parameters in one canonical structure:

```ts
interface ComponentParam {
  name: string
  defaultValue?: RawValue | Value
  required: boolean
}

interface ComponentDef {
  name: string
  params: ComponentParam[]
  children: Node[]
}
```

Every subsystem must consume the same structure:

- validator
- normalizer
- preview
- React compiler
- future backends

Add tests for defaulted params in text, props, nested bindings, and missing required params.

---

## P1 — `Page data=` is described as a scope but does not establish lexical data scope

Current generated bindings are generally rooted directly at `data`, regardless of `Page data=$metrics`.

Implementing real scope can improve both semantics and token efficiency.

Suggested behavior:

```aui
Page Dashboard data=$metrics
  Metric value=$revenue
  Metric value=$users
  AreaChart data=$series
```

may compile against `data.metrics` as the local scope.

### Required design

Introduce binding scope into canonical IR/compiler context.

Potential rules:

- global/root data object remains available
- `Page data=$metrics` establishes child scope `data.metrics`
- inside the page, `$revenue` resolves relative to that scope
- an explicit absolute syntax may be added only if needed, e.g. `$root.user.name`
- `For` introduces `$item` and `$index`
- `def` introduces component param bindings

Write the scoping rules clearly in `docs/grammar.md` before implementation is considered complete.

Do not create ambiguous shadowing. Add diagnostics when a binding root could refer to multiple scopes.

---

## P1 — Forms/events need real semantics

AUI currently has named button actions but no equivalent semantic event mechanism for inputs/selects/toggles.

### Required v0.2 event model

Add named event props without exposing React event objects in `.aui`.

Example:

```aui
Input value=$form.email change=emailChanged
Select value=$form.plan change=planChanged
Checkbox checked=$form.remember change=rememberChanged
Button action=pay "Pay"
```

Generated host contract:

```ts
onAction(name: string, payload?: unknown): void
```

Example React mapping:

```tsx
<Input
  value={data.form.email}
  onChange={(e) => onAction('emailChanged', e.target.value)}
/>
```

Registry metadata should own target-specific event extraction rather than hard-coding every React event in the language.

Suggested registry event schema:

```ts
events: {
  change: { target: 'onChange', payload: 'target.value' }
}
```

For checkbox/switch:

```ts
payload: 'target.checked'
```

Keep the source language semantic (`change=`), not framework-specific (`onChange=`).

### `State`

`State` is currently advertised but not implemented consistently. Do **not** ship a half-defined state language.

For v0.2 choose one explicit policy:

- **Recommended:** remove `State` from the implemented feature list and make the validator report it as reserved/not-yet-supported until a complete state-transition model is designed.

If implementing it instead, first define how state is initialized, read, mutated, scoped, serialized, and represented across non-React backends. Do not simply generate `useState` without a language-level mutation model.

---

## P1 — Preview, validator, and compiler implement semantics independently

The live preview sometimes behaves more correctly than the compiler because each subsystem re-implements loops, defs, booleans, bindings, and structural nodes.

This causes semantic drift.

### Required fix

Create a canonical normalized IR and shared semantic helpers.

Preferred flow:

```text
source
  -> lexer/parser
  -> RawDocument
  -> validate + normalize
  -> CanonicalDocument
       -> React compiler
       -> preview renderer
       -> future HTML compiler
```

The preview must render the canonical representation, not reinterpret raw parser nodes with separate rules.

Compiler and preview should share:

- binding scope resolution rules
- component-def param metadata
- typed prop values
- structural `If` representation
- loop metadata
- registry definitions

Target-specific rendering remains separate.

---

## P1 — Registry currently lives in the website instead of the package

The website has a useful `NODE_SPECS` registry containing prop names, types, token values, required flags, descriptions, and child guidance.

Move the generic registry schema into `@codedia/parser`.

Suggested API:

```ts
const registry = defineRegistry({
  Button: {
    category: 'Controls',
    props: {
      variant: token(['primary', 'secondary', 'ghost', 'danger']),
      action: string(),
      size: token(['sm', 'md', 'lg']),
      disabled: boolean(),
    },
    children: 'text',
  },
})
```

Keep a default/core registry exported by the package.

The website may extend it with preview-specific rendering metadata, but language validation must not depend on `apps/www`.

Validate:

- node existence
- allowed props
- required props
- prop types
- token enums
- child constraints
- text-content constraints
- structural placement
- imported/registered third-party nodes

---

## P1 — Generated code needs a real syntax/type validity gate

Current compiler tests mostly assert output strings with regexes. That is insufficient for a source-to-source compiler.

### Required tests

Every golden compiler fixture should pass at least a TSX parser/transpiler step.

Options:

- TypeScript `transpileModule`
- `tsc` against generated fixture files
- esbuild parser in dev/test dependencies

Prefer a check that catches both JSX syntax errors and important TypeScript errors.

Add fixtures for:

- multiple roots
- multi-child `If`
- multi-child `Else`
- multi-child `For`
- nested `For` + `If`
- `def` with multiple roots
- numeric props
- boolean props
- string values beginning with `$`
- text containing braces/quotes/backslashes/newlines
- invalid identifiers
- action names containing quotes/backslashes
- registry imports
- explicit/side-effect imports if supported

The compiler contract should be: **valid canonical input always produces syntactically valid target output**.

---

## P2 — Token benchmark tokenizer metadata is not robust

The current benchmark imports bare `encode()` from `gpt-tokenizer` while the documentation labels the encoding as `cl100k_base`.

Do not depend on a tokenizer package's default encoding.

### Required fix

Explicitly import/select each encoding used by the benchmark and write the exact encoding/model mapping into the report.

At minimum report:

- `o200k_base` for current OpenAI-family measurements where appropriate
- `cl100k_base` as a legacy comparison if useful

Where practical add additional tokenizer families relevant to coding agents, but do not block v0.2 on every provider.

The report should look conceptually like:

```json
{
  "tokenizers": {
    "o200k_base": { "aui": 0, "handwritten": 0, "reductionPct": 0 },
    "cl100k_base": { "aui": 0, "handwritten": 0, "reductionPct": 0 }
  }
}
```

### Remove silent approximation

Current token counting falls back to roughly `chars / 4` on tokenizer failure.

Benchmark/validation code must fail loudly instead. Approximation may be exposed only through a separately named UI helper such as `estimateTokens()`, never through the reproducible benchmark path.

---

## P2 — Current benchmark proves compression, not LLM generation quality

The stronger product hypothesis is:

> An LLM can generate AUI with fewer tokens, fewer retries, and higher first-pass validity than equivalent React.

Implement a benchmark harness that compares direct React generation against AUI generation from the same UI briefs.

### Dataset

Create a versioned corpus of at least 30-50 briefs spanning:

- static marketing/UI cards
- dashboards
- forms
- settings screens
- lists/tables
- conditional states
- empty/loading/error states
- nested loops
- reusable patterns
- imported/registry chart components
- responsive layouts
- accessibility-sensitive controls

Each brief should include an explicit functional contract so outputs can be scored.

### Conditions

For each brief run:

1. **React condition** — model receives design-system/React instructions and writes target React.
2. **AUI condition** — model receives the AUI skill/spec and writes `.aui`, then deterministic compiler runs.

Run multiple samples per model/brief when budget permits.

### Metrics

Measure:

- prompt/input tokens
- output tokens
- AUI skill/spec instruction overhead
- cold-start total tokens
- warm/cached/amortized total tokens
- first-pass parse success
- first-pass validation success
- first-pass generated TSX syntax/type success
- number of repair turns
- tokens consumed by repairs
- final task completion rate
- functional contract pass rate
- accessibility checks where automatable
- render/visual fidelity where automatable
- latency
- estimated cost by model

Do not report only successful runs; failures are part of the result.

### Instruction-overhead accounting

Report at least two modes:

- **Cold:** full AUI instruction/skill cost charged to each request.
- **Warm:** skill/system context cached or amortized across many screens.

This prevents the token claim from ignoring the cost of teaching a model a custom grammar.

### No fabricated data

The repository may include a runner requiring environment API keys, but CI should use deterministic fixtures/mocks unless paid benchmark execution is intentionally configured.

---

# 4. Additional hardening and quality improvements

These were not all headline bugs, but they should be addressed while the related subsystems are open.

## 4.1 Binding path safety

Use own-property checks rather than inherited-property traversal in runtime resolvers. Consider rejecting dangerous path segments such as:

- `__proto__`
- `prototype`
- `constructor`

Bindings should be identifier/path data references, never an expression language.

## 4.2 Resource limits

Add configurable defensive limits for untrusted/model-generated input:

- maximum source bytes
- maximum lines
- maximum nesting depth
- maximum node count
- maximum props per node
- maximum component-def count

Return diagnostics rather than stack overflow or runaway recursion.

## 4.3 Identifier validation

Validate names before code generation:

- `Page` labels used as component names
- `def` names
- `def` params
- imported aliases if explicit imports remain
- node names

Sanitize only where semantics are obvious. Prefer diagnostics over silently changing user-defined identifiers.

## 4.4 Duplicate/conflicting declarations

Detect and report:

- duplicate `def` names
- duplicate params
- duplicate props on one node
- core registry name shadowed by a `def`
- imported name colliding with a `def` or core node
- multiple `Page` roots if the language intends one page per source

Define the desired behavior in the grammar.

## 4.5 Canonical printer / round-trip

Implement a canonical `.aui` printer once typed AST/normalization stabilizes:

```ts
printAui(ast): string
```

Goals:

- deterministic formatting
- normalized indentation
- correct quoting/escaping
- useful for LLM repair loops and formatting tools

Test semantic round-trip:

```text
normalize(parse(printAui(normalize(parse(source)))))
```

should preserve the canonical AST.

## 4.6 Property/fuzz testing

Add generated tests around lexer/parser/printer invariants. Cover:

- empty documents
- empty strings
- quotes/backslashes/newlines
- unicode/emoji
- `#` in strings
- `$` literal vs binding
- numbers/negative numbers/decimals
- booleans
- very deep nesting within allowed limits
- duplicate props
- invalid indentation
- malformed imports
- malformed defs
- reserved identifiers

A dev-only property testing library is acceptable, but keep the shipped parser dependency-free if possible.

---

# 5. Target v0.2 architecture

Aim for this package structure. Exact filenames may vary, but responsibilities should be separated clearly.

```text
packages/parser/src/
  index.ts
  ast.ts               # raw AST + canonical IR types
  diagnostics.ts       # diagnostic codes/types/helpers
  lexer.ts             # lexical scanning, strings/comments/indent metadata
  parser.ts            # source -> RawDocument
  registry.ts          # registry schema + core registry + helpers
  validate.ts          # syntax/semantic/structural validation
  normalize.ts         # RawDocument -> CanonicalDocument
  bindings.ts          # binding paths + scope model
  print.ts             # canonical AUI printer
  react.ts             # canonical IR -> React/TSX
  compile.ts           # high-level parse/validate/normalize/compile API
  *.test.ts
```

Target API shape:

```ts
const result = compile(source, {
  target: 'react',
  registry,
  strict: true,
  imports: { mode: 'registry' },
})

if (!result.ok) {
  console.error(formatDiagnostics(result.diagnostics))
} else {
  console.log(result.code)
}
```

Do not require consumers to know the correct sequence of low-level calls just to get safe output.

---

# 6. Phased implementation order

## Phase 0 — Baseline and regression fixtures

### Tasks

- Run and record current tests/build/token report.
- Add regression tests reproducing every confirmed bug **before fixing it** where practical.
- Add a `test:generated` or equivalent compiler-output validity gate.
- Add representative fixtures under a stable test fixture directory.

### Exit criteria

- Existing behavior has baseline coverage.
- At least one test reproduces the multi-child invalid JSX bug.
- Generated code can be syntax-checked automatically.

---

## Phase 1 — Compiler correctness hotfixes

### Tasks

- Fix multiple-child fragment generation.
- Fix or explicitly reject side-effect imports.
- Validate/sanitize component/function identifiers appropriately.
- Ensure document and `def` multiple roots compile.
- Add loop keys or a deterministic key strategy where target React requires it.
- Preserve deterministic output.

### Exit criteria

- All generated fixtures parse as valid TSX.
- Existing gallery scenarios still compile.
- Multi-root/branch/loop tests pass.

---

## Phase 2 — Typed raw AST and value model

### Tasks

- Introduce `RawValue` kinds.
- Preserve quoted-string-vs-binding distinction.
- Parse number and boolean literals.
- Refactor props/text bindings to use typed values where appropriate.
- Unify `def` required/default params into one parameter model.
- Add migration notes for public TypeScript types.

### Exit criteria

- `"$user.name"` and `$user.name` are distinct in AST.
- numbers and booleans survive parse without string coercion.
- all parser/compiler tests pass against the new model.

---

## Phase 3 — Package-level registry, validation, diagnostics, normalization

### Tasks

- Move generic registry schema/core node definitions from `apps/www` to package.
- Implement structured diagnostics.
- Implement node/prop/token/type/required-child validation.
- Implement `Else` structural validation.
- Implement duplicate/collision validation.
- Add strict/LLM-friendly indentation diagnostics.
- Add resource limits.
- Implement Raw AST -> Canonical IR normalization.
- Export these APIs from package `index.ts`.

### Exit criteria

- npm consumers can validate without importing website code.
- invalid AUI produces line-aware repairable diagnostics.
- canonical IR contains typed normalized props and explicit structural nodes.
- compiler accepts canonical IR.

---

## Phase 4 — Registry-owned imports and adapter contract

### Tasks

- Define registry mapping for target import source/export.
- Make compiler derive core/third-party imports from registry.
- Add strict registry-only default or an allowlisted import policy.
- Keep explicit imports only behind a documented compatibility/advanced option if desired.
- Add collision and missing-component diagnostics.

### Exit criteria

- a model can use a registered third-party component without writing an import line.
- strict mode cannot generate arbitrary package imports.
- import generation remains deterministic and deduplicated.

---

## Phase 5 — Events and honest form semantics

### Tasks

- Add semantic `change=` events for relevant controls.
- Extend host callback to optional payload.
- Add registry event mapping/extraction metadata.
- Make preview fire/show equivalent semantic events where feasible.
- Update business/form examples to be functionally equivalent to hand-written React.
- Remove or reserve `State` unless a complete language-level state model is implemented.

### Exit criteria

- AUI form examples express all behavior counted in React baselines.
- generated React includes valid target handlers through the registry adapter.
- no arbitrary inline JS is added to `.aui`.

---

## Phase 6 — Binding scopes

### Tasks

- Formalize root/page scope, `For` scope, and `def` scope.
- Implement `Page data=` as a real scope or update docs if a different explicit rule is chosen.
- Add `$item` and `$index` canonical bindings.
- Add absolute/root access only if required.
- Use one binding implementation across compiler and preview.

### Exit criteria

- binding resolution rules are documented and tested.
- preview and generated React resolve the same source binding to the same semantic value.
- scoped syntax reduces repetition without ambiguity.

---

## Phase 7 — Lexer/grammar hardening and canonical printer

### Tasks

- Implement quote-aware comments.
- Implement indentation validation/normalization.
- Harden string escaping.
- Decide/reject unsupported import grammar explicitly.
- Implement `printAui()`.
- Add round-trip/property tests.

### Exit criteria

- grammar docs match actual lexer/parser behavior.
- canonical source printing is deterministic.
- comment and indentation adversarial tests pass.

---

## Phase 8 — Unify website preview on package semantics

### Tasks

- Remove duplicate language validation from `apps/www`.
- Make playground call package validator/normalizer.
- Make preview render canonical IR.
- Keep only UI-specific rendering concerns inside the website.
- Ensure defaulted `def` params, booleans, numbers, loops, conditions, events, and scopes behave identically in preview and compiler.

### Exit criteria

- one semantic implementation exists.
- playground cannot show a "working" preview for source that the strict compiler interprets differently.

---

## Phase 9 — Rebuild token methodology

### Tasks

- pin tokenizer encodings explicitly
- remove silent char/4 fallback from reproducible benchmark
- make every benchmark functionally equivalent
- include interaction/event behavior
- record encoding name/version in reports
- report per-tokenizer results
- account for AUI instruction/skill overhead in cold and warm modes
- keep reports generated and reproducible

### Exit criteria

- no benchmark scenario compares unequal functionality.
- reports identify exact tokenizer/encoding.
- tokenizer failure exits non-zero.
- README claims are generated from or directly traceable to benchmark data.

---

## Phase 10 — LLM vs React generation benchmark

### Tasks

- create 30-50 versioned UI briefs
- implement React and AUI prompt conditions
- implement run/result schema
- support multiple models/providers behind adapters
- collect first-pass validity, retries, token totals, functional checks and cost
- produce machine-readable JSON and Markdown summary
- keep paid runs opt-in via environment credentials

### Exit criteria

- harness can run end-to-end on at least one configured provider.
- failed generations are retained and scored.
- summary distinguishes raw output-token savings from total workflow savings.

---

## Phase 11 — Documentation, claims, release readiness

### Tasks

Update:

- root `README.md`
- `packages/parser/README.md`
- `docs/api.md`
- `docs/grammar.md`
- `docs/compiler.md`
- `docs/architecture.md`
- `docs/token-methodology.md`
- `skills/write-aui-ui/SKILL.md`
- `CHANGELOG.md`

Public wording should emphasize:

> AUI lets an LLM express a validated UI tree while deterministic adapters generate framework code against a host-owned design system.

Prefer measured claims such as:

> "In benchmark X using tokenizer/model Y, AUI used Z% fewer generated tokens and achieved N% first-pass valid output."

Avoid universal claims such as "always 48% fewer" or "safe by construction" unless the exact threat model is documented and the claim is demonstrably true.

### Exit criteria

- docs contain no unimplemented features.
- examples compile through strict package API.
- skill syntax matches current language exactly.
- changelog explains breaking AST/API changes.

---

# 7. Required test matrix before v0.2 release

## Lexer/parser

- basic nodes/props/text
- quoted multi-word strings
- escaped quote/backslash/newline
- comment stripping outside quotes
- `#` inside strings
- bindings vs quoted `$` literals
- numeric and boolean literals
- indentation consistency
- tabs/spaces diagnostics
- malformed imports
- malformed defs
- duplicate props
- unicode/emoji

## Structural validation

- orphan `Else`
- duplicate `Else`
- nested `If/Else`
- `For` with missing list binding
- missing required props
- unknown node
- unknown prop
- invalid token
- invalid prop type
- invalid child type
- duplicate defs
- invalid identifiers
- resource-limit failures

## Definitions

- required params
- defaulted params
- defaulted param binding inside text
- defaulted param binding inside props
- missing required param diagnostic
- unknown instance param diagnostic
- multiple root children in def

## Bindings/scopes

- root binding
- page-scoped binding
- nested property
- `$item`
- `$index`
- nested loop behavior
- def params inside loops
- root escape if supported
- dangerous/reserved path segments

## React compiler

- multiple document roots
- multi-child `If`
- multi-child `Else`
- multi-child `For`
- nested structural nodes
- number prop emission
- boolean prop emission
- literal `$` string
- braces in text
- action escaping
- change payload handlers
- registry imports
- explicit imports if compatibility mode remains
- deterministic same-input output
- every fixture passes TSX parser/type gate

## Preview parity

For every sample/gallery/benchmark fixture:

- validate/normalize successfully
- preview accepts canonical IR
- compiler accepts same canonical IR
- text/binding values agree
- no `[object Object]`
- no accidental `undefined`
- no unresolved binding unless intentionally allowed

## Token benchmark

- explicit tokenizer selection
- no approximation fallback
- scenario equivalence metadata present
- committed report drift check
- cold/warm instruction-overhead fields

---

# 8. Suggested acceptance criteria for v0.2

Do not call v0.2 complete until all of these are true:

1. **Compiler correctness:** every valid canonical fixture emits syntactically valid TSX.
2. **Typed semantics:** string/binding/number/boolean/token values are preserved and compiled correctly.
3. **First-class validation:** `@codedia/parser` exports validator/diagnostics and high-level strict compile API.
4. **Structural correctness:** invalid indentation, orphan `Else`, malformed defs/imports, unknown nodes/props and invalid tokens receive repairable diagnostics.
5. **Registry boundary:** normal strict compilation uses a host-owned registry and cannot invent arbitrary dependencies.
6. **Functional forms:** benchmarked controls/events have equivalent AUI and React behavior.
7. **Semantic parity:** playground preview and compiler consume the same canonical semantics.
8. **Binding scopes:** page/loop/def scope behavior is explicit, tested and documented.
9. **Honest token reporting:** exact tokenizer encodings are pinned, approximation fallback is absent, and benchmark pairs are functionally equivalent.
10. **LLM benchmark harness:** repo contains a repeatable experiment measuring generation quality, retries and total token economics.
11. **Documentation truthfulness:** no advertised feature exists only in docs.
12. **Tests/build:** package and website tests/builds are green.

---

# 9. Definition of done for each implementation change

For every feature/fix, the coding agent should complete all applicable items before moving on:

- implementation code
- unit tests
- regression test for the original issue
- generated output syntax/type test where compiler behavior changed
- playground parity test where rendering behavior changed
- grammar/API/compiler documentation update
- sample/gallery update if syntax changed
- benchmark update if functional semantics changed
- changelog entry

Do not leave semantics duplicated in multiple layers.

---

# 10. Final product direction

The defensible version of AI UI AST is not merely:

> "React with fewer tokens."

It is:

> **An LLM-first, validated UI language where models express intent and deterministic adapters generate correct implementation code against a company-owned design system.**

Token efficiency remains a major benefit, but the stronger moat is the combination of:

- smaller model output surface
- constrained grammar
- repairable validation
- deterministic code generation
- design-system enforcement
- dependency control
- backend portability
- measurable first-pass reliability

Prioritize those qualities over increasingly terse syntax.
