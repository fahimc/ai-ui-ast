# The React Compiler

`compileReact(doc)` in `packages/parser/src/react.ts` turns a parsed
`Document` into a complete, readable React + TSX component. It is a **pure
function**: the same `.aui` always produces the same output.

## Output contract

Every compiled component has this shape:

```tsx
import { Button, Heading, Metric, Page, Stack } from '@/components/ui'
import { AreaChart } from "recharts"              // only if the .aui imports it

function StatCard({ label, value, tone = "default" }: any) {   // only if .aui has defs
  return (
    <Card>
      <Text>{label}</Text>
      <Metric value={value} tone={tone} />
    </Card>
  )
}

export function Dashboard({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page><Stack gap="md">…</Stack></Page>
  )
}
```

- **Component name** — from the `Page` label (`Page Dashboard` → `Dashboard`),
  else the `Page title=` prop, else `View`. Overridable with
  `opts.componentName`. Non-alphanumerics are stripped and PascalCased.
- **`@/components/ui`** — the design-system adapter alias. The compiler never
  invents imports: every core node maps to a semantic name; third-party
  libraries come only from explicit `import` lines.

## Node → JSX rules

| `.aui` | Generated |
|---|---|
| `Stack gap=md` | `<Stack gap="md">` |
| `Metric label="Active users" value=$metrics.active` | `<Metric label="Active users" value={data.metrics.active} />` |
| `Button variant=primary action=save "Save"` | `<Button variant="primary" onClick={() => onAction("save")}>Save</Button>` |
| `If condition=$user.admin … Else …` | `{data.user.admin ? (…) : (…)}` |
| `If condition=$user.admin …` | `{data.user.admin && (…)}` |
| `For each=$users …` | `{data.users.map((item, i) => (…))}` |
| `Text "Welcome back, $user.name"` | `<Text>Welcome back, {data.user.name}</Text>` |

### Binding resolution
- `$user.name` → `data.user.name` (rooted at the `data` prop).
- Inside `def` bodies: `$label` → `label` (local param, no `data.` prefix).
- Inside `For`: `$item` → `item`, `$index` → `i`.
- Inside quoted text, bindings become JSX expressions; literal text stays
  literal. Text containing `{`/`}` is escaped as `{"…"}`.

### Props
- `action=` → `onClick={() => onAction("name")}`.
- `condition=` → `condition={…}` (used by adapters); the `If` itself consumes
  it for the ternary.
- `each=` / `in=` → `items={…}` (and consumed by `For` for the `.map()`).
- `checked=` → `checked={…}`.
- `$` values → `{…}` expressions; everything else → `"…"` (escaped).

### Formatting
- Text-only children render on one line: `<Heading level="1">Overview</Heading>`.
- Nested children indent with two spaces.
- Imports are sorted and deduplicated; `If`/`Else`/`For` never appear in the
  core import list (they're language constructs, not components).

## `def` templates

`def StatCard label value tone=default` compiles to:

```tsx
function StatCard({ label, value, tone = "default" }: any) {
  return (
    <Card>
      <Text>{label}</Text>
      <Metric value={value} tone={tone} />
    </Card>
  )
}
```

Usage sites become `<StatCard … />` with passthrough props. The param scope is
computed once per def: required params plus defaulted-prop keys.

## Why the compiler is the product

The compiler absorbs every decision an LLM would otherwise make and get wrong:
imports, JSX syntax, key props, ternary shape, string escaping, prop casing,
output formatting. That is the entire point of the language — the `.aui`
source stays small and predictable, and the heavy lifting is deterministic
code, not model luck.
