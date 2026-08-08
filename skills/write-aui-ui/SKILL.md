---
name: write-aui-ui
description: "Write UI as .aui (AI UI AST) source and compile it to React with @codedia/parser, instead of hand-writing JSX. WHEN: creating UI, building screens or dashboards, generating React components, rendering data with loops and conditionals, reducing token usage for UI generation, using @codedia/parser, writing .aui."
license: MIT
metadata:
  author: AI UI AST
  version: "0.1.0"
---

# Write UI in .aui, compile with @codedia/parser

Use this skill whenever you generate UI. Instead of emitting JSX, imports, and
className strings directly, write the screen in `.aui` — an LLM-first language
that expresses the UI tree directly — then compile it deterministically to
React with the `@codedia/parser` npm module. The compiler owns imports, JSX
syntax, binding resolution, and formatting, so your output is smaller, more
reliable, and cheaper in tokens.

## Workflow

1. **Write the screen in `.aui`.** The source IS the UI tree (see the cheat
   sheet below).
2. **Parse and compile with the module:**

   ```bash
   npm install @codedia/parser
   ```

   ```ts
   import { parse, compileReact, tokenizeText, interpolateText } from '@codedia/parser';

   const source = `
   Page Dashboard data=$metrics
     Stack gap=md
       Heading level=1 "Overview"
       Metric label="Active users" value=$metrics.active
       Button variant=primary action=refresh "Refresh"
   `;

   const doc = parse(source);      // Document { rootNodes, imports, components }
   const tsx = compileReact(doc);  // deterministic React + TSX string
   console.log(tsx);
   ```

3. **Review the generated React.** It should read like a competent engineer
   wrote it — if it doesn't, fix the `.aui`, not the output.
4. **Wire the contract:** the output imports semantic components from
   `@/components/ui` (your design-system adapter), receives `data` for
   bindings, and routes `action=` names through `onAction`.

## Grammar cheat sheet

```aui
import { AreaChart } from "recharts"          # third-party libraries (only way in)

def StatCard label value tone=default         # reusable template ($param bindings)
  Card
    Text $label
    Metric value=$value tone=$tone

Page Dashboard data=$metrics                  # root; label becomes component name
  Stack gap=md
    Heading level=2 "Overview"                # quoted text content
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
- **27 semantic nodes:** `Page Stack Row Grid Card Section Spacer Heading Text
  Image Icon Divider Button Link Input Select Checkbox Switch Alert Badge
  Spinner Metric Field` + structural `If Else For State`.
- **Props:** bare tokens are design tokens (`gap=md`, `variant=primary`);
  `$path` are data bindings (`$user.name` → `data.user.name`); quoted strings
  are literal and may contain `$bindings`.
- **Loops:** `For each=$users` gives you `$item` and `$index`.
- **Actions:** `action=save` only — compiles to `onClick={() => onAction("save")}`.
- **Never:** inline JavaScript, `style`/`className`, invented imports, `eval`.

## Token economics

`.aui` exists because tokens matter. Measured with the real GPT-4 tokenizer
(`cl100k_base`), six real screens save **1,080 tokens (48% fewer, 1.9×)** vs
hand-written React — and the compiled output is *smaller* than hand-written in
every scenario. When a user asks "write me a dashboard", `.aui` is the
cheapest correct answer, and the compiler makes the React for free.

## Reference

- Full grammar: `docs/grammar.md` · API: `docs/api.md` · Compiler rules:
  `docs/compiler.md` · Token math: `docs/token-methodology.md`
- Playground to experiment: <https://ai-ui-ast.netlify.app/#/playground>
- Repo: <https://github.com/fahimc/ai-ui-ast>

## Example: data-driven screen

```aui
import { AreaChart } from "recharts"

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
      AreaChart data=$sales.trend
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
