# AI UI AST

Working project area for an **LLM-first UI language that expresses the UI AST directly**, then compiles deterministically to React.

The core idea is deliberately *not* to replace React. React remains the mature runtime/target. The new language removes framework boilerplate, dependency decisions, arbitrary CSS, and most syntax from the representation an AI has to generate.

## Thesis

Instead of asking an LLM to produce this:

```tsx
<Card className="w-full max-w-md">
  <CardContent className="flex flex-col gap-4 p-6">
    <h2 className="text-xl font-semibold">Welcome back</h2>
    <p className="text-sm text-muted-foreground">
      Continue where you left off.
    </p>
    <Button variant="primary" onClick={continueFlow}>Continue</Button>
  </CardContent>
</Card>
```

it should be able to emit something closer to the UI tree itself:

```aui
Card max=md pad=lg
  Stack gap=md
    Heading level=2 "Welcome back"
    Text tone=muted "Continue where you left off."
    Button variant=primary action=continue "Continue"
```

The compiler owns imports, React syntax, token resolution, component lookup, accessibility defaults, responsive behaviour, and output formatting.

## Design goals

1. **LLM-first syntax** — small output surface, low token count, predictable grammar.
2. **AST-shaped** — the source maps almost 1:1 to the internal tree; parsing should be trivial and deterministic.
3. **Design-system native** — components and tokens come from a registry rather than model-invented imports/CSS.
4. **Safe by construction** — no arbitrary JavaScript, CSS, package imports, or executable expressions in the core language.
5. **Strong validation** — invalid components, props, token values, data bindings, actions, and nesting fail before React generation.
6. **Accessible defaults** — semantic nodes and component contracts carry accessibility behaviour.
7. **Framework-separated** — React is the first compiler backend, not part of the language grammar.
8. **Escape hatches later** — start constrained; add extension mechanisms only after the core model is stable.
9. **Round-trip friendly** — source -> AST -> canonical source should be deterministic.
10. **Measurably better for AI** — benchmark validity, token use, repair iterations, component reuse, and visual fidelity against TSX.

## Proposed pipeline

```text
Prompt / Figma / agent
        |
        v
      .aui
        |
        v
  lexer + indent parser
        |
        v
   canonical UI AST
        |
        +--> schema/type validation
        +--> design-token validation
        +--> component-registry resolution
        +--> accessibility rules
        +--> data/action validation
        |
        v
  target-neutral IR
        |
        +-------------------+
        |                   |
        v                   v
 React compiler        future targets
        |             HTML / RN / SwiftUI
        v
 React + TypeScript
```

## v0 scope

The first version should prove only five things:

- an LLM can generate the language more reliably and with fewer tokens than TSX;
- the language can represent useful application screens, not just static cards;
- a registry can map semantic UI nodes to real React design-system components;
- invalid UI can be rejected with repairable diagnostics before code generation;
- generated React can be tested and rendered exactly like hand-written React.

Do **not** attempt to build a universal frontend language in v0.

## Initial language surface

The core should begin with:

- **structure:** `Page`, `Stack`, `Row`, `Grid`, `Card`, `Section`, `Spacer`
- **content:** `Heading`, `Text`, `Image`, `Icon`, `Divider`
- **controls:** `Button`, `Link`, `Input`, `Select`, `Checkbox`, `Switch`
- **feedback:** `Alert`, `Badge`, `Spinner`
- **state/data:** `$binding`, `State`, `If`, `For`
- **actions:** named `action=` references only
- **tokens:** semantic values such as `gap=md`, `tone=muted`, `variant=primary`

No arbitrary `style`, `className`, `import`, `eval`, inline JavaScript, or raw CSS in the core language.

## Example

```aui
Page CustomerDetail data=$customer
  Header
    Row gap=md align=center
      Avatar src=$customer.avatar label=$customer.name
      Stack gap=xs
        Heading level=1 $customer.name
        Badge tone=success $customer.status

  Grid min=280 gap=lg
    Card pad=lg
      Heading level=2 "Account"
      Field label="Email" value=$customer.email
      Field label="Plan" value=$customer.plan

    Card pad=lg
      Heading level=2 "Usage"
      Metric label="Projects" value=$customer.projects
      Metric label="Storage" value=$customer.storage

  Row justify=end gap=sm
    Button variant=secondary action=cancel "Cancel"
    Button variant=primary action=save "Save"
```

## Website

[`apps/www`](./apps/www) is the project's public site: an explainer with the full
language reference, examples, roadmap — and an interactive **playground** that
parses `.aui` live and shows a rendered preview, the canonical AST, the generated
React/TSX, and registry diagnostics as you type.

```bash
npm install        # installs workspaces and builds @ai-ui-ast/parser
npm run dev -w www # open the site in the browser
```

## Repository direction

This folder starts as specification and planning only. The intended implementation is a TypeScript monorepo so the parser, AST, validators, React compiler, CLI, registry adapters, and browser playground can evolve independently.

See:

- [`BUILD_PLAN.md`](./BUILD_PLAN.md) — phased implementation and acceptance criteria.
- [`LANGUAGE_SPEC_V0.md`](./LANGUAGE_SPEC_V0.md) — proposed v0 grammar and AST contract.

## Success definition

The project is successful when the same UI task can be given to an LLM and the `.aui` route consistently requires materially fewer output tokens and fewer repair attempts than React/TSX, while producing design-system-compliant, accessible React that passes the same automated tests.
