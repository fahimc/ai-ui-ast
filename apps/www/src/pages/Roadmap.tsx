import { Section } from '../components/Section';

const ROADMAP: { phase: string; title: string; items: string[] }[] = [
  {
    phase: 'Phase 1',
    title: 'Core parsing & validation',
    items: [
      'Indentation-sensitive lexer and parser',
      'Canonical AST TypeScript interfaces',
      'Structural validation (children, actions, nesting)',
      'Design-token validation against a theme schema',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Component registry',
    items: [
      'Generic registry mapping .aui nodes to implementations',
      'Adapter layer for Radix UI, Material UI, shadcn/ui',
      'AST stays agnostic; adapters inject imports + prop maps',
      'Consistent contract for nodes, props, and actions',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'React compiler',
    items: [
      'AST visitor → human-readable React + TypeScript',
      'Registry-driven imports and prop mapping',
      'Prettier-default output formatting',
      'Deterministic, syntactically valid output',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'AI integration & benchmarking',
    items: [
      'Benchmark suite: dashboard, settings, feed',
      'Token-usage comparison: Claude/GPT, TSX vs AUI',
      'Error-recovery loops for self-correction',
      'Visual-fidelity metrics from rendered snapshots',
    ],
  },
];

const ACCEPTANCE = [
  'Parser accepts valid v0 grammar and produces deterministic ASTs',
  'Errors are clear, repairable diagnostics suitable for an LLM',
  'Registry maps core components to at least one robust library (e.g. Radix UI)',
  'Compiler emits accessible, type-safe TSX matching hand-written equivalents',
  'Benchmarks show materially fewer output tokens than TSX',
];

const DONE = [
  'v0 parser: imports, defs, If/Else, bindings, text content — all tested',
  'Live playground with preview / AST / React tabs and line-numbered diagnostics',
  'React compiler: named actions, bindings, def templates, third-party imports',
  'Example gallery with real GPT-4 tokenizer measurements',
];

export function Roadmap() {
  return (
    <>
      <Section
        id="roadmap"
        eyebrow="Roadmap"
        title="Build plan"
        lead="The implementation is a TypeScript monorepo: parser, AST, validators, React compiler, CLI, registry adapters, and this playground evolve independently."
      >
        <div className="roadmap-grid">
          {ROADMAP.map((phase) => (
            <div key={phase.phase} className="roadmap-card">
              <span className="phase-tag">{phase.phase}</span>
              <h3>{phase.title}</h3>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="acceptance">
          <h3>v0 acceptance criteria</h3>
          <ul>
            {ACCEPTANCE.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="status" eyebrow="Status" title="Already shipped">
        <div className="done-grid">
          {DONE.map((item) => (
            <div key={item} className="done-card">
              <span className="done-check" aria-hidden="true">✓</span>
              {item}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
