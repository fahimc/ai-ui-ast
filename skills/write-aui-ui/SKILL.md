---
name: write-aui-ui
description: "Write UI as .aui (AI UI AST) source and compile it to React with @codedia/parser, instead of hand-writing JSX. WHEN: creating UI, building screens or dashboards, generating React components, rendering data with loops and conditionals, reducing token usage for UI generation, using @codedia/parser, writing .aui."
license: MIT
metadata:
  author: AI UI AST
  version: "0.2.0"
---

# Write UI in .aui, compile with @codedia/parser

Use this skill whenever you generate UI. Instead of emitting JSX, imports, and
className strings directly, write the screen in `.aui` — an LLM-first language
that expresses the UI tree directly — then compile it deterministically to
React with the `@codedia/parser` npm module. The compiler owns imports, JSX
syntax, binding resolution, event wiring, and formatting, so your output is
smaller, more reliable, and cheaper in tokens.

## Workflow

1. **Write the screen in `.aui`.** The source IS the UI tree (see the cheat
   sheet below).
2. **Compile with the module** — one call runs parse → validate → normalize →
   compile:

   ```bash
   npm install @codedia/parser
   ```

   ```ts
   import { compile, formatDiagnostics } from '@codedia/parser';

   const result = compile(`
   Page Dashboard data=$metrics
     Stack gap=md
       Heading level=1 "Overview"
       Metric label="Active users" value=$metrics.active
       Button variant=primary action=refresh "Refresh"
   `, { strict: true });

   if (!result.ok) {
     // Diagnostics are line-anchored, stable-coded, and LLM-repairable.
     console.error(formatDiagnostics(result.diagnostics));
   } else {
     console.log(result.code);   // deterministic React + TSX
   }
   ```

3. **Review the generated React.** It should read like a competent engineer
   wrote it — if it doesn't, fix the `.aui`, not the output.
4. **Wire the contract:** the output imports semantic components from
   `@/components/ui` (your design-system adapter), receives `data` for
   bindings, routes `action=` names through `onAction`, and routes
   `change=` events through `onAction(name, payload)`.

## Grammar cheat sheet

```aui
Page Dashboard data=$metrics                  # root; label becomes component name
  Stack gap=md
    Heading level=2 "Overview"                # quoted text content
    Input value=$form.email change=emailChanged   # semantic event
    StatCard label="Active users" value=$metrics.active
    If condition=$user.admin                  # {cond ? (…) : (…)}
      Badge tone=success "Admin"
    Else
      Badge tone=muted "Member"
    For each=$tasks                           # {data.tasks.map((item, i) => …)}
      Row
        Text "Task $item.title"               # bindings interpolate inside text
```

- **Indentation = nesting.** One node per line: `Type label prop=value "text"`.
  Use exactly 2 spaces per level — tabs and indentation jumps are validation
  errors in strict mode.
- **Values are typed.** Bare values are design tokens (`gap=md`,
  `variant=primary`); `$path` are data bindings (`$user.name` →
  `data.user.name`); quoted strings are literal and may contain `$bindings`
  (`label="$user.name"` is a literal string, not a binding); `level=2` is a
  number; `round=true` is a boolean.
- **Bindings.** `$item` / `$index` inside `For`; `$param` inside `def`;
  `$root.path` for explicit absolute access. Bindings are data references —
  never `__proto__`, `prototype`, or `constructor` segments.
- **Loops.** `For each=$users` gives you `$item` and `$index`; multi-child
  bodies are compiled into valid keyed fragments for you.
- **Actions.** `action=save` only — compiles to
  `onClick={() => onAction("save")}`.
- **Events.** `change=emailChanged` on Input/Select/Checkbox/Switch compiles
  to the target handler with the right payload (`e.target.value` /
  `e.target.checked`) through the registry — no React event objects in `.aui`.
- **Reusable templates.** `def StatCard label value tone=default` declares a
  component with required params and defaults; `$label`/`$value`/`$tone`
  reference them inside the body.
- **Third-party components.** Never write import lines in strict mode. If a
  component (e.g. `AreaChart`) is registered in the host registry, just use
  it: `AreaChart data=$metrics.series height=280`.
- **Never:** inline JavaScript, `style`/`className`, invented imports,
  `eval`. `State` is reserved and not yet supported.

## Token economics

`.aui` exists because tokens matter. Measured with the real GPT tokenizers
(`o200k_base` primary, `cl100k_base` legacy — pinned explicitly, no
approximation), six real screens save **1,140 tokens (`o200k_base`) — 50%
fewer, 2.0× smaller than hand-written React** under a functional-equivalence
gate. When a user asks "write me a dashboard", `.aui` is the cheapest correct
answer, and the compiler makes the React for free.

## Reference

- Full grammar: `docs/grammar.md` · API: `docs/api.md` · Compiler rules:
  `docs/compiler.md` · Token math: `docs/token-methodology.md`
- Playground to experiment: <https://ai-ui-ast.netlify.app/#/playground>
- Repo: <https://github.com/fahimc/ai-ui-ast>

## Example: data-driven screen

```aui
def StatCard label value tone=default
  Card
    Text $label
    Metric value=$value tone=$tone

Page Sales data=$sales
  Stack gap=lg
    Row gap=md
      StatCard label="Revenue" value=$sales.revenue tone=success
      StatCard label="Orders" value=$sales.orders
    Card
      Heading level=2 "Trend"
      AreaChart data=$sales.trend          # registered chart — no import line
    If condition=$sales.down
      Alert tone=warning "Revenue is trending down"
    Else
      Alert tone=info "Revenue is healthy"
    For each=$sales.regions
      Row
        Badge $item.name
        Metric value=$item.revenue
```

Compile it, review the React, ship it.
