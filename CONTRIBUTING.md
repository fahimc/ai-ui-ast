# Contributing

Thanks for contributing to AI UI AST! This project is small on purpose — a
tight language, a deterministic compiler, and honest measurements. Please keep
changes consistent with that.

## Setup

```bash
git clone https://github.com/fahimc/ai-ui-ast.git
cd ai-ui-ast
npm install        # installs workspaces and builds @codedia/parser
```

## What to work on

See [`BUILD_PLAN.md`](BUILD_PLAN.md) for the roadmap and
[`docs/architecture.md`](docs/architecture.md) for the layout. Good first
areas:

- Parser edge cases and diagnostics (`packages/parser/src`)
- New gallery scenarios and hand-written corpus entries (`apps/www/src/lib`)
- Docs and examples

## Checks that must pass

```bash
npm test -w @codedia/parser          # 19 unit tests
npm test -w www                        # rendering regression tests
npm run validate:tokens -w www -- --check   # token report still current
npm run build -w www                   # typecheck + production build
```

Run all of them before opening a PR.

## Design constraints

- **No arbitrary JavaScript/CSS in the language.** If a proposal adds `eval`,
  raw `style`, or model-invented imports to the core grammar, it goes in the
  "escape hatches later" bucket, not v0.
- **Deterministic output.** `compileReact` must return identical output for
  identical input. Anything non-deterministic is a regression.
- **Measured, not claimed.** Token claims must come from
  `npm run validate:tokens` (real GPT-4 tokenizer), not estimates.
- **Tests guard the demo.** The rendering regression test parses every sample
  and gallery scenario — new scenarios must be added there too.

## Commits

Small, focused commits. Conventional prefixes (`feat:`, `fix:`, `docs:`,
`test:`) are welcome but not required.

## License

By contributing you agree that your contributions are licensed under the
project's [MIT license](LICENSE).
