# Token Methodology (v0.2)

The Examples gallery on the website claims real numbers — **1,140 tokens
saved (`o200k_base`), 50% fewer, 2.0× smaller than hand-written React** — and
this document is the receipt. Every number is reproducible.

## What we count

Each of the six gallery scenarios is measured **three ways**:

| Side | Source | Notes |
|---|---|---|
| `.aui` | the exact source shown in the card | What the LLM writes. |
| **Generated** | `compile(scenario.auiCode, { registry, strict: true })` — deterministic pipeline output | What the tool produces from the same source. |
| **Hand-written** | `apps/www/src/lib/handwritten.ts` — realistic React implementations | What a competent engineer would ship: imports, handlers, local components. Authored by hand, committed to the repo. |

## The tokenizers

All counts use [`gpt-tokenizer`](https://www.npmjs.com/package/gpt-tokenizer)
with **explicitly pinned encodings** — never the package default:

- **`o200k_base`** — the current OpenAI-family encoding (GPT-4o / GPT-4.1);
  the **primary** number reported on the site.
- **`cl100k_base`** — the legacy GPT-3.5 / GPT-4 encoding, reported alongside
  for comparison.

Both encodings are named in `token-report.json` and in the script output.
**There is no approximation fallback.** A tokenizer failure exits non-zero;
the only chars/4 estimate in the codebase is a separately named UI helper
(`estimateTokens`) that the reproducible benchmark never calls.

## Fairness rules (v0.2)

1. **Functional equivalence is checked, not assumed.** Every scenario
   declares a machine-readable `features` contract (`render` nodes,
   `bindings`, `actions`, `events`). The validator fails when a declared
   feature is missing from either implementation where it can be statically
   checked. The form scenario's `change=` events match real `onChange`
   handlers; the business-logic React baseline pays for the same behavior the
   `.aui` expresses.
2. **Data flows through bindings.** Both sides reference the same data; `.aui`
   writes `value=$metrics.active`, hand-written React writes
   `value={data.metrics.active}`.
3. **`def` templates count as components.** `.aui` declares
   `def StatCard …` and the hand-written side declares a `StatCard` function —
   each counted in full on its own side.
4. **Imports count.** Registry-derived imports count on the generated side;
   the hand-written side counts its real import lines. `.aui` has none by
   design — strict mode derives imports from the registry.
5. **No comments.** Whitespace is minimal but real; no decorative comments on
   either side.
6. **Hand-written is honest.** It's the kind of file a real engineer ships —
   not golfed, not padded.

## The numbers (v0.2.0)

`o200k_base` (primary):

| Scenario | `.aui` | Generated | Hand-written | Saved | React larger |
|---|---|---|---|---|---|
| Third-party libraries | 148 | 290 | 294 | 146 | 2.0× |
| Reusable components | 117 | 223 | 255 | 138 | 2.2× |
| UI logic (If/Else/For) | 131 | 264 | 270 | 139 | 2.1× |
| Business logic wiring | 177 | 373 | 383 | 206 | 2.2× |
| Dashboard on live data | 282 | 513 | 538 | 256 | 1.9× |
| Everything at once | 278 | 498 | 533 | 255 | 1.9× |
| **Total** | **1,133** | **2,161** | **2,273** | **1,140** | **2.0×** |

`cl100k_base` (legacy): **1,120 / 2,148 / 2,248 — 1,128 saved, 50%, 2.0×.**

`token-report.json` (in `apps/www/`) is the committed source of truth the
Examples page renders, including both encodings and the feature contracts.

## Instruction overhead (cold vs warm)

Teaching a model a custom grammar costs tokens too. The AUI skill
(`skills/write-aui-ui/SKILL.md`) is the instruction set:

- **Cold** — the full skill is charged to every request:
  1,461 tokens (`o200k_base`).
- **Warm** — the skill is cached/amortized across many screens in a session:
  0 tokens per screen.

Both numbers are recorded in `token-report.json` and shown on the Examples
page. The headline savings (1,140 / 50% / 2.0×) are the **warm** numbers —
the raw output-token savings of the language itself.

## Reproducing

```bash
cd apps/www

# Re-measure everything (strict compile → TSX gate → count both encodings →
# check feature equivalence → print → rewrite token-report.json):
npm run validate:tokens

# Verify the committed report is still current (fails if not):
npm run validate:tokens -- --check
```

The script (`apps/www/scripts/validate-tokens.ts`) exits non-zero if:

- `.aui` is ever larger than functionally equivalent hand-written React, or
- generated React exceeds hand-written React, or
- a scenario fails the strict pipeline (parse → validate → normalize →
  compile) or its generated TSX fails the transpile gate, or
- a declared feature is missing from either implementation, or
- (with `--check`) the committed report drifted from reality.

## LLM generation benchmark

Token counts measure the language; the generation benchmark measures the
model. `npm run benchmark:llm -w www` runs a 36-brief corpus (versioned UI
briefs with functional contracts) in two conditions — AUI (model writes
`.aui`, compiler runs) vs direct React — and reports output tokens (both
encodings), first-pass parse/validation/TSX success, repair turns, completion
rate, functional-contract pass rate, and estimated cost. Fixture mode runs
deterministically without API keys (CI-safe); live mode is opt-in via
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Failures are retained and scored —
never filtered out.

## What the validator caught

The v0.2 validator caught the compiler emitting `Page data=` as a passthrough
prop (a language contract, not an adapter prop) and the multi-child
expression bug that produced invalid JSX — both fixed, and the measurement
tool improved the product again. That's why the numbers live in code, not
copy.
