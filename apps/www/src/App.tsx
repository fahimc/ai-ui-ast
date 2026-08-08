import { useState, type ReactNode } from 'react';
import './App.css';
import { CodeBlock } from './components/CodeBlock';
import { Playground } from './components/Playground';
import { NODE_SPECS, CATEGORY_ORDER, GAP_TOKENS, PAD_TOKENS, TONE_TOKENS, VARIANT_TOKENS } from './lib/registry';
import { SAMPLES, DEFAULT_SAMPLE_ID } from './lib/samples';

// ─────────────────────────────────────────────────────────────────────────────
// Static content
// ─────────────────────────────────────────────────────────────────────────────
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

const OUT_OF_SCOPE = ['No arbitrary CSS', 'No style= / className=', 'No package imports', 'No inline JavaScript', 'No eval', 'No framework syntax'];

const ROADMAP: { phase: string; title: string; items: string[] }[] = [
  {
    phase: 'Phase 1',
    title: 'Core parsing & validation',
    items: ['Indentation-sensitive lexer and parser', 'Canonical AST TypeScript interfaces', 'Structural validation (children, actions, nesting)', 'Design-token validation against a theme schema'],
  },
  {
    phase: 'Phase 2',
    title: 'Component registry',
    items: ['Generic registry mapping .aui nodes to implementations', 'Adapter layer for Radix UI, Material UI, shadcn/ui', 'AST stays agnostic; adapters inject imports + prop maps', 'Consistent contract for nodes, props, and actions'],
  },
  {
    phase: 'Phase 3',
    title: 'React compiler',
    items: ['AST visitor → human-readable React + TypeScript', 'Registry-driven imports and prop mapping', 'Prettier-default output formatting', 'Deterministic, syntactically valid output'],
  },
  {
    phase: 'Phase 4',
    title: 'AI integration & benchmarking',
    items: ['Benchmark suite: dashboard, settings, feed', 'Token-usage comparison: Claude/GPT, TSX vs AUI', 'Error-recovery loops for self-correction', 'Visual-fidelity metrics from rendered snapshots'],
  },
];

