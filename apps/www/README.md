# AI UI AST — Website

The public site for **AI UI AST**, an LLM-first UI language that expresses the
UI AST directly and compiles deterministically to React. Live at
<https://ai-ui-ast.netlify.app>.

Built with React + Vite + TypeScript. Hash-routed multi-page site (no server
config, works on any static host):

- **Home** — hero, thesis, the pipeline, and design goals.
- **Language** — the full grammar: every node, prop, and token, plus the
  language rules (`import`, `def`, `If/Else`, `For`, bindings).
- **Examples** — the gallery: six complex scenarios (third-party imports,
  reusable components, UI logic, business-logic wiring, live-data dashboard,
  full composition), each with `.aui` vs generated React side-by-side,
  three-row token-savings bars measured with the real GPT-4 tokenizer, and a
  "How we measure tokens" methodology section. Every scenario opens in the
  playground.
- **Playground** — write `.aui` on the left and get three live outputs:
  - **Preview** — the UI rendered from the AST through a mini design-system
    registry (bindings resolve against built-in mock data).
  - **AST** — the canonical UI AST as JSON.
  - **React** — deterministic React + TSX generated from the AST.
  - Line-numbered diagnostics against the component registry as you type.
- **Roadmap** — build phases and what's already shipped.

## Development

```bash
npm install        # from the repo root (installs workspaces + builds @codedia/parser)
npm run dev -w www # or: cd apps/www && npm run dev
```

- `npm run build -w www` — typecheck + production build
- `npm run lint -w www` — oxlint
- `npm run test -w www` — render regression tests (no `[object Object]` /
  unresolved bindings in any sample or gallery scenario)
- `npm run validate:tokens -w www` — re-measure the Examples-page token claim:
  parse + compile every scenario, count `.aui` vs generated vs hand-written
  React with the real GPT-4 tokenizer, print the table, and rewrite
  `token-report.json`. Add `-- --check` to verify the committed report is
  still current instead of rewriting it. The hand-written React corpus lives
  in `src/lib/handwritten.ts` and the script in `scripts/validate-tokens.ts`.

## Layout

```
src/
  App.tsx                hash router + nav (desktop links, mobile hamburger)
  pages/
    Home.tsx             hero, thesis, pipeline, goals
    Language.tsx         grammar and node reference
    Examples.tsx         scenario gallery + token bars + methodology
    PlaygroundPage.tsx   the playground page
    Roadmap.tsx          build phases
  components/
    CodeBlock.tsx        syntax-highlighted code with a copy button
    Playground.tsx       editor + tabs + diagnostics
    Section.tsx          shared page section
  lib/
    registry.ts          node/prop/token metadata (drives docs + validation)
    samples.ts           the .aui example snippets
    validate.ts          line-numbered diagnostics against the registry
    preview.tsx          AST -> live rendered preview (mini design system + mock data)
    resolve.ts           binding resolution + safe stringification (shared with tests)
    mockData.ts          the mock data the preview resolves against
    gallery.ts           the six gallery scenarios
    handwritten.ts       hand-written React corpus for token comparison
    highlight.ts         tiny regex highlighter for aui/tsx/json
    render.test.ts       regression tests over every sample + gallery scenario
```

The parser — lexer, parser, AST, text resolution, **and the React compiler
(`compileReact`)** — lives in `packages/parser` and is consumed from its built
`dist` (ESM). It builds automatically on `npm install` via the `prepare`
script. The compiler no longer lives here; it ships in `@codedia/parser` so
the published module is the full generator.
