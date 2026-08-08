# Token Methodology

The Examples gallery on the website claims real numbers — **1,080 tokens
saved, 48% fewer, 1.9× smaller than hand-written React** — and this document
is the receipt. Every number is reproducible.

## What we count

Each of the six gallery scenarios is measured **three ways**:

| Side | Source | Notes |
|---|---|---|
| `.aui` | `screen.aui` — the exact source shown in the card | What the LLM writes. |
| **Generated** | `compileReact(parse(screen.aui))` — deterministic compiler output | What the tool produces from the same AST. |
| **Hand-written** | `apps/www/src/lib/handwritten.ts` — realistic React implementations | What a competent engineer would write: imports, handlers, local components. Authored by hand, committed to the repo. |

## The tokenizer

All counts use [`gpt-tokenizer`](https://www.npmjs.com/package/gpt-tokenizer)
— the **real GPT-4 / GPT-3.5 BPE tokenizer** (`cl100k_base`), the same
encoding OpenAI's API charges by. Nothing is minified, estimated, or
approximated.

## Fairness rules

1. **Data flows through bindings.** Both sides reference the same data; `.aui`
   writes `value=$metrics.active`, hand-written React writes
   `value={data.metrics.active}`. No side is given a cheat.
2. **`def` templates count as components.** `.aui` declares
   `def StatCard …` and the hand-written side declares a `StatCard` function —
   each counted in full on its own side.
3. **Imports count.** Every `import` line counts on both sides.
4. **No comments.** Whitespace is minimal but real; no decorative comments on
   either side.
5. **Hand-written is honest.** It's the kind of file a real engineer ships —
   not golfed, not padded.

## The numbers (v0.1.0)

| Scenario | `.aui` | Generated | Hand-written | Tokens saved | React larger |
|---|---|---|---|---|---|
| Third-party libraries | 168 | 294 | 294 | 126 | 1.8× |
| Reusable components | 117 | 227 | 255 | 138 | 2.2× |
| UI logic (If/Else/For) | 131 | 268 | 270 | 139 | 2.1× |
| Business logic wiring | 158 | 288 | 358 | 200 | 2.3× |
| Dashboard on live data | 302 | 513 | 538 | 236 | 1.8× |
| Everything at once | 292 | 502 | 533 | 241 | 1.8× |
| **Total** | **1,168** | **2,092** | **2,248** | **1,080** | **1.9×** |

`token-report.json` (in `apps/www/`) is the committed source of truth the
Examples page renders.

## Reproducing

```bash
cd apps/www

# Re-count everything, print the table, rewrite token-report.json:
npm run validate:tokens

# Verify the committed report is still current (fails if not):
npm run validate:tokens -- --check
```

The script (`apps/www/scripts/validate-tokens.ts`) parses every scenario,
compiles it with the real compiler, counts all three sides with the real
tokenizer, and exits non-zero if:

- `.aui` is ever larger than hand-written React (the whole thesis fails), or
- a hand-written corpus entry is missing, or
- (with `--check`) the committed report drifted from reality.

## What the validator caught

The first run of the validator found the compiler's output was *more verbose*
than compact hand-written React (text children on their own lines, multi-line
imports). The generator was fixed to emit single-line text elements and
compact imports — now the tool's output is ≤ hand-written React in every
scenario. **The measurement tool improved the product.** That's why the
numbers live in code, not copy.