const ACCEPTANCE = [
  'Parser accepts valid v0 grammar and produces deterministic ASTs',
  'Errors are clear, repairable diagnostics suitable for an LLM',
  'Registry maps core components to at least one robust library (e.g. Radix UI)',
  'Compiler emits accessible, type-safe TSX matching hand-written equivalents',
  'Benchmarks show materially fewer output tokens than TSX',
];

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────
function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="section">
      <div className="section-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {lead && <p className="section-lead">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        {'{ }'}
      </span>
      ai-ui-ast
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);

  const openSample = (id: string) => {
    setSampleId(id);
    document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="site">
      <nav className="nav">
        <a href="#overview" className="nav-brand">
          <Logo />
        </a>
        <div className="nav-links">
          <a href="#why">Why</a>
          <a href="#language">Language</a>
          <a href="#examples">Examples</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <a href="#playground" className="btn btn-primary nav-cta">
          Open playground
        </a>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header id="overview" className="hero">
        <div className="hero-inner">
          <span className="eyebrow">An LLM-first UI language</span>
          <h1>
            Write the UI tree.
            <br />
            <span className="grad">Not the framework.</span>
          </h1>
          <p className="hero-lead">
            AI UI AST is a language that expresses the UI Abstract Syntax Tree directly — then compiles it
            deterministically to React. It removes framework boilerplate, dependency decisions, arbitrary CSS, and most
            syntax from the representation an AI has to generate.
          </p>
          <div className="hero-ctas">
            <a href="#playground" className="btn btn-primary btn-lg">
              Try the playground
            </a>
            <a href="#language" className="btn btn-ghost btn-lg">
              Read the spec
            </a>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>~3×</strong>
              <span>fewer output tokens than TSX</span>
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

      {/* ── Language ─────────────────────────────────────────────────────── */}
      <Section
        id="language"
        eyebrow="Language spec v0"
        title="The language"
        lead={'Nodes are indentation-nested declarations: Component prop=value "Text content". No brackets, no XML tags, no JS.'}
      >
        <div className="grammar-row">
          <CodeBlock
            code={`Page CustomerDetail data=$customer
  Header
    Row gap=md align=center
      Avatar src=$customer.avatar label=$customer.name
      Stack gap=xs
        Heading level=1 $customer.name
        Badge tone=success $customer.status`}
            lang="aui"
            label="grammar.aui"
          />
          <div className="grammar-rules">
            <h3>Grammar rules</h3>
            <ul>
              <li><code>Component</code> starts each node; props follow as <code>key=value</code>.</li>
              <li>Nesting uses a consistent 2-space indent — children are indented relative to their parent.</li>
              <li>Trailing <code>"quoted text"</code> becomes the node's text content.</li>
              <li><code>$bindings</code> reference app state; never inline expressions.</li>
              <li>Actions are named references (<code>action=save</code>), resolved by the compiler.</li>
            </ul>
          </div>
        </div>

        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="node-group">
            <h3 className="node-group-title">{cat}</h3>
            <div className="node-table-wrap">
              <table className="node-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Purpose</th>
                    <th>Props</th>
                  </tr>
                </thead>
                <tbody>
                  {NODE_SPECS.filter((n) => n.category === cat).map((n) => (
                    <tr key={n.name}>
                      <td>
                        <code className="node-name">{n.name}</code>
                      </td>
                      <td>{n.description}</td>
                      <td>
                        {n.props.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <div className="prop-chips">
                            {n.props.map((p) => (
                              <span key={p.name} className="prop-chip" title={p.description}>
                                <code>{p.name}</code>
                                {p.tokens && <em className="prop-tokens">({p.tokens.join(' | ')})</em>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="tokens-row">
          <div className="token-group">
            <h3>Spacing tokens</h3>
            <p>
              <code>gap</code> and <code>pad</code> accept a fixed scale.
            </p>
            <div className="chip-list">
              {[...new Set([...GAP_TOKENS, ...PAD_TOKENS])].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <div className="token-group">
            <h3>Tone tokens</h3>
            <p>
              <code>tone</code> on Text, Badge, and Alert.
            </p>
            <div className="chip-list">
              {TONE_TOKENS.map((t) => (
                <span key={t} className="chip chip-tone">{t}</span>
              ))}
            </div>
          </div>
          <div className="token-group">
            <h3>Button variants</h3>
            <p>
              <code>variant</code> on Button.
            </p>
            <div className="chip-list">
              {VARIANT_TOKENS.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="out-of-scope">
          <h3>Deliberately absent in v0</h3>
          <div className="chip-list">
            {OUT_OF_SCOPE.map((t) => (
              <span key={t} className="chip chip-out">{t}</span>
            ))}
          </div>
          <p className="muted">
            Escape hatches are a post-v0 concern. The constraint is the point: it is what makes output predictable
            enough for an LLM to hit first try.
          </p>
        </div>
      </Section>

      {/* ── Examples ─────────────────────────────────────────────────────── */}
      <Section
        id="examples"
        eyebrow="In practice"
        title="Examples"
        lead="A few real screens expressed in a few lines each. Open any of them in the playground below."
      >
        <div className="examples-grid">
          {SAMPLES.slice(1, 4).map((s) => (
            <div key={s.id} className="example-card">
              <div className="example-head">
                <div>
                  <h3>{s.label}</h3>
                  <p className="muted">{s.description}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSample(s.id)}>
                  Open →
                </button>
              </div>
              <CodeBlock code={s.code} lang="aui" maxHeight={280} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Playground ───────────────────────────────────────────────────── */}
      <Section
        id="playground"
        eyebrow="Playground"
        title="Try it"
        lead="Type .aui on the left. Watch the live preview, the canonical AST, and the generated React update instantly."
      >
        <Playground sampleId={sampleId} onSampleChange={setSampleId} />
      </Section>

      {/* ── Roadmap ──────────────────────────────────────────────────────── */}
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

      <footer className="footer">
        <div className="footer-inner">
          <Logo />
          <p className="muted">
            An LLM-first UI language that expresses the UI AST directly and compiles deterministically to React.
          </p>
          <div className="footer-links">
            <a href="https://github.com/fahimc/playground-" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              href="https://github.com/fahimc/playground-/tree/main/ai-ui-ast/LANGUAGE_SPEC_V0.md"
              target="_blank"
              rel="noreferrer"
            >
              Spec v0
            </a>
            <a
              href="https://github.com/fahimc/playground-/tree/main/ai-ui-ast/BUILD_PLAN.md"
              target="_blank"
              rel="noreferrer"
            >
              Build plan
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
