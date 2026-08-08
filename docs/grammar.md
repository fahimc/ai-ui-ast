# Grammar (v0.2)

This is the current, implemented grammar — everything here parses, validates,
and compiles today. `State` is reserved but not implemented (the validator
reports it); nothing else in this document is aspirational.

## Syntax in one screen

```text
Page Dashboard data=$metrics                  # root node with label + props
  Stack gap=md
    Heading level=2 "Overview"                # quoted text content
    Input value=$form.email change=emailChanged   # semantic event
    If condition=$user.admin                  # conditional branch
      Badge tone=success "Admin"
    Else                                      # attaches to its If
      Badge tone=muted "Member"
    For each=$tasks                           # loop over a binding
      Row
        Text "Task $item.title"               # binding inside text
```

Registered third-party components need no import line — the registry owns the
mapping:

```text
AreaChart data=$metrics.series height=280     # compiles to the registry import
```

## Rules

1. **Indentation = nesting.** Children are indented exactly **2 spaces** per
   level. Strict mode rejects tabs and indentation jumps; LLM-friendly mode
   infers the unit and warns. (See [Indentation](#indentation).)
2. **One node per line.** `<type> [label] [prop=value …] [text]`.
3. **A line is:**

   ```text
   LINE      := IMPORT | DEF | NODE
   IMPORT    := "import" ( "{" Name ("," Name)* "}" | Name )? "from" STRING
              | "import" STRING            # side-effect import
   DEF       := "def" Name (Param | Prop)*
   NODE      := Type [Label] (Prop)* [Text]
   Prop      := Ident "=" Value
   Text      := STRING | "$" Path          # trailing quoted string or binding
   Value     := STRING | "$" Path | NUMBER | BOOLEAN | Ident
   ```

4. **Comments** — `#` to end of line, but only **outside** quoted strings
   (`Heading "Dashboard" # title` and `Area stroke="#a78bfa"` both work; the
   hex colour stays inside the string). Escaped quotes are handled.
5. **Empty lines** are ignored.

## Values

Every prop value is classified at parse time and normalized against the
registry before compilation:

| Kind | Example | Meaning |
|---|---|---|
| Bare token | `variant=primary`, `gap=md` | Semantic token — resolved by the registry. |
| Binding | `value=$metrics.active`, `condition=$user.admin` | Data path, resolved against `data`. |
| Quoted string | `label="Active users"` | Literal; may contain spaces and `$bindings` (interpolated). |
| Quoted `$` string | `label="$user.name"` | **Literal string** — quoting turns `$user.name` into text, not a binding. |
| Number | `level=2`, `min=280`, `height=-12.5` | Typed number, never string-coerced. |
| Boolean | `round=true`, `disabled=false` | Typed boolean. |
| List | `options="Free,Pro,Team"` | Comma-split by the normalizer for list-typed props. |
| Text content | `Heading level=2 "Overview"` | Trailing quoted string or `$binding` becomes the node's text. |

### Bindings

- `$user.name` — dotted path resolved against the root `data` prop.
- `$item` / `$index` — inside `For` loops, the current element / index.
- `$param` — inside a `def` template, the template's parameter.
- `$root.path` — explicit absolute access to the root data object.
- `$0`, `$129.00` — **not** bindings (must start with a letter), so prices
  and ordinals stay literal.
- **Path safety** — bindings are data references, never an expression
  language. Segments like `__proto__`, `prototype`, and `constructor` are
  rejected with `AUI_BINDING_DANGEROUS`; runtime resolution uses
  own-property checks.

**Scope rule.** `Page data=$context` names the data context passed to the
page — it is a contract between the host and the generated component, not a
shadowing scope. All bindings resolve against the root `data` object;
`def` bodies introduce `$param` scopes and `For` loops introduce
`$item`/`$index`. This rule is implemented identically by the compiler (which
emits `data.path` / `item.path` / `param`) and the preview (which resolves
values against the same frames) — there is no ambiguous shadowing and no
second semantic implementation to drift.

### Actions & events

- `action=save` compiles to `onClick={() => onAction("save")}`. Only named
  actions — no inline JavaScript, ever.
- `change=emailChanged` is a **semantic event prop** on controls that support
  it (Input, Select, Checkbox, Switch). The registry owns the target mapping
  (`onChange` + payload extraction), so `.aui` never contains framework event
  objects:

  ```aui
  Input value=$form.email change=emailChanged
  Checkbox checked=$form.remember change=rememberChanged "Remember me"
  ```

  compiles to `onChange={(e) => onAction("emailChanged", e.target.value)}`
  and `onChange={(e) => onAction("rememberChanged", e.target.checked)}`.

## Indentation

- **Strict mode (default)** — spaces only (tabs are an error,
  `AUI_INDENT_MIXED_TABS_SPACES`); every nesting transition must move exactly
  2 spaces (`AUI_INDENT_INCONSISTENT` otherwise); root nodes start at
  column 0.
- **LLM-friendly mode** (`indentMode: 'llm'`) — the unit is inferred from the
  first nested line; inconsistencies become warnings instead of errors.
- Diagnostics point at the offending line with the expected indentation.

## Nodes

### Structure
| Node | Props | Notes |
|---|---|---|
| `Page` | `data=$binding` | Root screen; label becomes the component name. `data=` is a context contract. |
| `Header` | | Page header band. |
| `Stack` | `gap=`, `align=` | Vertical layout. |
| `Row` | `gap=`, `align=`, `justify=` | Horizontal layout. |
| `Grid` | `min=`, `gap=`, `cols=` | Responsive grid. |
| `Card` | `max=`, `pad=`, `tone=` | Containers. |
| `Section` | `title=` | Grouped content. |
| `Spacer` | `size=` | Whitespace. |

### Content
| Node | Props | Notes |
|---|---|---|
| `Heading` | `level=1..6`, `tone=` | |
| `Text` | `tone=`, `weight=`, `align=` | Text content or `$binding`. |
| `Image` | `src=`, `alt=`, `round=` | |
| `Icon` | `name=` | |
| `Divider` | | |
| `Avatar` | `src=`, `label=` | |
| `Field` | `label=`, `value=` | Labeled value row. |
| `Metric` | `label=`, `value=` | Numbers/kpis. |

### Controls
| Node | Props | Notes |
|---|---|---|
| `Button` | `variant=`, `action=`, `size=`, `disabled=` | `action=name` routes to `onAction`. |
| `Link` | `href=` | |
| `Input` | `type=`, `placeholder=`, `value=`, `change=` | `change=` is a semantic event. |
| `Select` | `value=`, `options=`, `change=` | `options` is a list prop. |
| `Checkbox` | `checked=`, `change=` | `checked=$binding`. |
| `Switch` | `checked=`, `change=` | |

### Feedback
| Node | Props | Notes |
|---|---|---|
| `Alert` | `tone=` | |
| `Badge` | `tone=` | |
| `Spinner` | `size=` | |

### Logic (structural)
| Node | Props | Notes |
|---|---|---|
| `If` | `condition=$binding` | Compiles to `{cond ? (…) : (…)}` with `Else`. |
| `Else` | — | Must follow its `If` at the same indent; an `If` may have at most one; an orphan/duplicate `Else` is an error. |
| `For` | `each=$binding` (alias `in=`) | Compiles to `.map((item, i) => …)` with deterministic keys. |
| `State` | — | **Reserved, not implemented in v0.2** — the validator reports it until a complete state-transition model exists. |

That's **26 semantic nodes** plus the structural set.

## Declarations

### `import`
```text
import { AreaChart, Tooltip } from "recharts"
import Default from "some-pkg"
import Default, { A } from "pkg"
import "side-effect-pkg"
```

**The registry is the primary way third-party components enter a screen**
(`AreaChart data=$series` with `AreaChart` registered). Explicit `import`
lines are an advanced/compatibility mode, gated by the import policy:

- `{ imports: { mode: 'registry' } }` (default, strict) — explicit imports
  are rejected with a repairable diagnostic pointing at the registry.
- `{ imports: { mode: 'explicit', allow: ['recharts'] } }` — allow-listed
  explicit imports pass through.
- `{ imports: { unsafeImports: true } }` — any import passes through.

Aliases (`import { A as B }`) and namespace imports (`import * as NS`) are
**not supported** and are rejected with a diagnostic — never partially
parsed.

### `def`
```text
def StatCard label value tone=default
  Card
    Text $label
    Metric value=$value tone=$tone
```
- Bare identifiers after the name are **required params**.
- `key=value` entries are params **with defaults**.
- Params are one unified model (`ComponentParam`), consumed identically by
  the validator, normalizer, preview, and every compiler backend.
- Usage: `StatCard label="Active users" value=$metrics.active` — props pass
  through, defaults apply when omitted.
- Defs may appear anywhere at the top level of the document. Duplicate def
  names and duplicate params are errors; shadowing a core registry node is a
  warning.

## What the language forbids

- Arbitrary JavaScript or expressions (`onClick={() => doEvil()}`) — actions
  are named references only.
- Raw `style` / `className` / CSS.
- Model-invented imports (strict mode is registry-only).
- `eval`, template-literal trickery, inline conditionals in source.
- Prototype-polluting binding paths (`__proto__`, `prototype`,
  `constructor`).
