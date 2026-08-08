# AI UI AST — Website

The public site for **AI UI AST**, an LLM-first UI language that expresses the UI
AST directly and compiles deterministically to React.

Built with React + Vite + TypeScript. It is a single-page site with:

- **Overview** — thesis, why it exists, and the design goals.
- **Language reference** — every v0 node, its props and tokens, plus the grammar rules.
- **Examples** — a few real screens written in a handful of `.aui` lines each.
- **Playground** — write `.aui` on the left and get three live outputs:
  - **Preview** — the UI rendered from the AST through a mini design-system registry
    (bindings resolve against built-in mock data).
  - **AST** — the canonical UI AST as JSON.
  - **React** — deterministic React + TSX generated from the AST.
  - Line-numbered diagnostics against the component registry as you type.

## Development

```bash
npm install        # from the repo root (installs workspaces + builds @ai-ui-ast/parser)
npm run dev -w www # or: cd apps/www && npm run dev
```

- `npm run build -w www` — typecheck + production build
- `npm run lint -w www` — oxlint

## Layout

```
src/
  App.tsx                site sections (hero, thesis, language, examples, playground, roadmap)
  components/
    CodeBlock.tsx        syntax-highlighted code with a copy button
    Playground.tsx       editor + tabs + diagnostics
  lib/
    registry.ts          node/prop/token metadata (drives docs + validation)
    samples.ts           the .aui example snippets
    validate.ts          line-numbered diagnostics against the registry
    compileReact.ts      AST -> React/TSX code generation
    preview.tsx          AST -> live rendered preview (mini design system + mock data)
    highlight.ts         tiny regex highlighter for aui/tsx/json
```

The parser itself lives in `packages/parser` and is consumed from its built
`dist` (ESM). It builds automatically on `npm install` via the `prepare` script.
