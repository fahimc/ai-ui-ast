# The React Compiler (v0.2)

`compileReact(doc)` in `packages/parser/src/react.ts` turns the **canonical
IR** into a complete, readable React + TSX component. It is a **pure
function**: the same input always produces the same output. The high-level
`compile(source, { target: 'react' })` entry point runs the full pipeline and
refuses to emit code in strict mode when validation fails.

## Output contract

```tsx
import { Button, Card, Heading, Metric, Page, Stack } from "@/components/ui"
import { Area, AreaChart } from "@company/charts"     // registry-derived

function StatCard({ label, value, tone = "default" }: any) {   // from def
  return (
    <Card>
      <Text>{label}</Text>
      <Metric value={value} tone={tone} />
    </Card>
  )
}

export function Dashboard({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack gap="md">…</Stack>
    </Page>
  )
}
```

- **Component name** — from the `Page` label (`Page Dashboard` → `Dashboard`),
  else the `Page title=` prop, else `View`. Overridable with
  `opts.componentName`. Non-alphanumerics are stripped and PascalCased.
- **Imports are registry-derived.** Every used node resolves through the
  registry: core nodes import from `@/components/ui`, registered third-party
  nodes from their mapped `source`/`export`. Imports are sorted and
  deduplicated; models never write import lines in strict mode.
- **`onAction` signature** — `(name: string) => void`, extended to
  `(name: string, payload?: unknown) => void` when the screen uses semantic
  events.

## The compiler consumes canonical IR only

The compiler never sees raw string props. `normalize()` classifies values
against the registry, so the compiler just emits:

| Canonical value | Emission |
|---|---|
| `{ kind: 'token' }` / `{ kind: 'string' }` | `"…"` (escaped) |
| `{ kind: 'binding' }` | `{data.path}` / `{item.path}` / `{param}` / `{data.path}` for `$root` |
| `{ kind: 'number' }` | `{280}` |
| `{ kind: 'boolean' }` | `{true}` / `{false}` |
| `{ kind: 'list' }` | `{["A", "B"]}` |

## Node → JSX rules

| `.aui` | Generated |
|---|---|
| `Stack gap=md` | `<Stack gap="md">` |
| `Metric label="Active users" value=$metrics.active` | `<Metric label="Active users" value={data.metrics.active} />` |
| `Heading level=2 "Title"` | `<Heading level={2}>Title</Heading>` |
| `Button variant=primary action=save "Save"` | `<Button variant="primary" onClick={() => onAction("save")}>Save</Button>` |
| `Input value=$form.email change=emailChanged` | `<Input value={data.form.email} onChange={(e) => onAction("emailChanged", e.target.value)} />` |
| `If condition=$user.admin … Else …` | `{data.user.admin ? (…) : (…)}` |
| `If condition=$user.admin …` | `{data.user.admin && (…)}` |
| `For each=$users …` | `{data.users.map((item, i) => (<Row key={i}>…</Row>))}` |
| `Text "Welcome back, $user.name"` | `<Text>Welcome back, {data.user.name}</Text>` |

### Expression children are always valid JSX

JSX expression contexts (ternary branches, map bodies, `return` roots) require
a single expression. One shared helper handles all of them:

- **0 children** → `null`
- **1 child** → rendered directly
- **2+ children** → wrapped in a fragment `<>…</>`

This fixes the v0.1 bug where multiple direct children inside a `For`, an
`If`/`Else` branch, a `def` body, or a document root produced adjacent JSX
elements — syntactically invalid. Every compiler fixture in the test suite is
run through a TSX transpile gate.

### Loop keys

`For each=$users` emits a deterministic key strategy:
- a single child element gets `key={i}` on it (`<Row key={i}>`), or
- multiple children are wrapped in `<Fragment key={i}>` (importing `Fragment`
  from `react` only when needed).

### Semantic events

`change=` props are consumed through registry event metadata, never passed
through as HTML props:

```ts
events: { change: { target: 'onChange', payload: 'target.value' } }
```

emits `onChange={(e) => onAction("emailChanged", e.target.value)}`; for
checkbox/switch the registry payload is `target.checked`. No event object
ever appears in `.aui`.

## Binding resolution

- `$user.name` → `data.user.name` (rooted at the `data` prop).
- `$root.user.name` → `data.user.name` (explicit absolute access).
- Inside `def` bodies: `$label` → `label` (local param, no `data.` prefix).
- Inside `For`: `$item` → `item`, `$index` → `i`.
- Inside quoted text, bindings become JSX expressions; literal text stays
  literal. Text containing `{`/`}` is escaped as `{"…"}`.

## Formatting

- Text-only children render on one line: `<Heading level={2}>Overview</Heading>`.
- Nested children indent with two spaces.
- Imports are sorted and deduplicated; `If`/`Else`/`For` never appear in the
  core import list (they are language constructs, not components).

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
computed once per def from the unified `params` model (required + defaulted);
multiple root children in a def body are wrapped in a fragment.

## Why the compiler is the product

The compiler absorbs every decision an LLM would otherwise make and get wrong:
imports, JSX syntax, key props, ternary shape, fragment wrapping, string
escaping, event wiring, prop casing, output formatting. That is the entire
point of the language — the `.aui` source stays small and predictable, and
the heavy lifting is deterministic code, not model luck.
