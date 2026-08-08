import { CodeBlock } from '../components/CodeBlock';
import { Section } from '../components/Section';

const TSX_EXAMPLE = `<Card className="w-full max-w-md">
  <CardContent className="flex flex-col gap-4 p-6">
    <h2 className="text-xl font-semibold">Welcome back</h2>
    <p className="text-sm text-muted-foreground">
      Continue where you left off.
    </p>
    <Button variant="primary" onClick={continueFlow}>Continue</Button>
  </CardContent>
</Card>`;

const AUI_EXAMPLE = `Card max=md pad=lg
  Stack gap=md
    Heading level=2 "Welcome back"
    Text tone=muted "Continue where you left off."
    Button variant=primary action=continue "Continue"`;

const PIPELINE_STEPS: { title: string; sub: string }[] = [
  { title: '.aui source', sub: 'Prompt · Figma · agent emits text' },
  { title: 'Lexer + indent parser', sub: 'Trivial and deterministic' },
  { title: 'Canonical UI AST', sub: 'The source is the tree' },
  { title: 'Validation', sub: 'schema · tokens · registry · a11y · actions' },
  { title: 'Target-neutral IR', sub: 'No framework in the language' },
  { title: 'React compiler', sub: '→ React + TypeScript' },
];

const GOALS: { title: string; text: string }[] = [
  { title: 'LLM-first syntax', text: 'Small output surface, low token count, predictable grammar — built for generation, not just authoring.' },
  { title: 'AST-shaped', text: 'Source maps almost 1:1 to the internal tree. Parsing stays trivial and fully deterministic.' },
  { title: 'Design-system native', text: 'Components and tokens come from a registry, never from model-invented imports or CSS.' },
  { title: 'Safe by construction', text: 'No arbitrary JavaScript, CSS, package imports, or executable expressions in the core language.' },
  { title: 'Strong validation', text: 'Invalid components, props, tokens, bindings, actions, and nesting fail before React generation.' },
  { title: 'Accessible defaults', text: 'Semantic nodes and component contracts carry accessibility behaviour by default.' },
  { title: 'Framework-separated', text: 'React is the first compiler backend — it is not part of the language grammar.' },
  { title: 'Escape hatches later', text: 'Start constrained. Extension mechanisms come only after the core model is stable.' },
  { title: 'Round-trip friendly', text: 'Source → AST → canonical source is deterministic, so tooling can rewrite safely.' },
  { title: 'Measurably better for AI', text: 'Benchmarked on validity, tokens, repair iterations, reuse, and visual fidelity vs TSX.' },
];

const V0_SCOPE = [
  'an LLM can generate the language more reliably and with fewer tokens than TSX',
  'the language can represent useful application screens, not just static cards',
  'a registry maps semantic UI nodes to real React design-system components',
  'invalid UI is rejected with repairable diagnostics before code generation',
  'generated React can be tested and rendered exactly like hand-written React',
];

export function Home({ onNavigate }: { onNavigate: (route: 'playground' | 'language' | 'examples') => void }) {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-inner">
          <span className="eyebrow">An LLM-oriented UI DSL</span>
          <h1>
            Write the UI tree.
            <br />
            <span className="grad">A compiler ships the framework.</span>
          </h1>
          <p className="hero-lead">
            AI UI AST is a small DSL that expresses the UI tree directly — and a deterministic compiler that turns it
            into readable React. The model writes the tree; the compiler owns imports, bindings, and formatting. Not a
            token-compression trick: savings are a measured consequence of the design.
          </p>
          <div className="hero-ctas">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => onNavigate('playground')}>
              Try the playground
            </button>
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => onNavigate('language')}>
              Read the spec
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>~2×</strong>
              <span>fewer tokens than React — measured, not claimed</span>
            </div>
            <div className="stat">
              <strong>0</strong>
              <span>imports or className strings</span>
            </div>
            <div className="stat">
              <strong>1:1</strong>
              <span>source-to-AST mapping</span>
            </div>
          </div>
        </div>

        <div className="hero-compare">
          <div className="compare-col">
            <div className="compare-label before">Today — React + Tailwind</div>
            <CodeBlock code={TSX_EXAMPLE} lang="tsx" />
          </div>
          <div className="compare-arrow" aria-hidden="true">
            →
          </div>
          <div className="compare-col">
            <div className="compare-label after">AI UI AST (.aui)</div>
            <CodeBlock code={AUI_EXAMPLE} lang="aui" />
          </div>
        </div>
      </header>

      {/* ── Why ──────────────────────────────────────────────────────────── */}
      <Section id="why" eyebrow="Thesis" title="Why another UI language?">
        <div className="why-grid">
          <div className="why-card">
            <h3>Built for the model, not the author</h3>
            <p>
              Asking an LLM to emit TSX means asking it to juggle imports, class names, prop spreads, and framework
              conventions while staying visually faithful. AUI collapses that surface to the thing that actually
              matters — the tree of UI nodes.
            </p>
          </div>
          <div className="why-card">
            <h3>Safe by construction</h3>
            <p>
              The core language has no CSS, no JavaScript, no imports, and no eval. The compiler owns every decision an
              LLM is bad at: token resolution, component lookup, accessibility defaults, and output formatting.
            </p>
          </div>
          <div className="why-card">
            <h3>Design-system native</h3>
            <p>
              <code>Button variant=primary</code> resolves through a registry to your design system — Radix today, MUI
              or shadcn/ui via adapters. The language never leaks library specifics.
            </p>
          </div>
        </div>
        <div className="v0-scope">
          <h3>What v0 proves</h3>
          <ul>
            {V0_SCOPE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="v0-scope-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('examples')}>
              See the value — token counts
            </button>
          </div>
        </div>
      </Section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Section id="how" eyebrow="Pipeline" title="How it works">
        <div className="pipeline">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.title} className="pipeline-step">
              <div className="pipeline-box">
                <span className="pipeline-title">{step.title}</span>
                <span className="pipeline-sub">{step.sub}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <span className="pipeline-arrow" aria-hidden="true">→</span>}
            </div>
          ))}
        </div>
        <div className="how-note">
          The parser is intentionally dumb. Because the source <em>is</em> the tree, lexing and parsing stay trivial —
          the intelligence lives in validation and the compiler backends.
        </div>
      </Section>

      {/* ── Goals ────────────────────────────────────────────────────────── */}
      <Section id="goals" eyebrow="Principles" title="Design goals">
        <div className="goals-grid">
          {GOALS.map((g, i) => (
            <div key={g.title} className="goal-card">
              <span className="goal-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
