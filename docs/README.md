# Documentation

Everything you need to understand, use, and extend AI UI AST.

**What this is:** an LLM-oriented UI DSL with a deterministic compiler. An
LLM writes a tiny, predictable `.aui` tree; the compiler turns it into
readable React. Not a token-compression parser — token savings are a
measured consequence of the design.

## For users

| Doc | What it covers |
|---|---|
| [API reference](api.md) | Every exported function and type in `@codedia/parser`. |
| [Grammar](grammar.md) | The `.aui` language: nodes, props, bindings, actions, `import`, `def`, `If/Else`, `For`. |
| [Compiler](compiler.md) | How `.aui` becomes React + TSX — the compilation rules and output contract. |
| [Token methodology](token-methodology.md) | Exactly how token savings are measured, and how to reproduce the numbers. |

## For contributors

| Doc | What it covers |
|---|---|
| [Architecture](architecture.md) | Monorepo layout, data flow, and the pipeline. |
| [V0.2 implementation plan](V0_2_LLM_IMPLEMENTATION_PLAN.md) | The v0.2 brief this release was built from. |
| [LANGUAGE_SPEC_V0.md](../LANGUAGE_SPEC_V0.md) | The original v0 language spec. |
| [BUILD_PLAN.md](../BUILD_PLAN.md) | Phased plan and acceptance criteria. |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to contribute. |

## Elsewhere

- **Playground** — <https://ai-ui-ast.netlify.app> (also `npm run dev -w www`)
- **npm package** — <https://www.npmjs.com/package/@codedia/parser>
- **Repository** — <https://github.com/fahimc/ai-ui-ast>
- **Agent skill** — [`../skills/write-aui-ui`](../skills/write-aui-ui) — teaches
  coding agents to write `.aui` and use `@codedia/parser`.
