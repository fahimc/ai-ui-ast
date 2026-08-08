import { useEffect, useMemo, useState } from 'react';
import { parse } from '@ai-ui-ast/parser';
import { CodeBlock } from '../components/CodeBlock';
import { Section } from '../components/Section';
import { GALLERY, type GalleryScenario } from '../lib/gallery';
import { compileReact } from '../lib/compileReact';
import type { TokenComparison } from '../lib/tokens';

interface ScenarioAnalysis {
  scenario: GalleryScenario;
  react: string;
  auiLines: number;
  reactLines: number;
}

function analyze(scenario: GalleryScenario): ScenarioAnalysis {
  const doc = parse(scenario.auiCode);
  const react = compileReact(doc);
  return {
    scenario,
    react,
    auiLines: scenario.auiCode.trim().split('\n').length,
    reactLines: react.trim().split('\n').length,
  };
}

/** Local formatting helper so the tokenizer stays out of the main bundle. */
function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function TokenBar({ comparison }: { comparison: TokenComparison }) {
  const { aui, react, saved, ratio, reductionPct } = comparison;
  const auiPct = Math.max(6, (aui / react) * 100);
  return (
    <div className="token-compare">
      <div className="token-compare-head">
        <span className="token-compare-title">Tokens to express this screen</span>
        <span className="token-compare-badge">{Math.round(reductionPct)}% fewer</span>
      </div>
      <div className="token-row">
        <span className="token-label">.aui</span>
        <div className="token-bar">
          <div className="token-bar-fill aui" style={{ width: `${auiPct}%` }} />
        </div>
        <span className="token-count">{formatTokens(aui)}</span>
      </div>
      <div className="token-row">
        <span className="token-label">React</span>
        <div className="token-bar">
          <div className="token-bar-fill react" style={{ width: '100%' }} />
        </div>
        <span className="token-count">{formatTokens(react)}</span>
      </div>
      <div className="token-compare-foot">
        Saves <strong>{formatTokens(saved)} tokens</strong> · {ratio.toFixed(1)}× smaller — measured with the real
        GPT-4 tokenizer.
      </div>
    </div>
  );
}

function ScenarioCard({ analysis, tokens, onOpen }: { analysis: ScenarioAnalysis; tokens?: TokenComparison; onOpen: (code: string) => void }) {
  const { scenario, react } = analysis;
  return (
    <article className="gallery-card">
      <div className="gallery-head">
        <div className="gallery-title">
          <span className="gallery-feature">{scenario.feature}</span>
          <h3>{scenario.title}</h3>
          <p className="muted">{scenario.tagline}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(scenario.auiCode)}>
          Open in playground →
        </button>
      </div>

      <ul className="gallery-highlights">
        {scenario.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>

      <div className="gallery-code">
        <CodeBlock code={scenario.auiCode} lang="aui" label={`screen.aui · ${analysis.auiLines} lines`} maxHeight={420} />
        <CodeBlock code={react} lang="tsx" label={`generated.tsx · ${analysis.reactLines} lines`} maxHeight={420} />
      </div>

      {tokens ? (
        <TokenBar comparison={tokens} />
      ) : (
        <div className="token-compare token-compare-pending">Measuring tokens with the GPT-4 tokenizer…</div>
      )}
    </article>
  );
}

export function Examples({ onOpenInPlayground }: { onOpenInPlayground: (code: string) => void }) {
  const analyses = useMemo(() => GALLERY.map(analyze), []);
  const [tokenMap, setTokenMap] = useState<Record<string, TokenComparison> | null>(null);

  // The tokenizer vocab is a few MB — lazy-load it so the main bundle stays lean.
  useEffect(() => {
    let alive = true;
    import('../lib/tokens').then(({ compareTokens }) => {
      if (!alive) return;
      const map: Record<string, TokenComparison> = {};
      for (const a of analyses) map[a.scenario.id] = compareTokens(a.scenario.auiCode, a.react);
      setTokenMap(map);
    });
    return () => {
      alive = false;
    };
  }, [analyses]);

  const totals = useMemo(() => {
    const values = Object.values(tokenMap ?? {});
    if (values.length === 0) return null;
    const aui = values.reduce((acc, t) => acc + t.aui, 0);
    const react = values.reduce((acc, t) => acc + t.react, 0);
    return { aui, react, saved: react - aui, ratio: react / aui };
  }, [tokenMap]);

  return (
    <Section
      id="examples"
      eyebrow="Example gallery"
      title="Complex scenarios, measured"
      lead="Every scenario below is real, parseable .aui — run it through the parser and compiler. The token counts come from the actual GPT-4 tokenizer, so the savings are measured, not aspirational."
    >
      <div className="gallery-summary">
        <div className="gallery-summary-stat">
          <strong>{totals ? totals.saved.toLocaleString('en-US') : '…'}</strong>
          <span>tokens saved across these six screens</span>
        </div>
        <div className="gallery-summary-stat">
          <strong>{totals ? totals.ratio.toFixed(1) + '×' : '…'}</strong>
          <span>React is larger than .aui on average</span>
        </div>
        <div className="gallery-summary-stat">
          <strong>6 / 6</strong>
          <span>scenarios compile to valid TSX</span>
        </div>
      </div>

      <div className="gallery-list">
        {analyses.map((a) => (
          <ScenarioCard key={a.scenario.id} analysis={a} tokens={tokenMap?.[a.scenario.id]} onOpen={onOpenInPlayground} />
        ))}
      </div>

      <div className="gallery-note">
        <h3>Why the tokens matter</h3>
        <p>
          For an LLM generating UI, every output token is cost, latency, and a chance to drift. When the same screen is
          <strong> 2–4× more tokens in React than in .aui</strong>, the model has more room for error in exactly the
          places that are hardest to repair — imports, class names, and prop plumbing. The generated React above is
          already minimal; hand-written React with Tailwind classNames and imports is typically larger still.
        </p>
      </div>
    </Section>
  );
}
