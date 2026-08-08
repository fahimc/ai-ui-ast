# Grammar

This is the current, implemented grammar (v0.1) — everything here parses and
compiles today. The original proposal lives in
[`LANGUAGE_SPEC_V0.md`](../LANGUAGE_SPEC_V0.md).

## Syntax in one screen

```text
import { AreaChart } from "recharts"          # third-party libraries
import Default from "pkg"                     # default import

def StatCard label value tone=default         # reusable component template
  Card
    Text $label
    Metric value=$value tone=$tone

Page Dashboard data=$metrics                  # root node with label + props
  Stack gap=md
    Heading level=2 "Overview"                # quoted text content
    StatCard label="Active users" value=$metrics.active
    If condition=$user.admin                  # conditional branch
      Badge tone=success "Admin"
    Else                                      # attaches to its If
      Badge tone=muted "Member"
    For each=$tasks                           # loop over a binding
      Row
        Text "Task $item.title"               # binding inside text
```

## Rules

1. **Indentation = nesting.** Children are indented deeper than their parent.
   Tabs or spaces both work; be consistent within a file.
2. **One node per line.** `<type> [label] [prop=value …] [text]`.
3. **A line is:**

   ```text
   LINE      := IMPORT | DEF | NODE
   IMPORT    := "import" ( "{" Name ("," Name)* "}" | Name )? "from" STRING
   DEF       := "def" Name (Param | Prop)*
   NODE      := Type [Label] (Prop)* [Text]
   Prop      := Ident "=" Value          # bare, $binding, or quoted string
   Text      := STRING | "$" Path        # trailing quoted string or binding
   Value     := Ident | "$" Path | STRING
   ```

4. **Comments** — `#` to end of line.
5. **Empty lines** are ignored.

## Nodes

### Structure
| Node | Props | Notes |
|---|---|---|
| `Page` | `data=$binding` | Root screen; label becomes the component name. |
| `Stack` | `gap=`, `align=` | Vertical layout. |
| `Row` | `gap=`, `align=`, `justify=` | Horizontal layout. |
| `Grid` | `min=`, `gap=`, `cols=` | Responsive grid. |
| `Card` | `max=`, `pad=`, `tone=` | Containers. |
| `Section` | `title=` | Grouped content. |
| `Spacer` | `size=` | Whitespace. |

### Content
| Node | Props | Notes |
|---|---|---|
| `Heading` | `level=1..6` | |
| `Text` | `tone=` | Text content or `$binding`. |
| `Image` | `src=`, `alt=` | |
| `Icon` | `name=` | |
| `Divider` | | |

### Controls
| Node | Props | Notes |
|---|---|---|
| `Button` | `variant=`, `action=` | `action=name` routes to `onAction`. |
| `Link` | `href=`, `action=` | |
| `Input` | `label=`, `value=`, `placeholder=` | |
| `Select` | `label=`, `options=` | |
| `Checkbox` | `label=`, `checked=` | `checked=$binding`. |
| `Switch` | `label=`, `checked=` | |

### Feedback
| Node | Props | Notes |
|---|---|---|
| `Alert` | `tone=` | success / warning / danger / info. |
| `Badge` | `tone=` | |
| `Spinner` | `size=` | |

### Data display
| Node | Props | Notes |
|---|---|---|
| `Metric` | `label=`, `value=` | Numbers/kpis. |
| `Field` | `label=`, `value=` | Labeled value row. |

### Logic (structural)
| Node | Props | Notes |
|---|---|---|
| `If` | `condition=$binding` | Compiles to `{cond ? (…) : (…)}` with `Else`. |
| `Else` | — | Must follow its `If` at the same indent. |
| `For` | `each=$binding` (alias `in=`) | Compiles to `.map((item, i) => …)`. |
| `State` | `name=`, `initial=` | Declarative state. |

That's **27 semantic nodes** plus the structural set.

## Props & values

| Kind | Example | Meaning |
|---|---|---|
| Bare token | `variant=primary`, `gap=md` | Semantic token — resolved by the design-system registry. |
| Binding | `value=$metrics.active`, `condition=$user.admin` | Data path, resolved against `data`. |
| Quoted string | `label="Active users"` | Literal, may contain spaces and `$bindings` (interpolated). |
| Text content | `Heading level=2 "Overview"` | Trailing quoted string or `$binding` becomes the node's text. |

### Bindings
- `$user.name` — dotted path resolved against the `data` prop.
- `$item` / `$index` — inside `For` loops, the current element / index.
- `$param` — inside a `def` template, the template's parameter.
- `$0`, `$129.00` — **not** bindings (must start with a letter), so prices and
  ordinals stay literal.

### Actions
- `action=save` compiles to `onClick={() => onAction("save")}`. Only named
  actions — no inline JavaScript, ever.

## Declarations

### `import`
```text
import { AreaChart, Tooltip } from "recharts"
import Default from "some-pkg"
import Default, { A } from "pkg"
import "side-effect-pkg"
```
Imports pass through to the generated React unchanged. They are the only
way third-party libraries enter a screen — never model-invented.

### `def`
```text
def StatCard label value tone=default
  Card
    Text $label
    Metric value=$value tone=$tone
```
- Bare identifiers after the name are **required params**.
- `key=value` entries are params **with defaults**.
- `$param` references inside the body bind to the params in scope.
- Usage: `StatCard label="Active users" value=$metrics.active` — props pass
  through, defaults apply when omitted.
- Defs may appear anywhere at the top level of the document.

## What the language forbids

- Arbitrary JavaScript or expressions (`onClick={() => doEvil()}`) — actions
  are named references only.
- Raw `style` / `className` / CSS.
- Model-invented imports (only explicit `import` lines).
- `eval`, template-literal trickery, inline conditionals in source.

These constraints are what make `.aui` safe by construction and cheap to
generate. Escape hatches are planned **after** the core stabilizes, not before.
