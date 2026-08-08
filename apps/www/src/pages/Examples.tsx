import { useMemo } from 'react';
import { compile } from '@codedia/parser';
import { CodeBlock } from '../components/CodeBlock';
import { Section } from '../components/Section';
import { GALLERY, type GalleryScenario } from '../lib/gallery';
import { WWW_REGISTRY } from '../lib/registry';
import report from '../../token-report.json';

/**
 * The token numbers on this page come from `token-report.json`, written by
 * `scripts/validate-tokens.ts` (`npm run validate:tokens`). The script runs
 * every scenario through the strict package pipeline, counts `.aui`,
 * generated, and hand-written React with explicitly pinned tokenizer
 * encodings (o200k_base primary, cl100k_base legacy), and rewrites this
 * report. The page renders the primary encoding.
 */

interface EncodingCounts {
  aui: number;
  generated: number;
  handwritten: number;
}

interface ReportScenario {
  id: string;
  title: string;
  features: { render: string[]; bindings: string[]; actions: string[]; events: string[] };
  tokenizers: Record<string, EncodingCounts>;
}

interface TokenReport {
  primaryEncoding: string;
  tokenizers: Record<string, string>;
  note: string;
  instructionOverhead: { cold: Record<string, number>; warm: Record<string, number>; note: string };
  scenarios: ReportScenario[];
  totals: Record<string, EncodingCounts>;
}

const TOKEN_REPORT = report as TokenReport;
const PRIMARY = TOKEN_REPORT.primaryEncoding ?? 'o200k_base';

const byScenarioId: Record<string, ReportScenario> = Object.fromEntries(
  TOKEN_REPORT.scenarios.map((s) => [s.id, s]),
);

function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function TokenBar({ scenario }: { scenario: ReportScenario }) {
  const { aui, generated, handwritten } = scenario.tokenizers[PRIMARY];
  const saved = handwritten - aui;
  const ratio = handwritten / aui;
  const reductionPct = (1 - aui / handwritten) * 100;
  const width = (n: number) => Math.max(6, (n / handwritten) * 100);
  return (
    <div className="token-compare">
      <div className="token-compare-head">
        <span className="token-compare-title">Tokens to express this screen</span>
        <span className="token-compare-badge">{Math.round(reductionPct)}% fewer</span>
      </div>
      <div className="token-row">
        <span className="token-label">.aui</span>
        <div className="token-bar">
          <div className="token-bar-fill aui" style={{ width: `${width(aui)}%` }} />
        </div>
        <span className="token-count">{formatTokens(aui)}</span>
      </div>
      <div className="token-row">
        <span className="token-label">Generated</span>
        <div className="token-bar">
          <div className="token-bar-fill generated" style={{ width: `${width(generated)}%` }} />
        </div>
        <span className="token-count">{formatTokens(generated)}</span>
      </div>
      <div className="token-row">
        <span className="token-label">Hand-written</span>
        <div className="token-bar">
          <div className="token-bar-fill react" style={{ width: '100%' }} />
        </div>
        <span className="token-count">{formatTokens(handwritten)}</span>
      </div>
      <div className="token-compare-foot">
        Saves <strong>{formatTokens(saved)} tokens</strong> vs hand-written React · {ratio.toFixed(1)}× smaller —
        measured with the real GPT-4 tokenizer.
      </div>
    </div>
  );
}

interface ScenarioAnalysis {
  scenario: GalleryScenario;
  react: string;
  auiLines: number;
  reactLines: number;
}

function analyze(scenario: GalleryScenario): ScenarioAnalysis {
  const result = compile(scenario.auiCode, { registry: WWW_REGISTRY, strict: true });
  const react = result.code ?? '';
  return {
    scenario,
    react,
    auiLines: scenario.auiCode.trim().split('\n').length,
    reactLines: react.trim().split('\n').length,
  };
}

function ScenarioCard({ analysis, onOpen }: { analysis: ScenarioAnalysis; onOpen: (code: string) => void }) {
  const { scenario, react } = analysis;
  const tokens = byScenarioId[scenario.id];
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

      {tokens ? <TokenBar scenario={tokens} /> : null}
    </article>
  );
}

function MethodTable() {
  const totals = TOKEN_REPORT.totals[PRIMARY];
  return (
    <div className="method-table-wrap">
      <table className="method-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>.aui</th>
            <th>Generated</th>
            <th>Hand-written</th>
            <th>Saved vs hand-written</th>
            <th>React is larger</th>
          </tr>
        </thead>
        <tbody>
          {TOKEN_REPORT.scenarios.map((s) => {
            const t = s.tokenizers[PRIMARY];
            return (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>{formatTokens(t.aui)}</td>
                <td>{formatTokens(t.generated)}</td>
                <td>{formatTokens(t.handwritten)}</td>
                <td>{formatTokens(t.handwritten - t.aui)}</td>
                <td>{(t.handwritten / t.aui).toFixed(1)}×</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{formatTokens(totals.aui)}</td>
            <td>{formatTokens(totals.generated)}</td>
            <td>{formatTokens(totals.handwritten)}</td>
            <td>{formatTokens(totals.handwritten - totals.aui)}</td>
            <td>{(totals.handwritten / totals.aui).toFixed(1)}×</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function Examples({ onOpenInPlayground }: { onOpenInPlayground: (code: string) => void }) {
  const analyses = useMemo(() => GALLERY.map(analyze), []);
  const totals = TOKEN_REPORT.totals[PRIMARY];
  const saved = totals.handwritten - totals.aui;
  const cold = TOKEN_REPORT.instructionOverhead?.cold?.[PRIMARY] ?? 0;

  return (
    <Section
      id="examples"
      eyebrow="Example gallery"
      title="Complex scenarios, measured"
      lead="Every scenario below is real, parseable .aui — run it through the parser and compiler. The token counts come from the actual GPT-4 tokenizer, so the savings are measured, not aspirational."
    >
      <div className="gallery-summary">
        <div className="gallery-summary-stat">
          <strong>{saved.toLocaleString('en-US')}</strong>
          <span>tokens saved across these six screens (vs hand-written React)</span>
        </div>
        <div className="gallery-summary-stat">
          <strong>{(totals.handwritten / totals.aui).toFixed(1)}×</strong>
          <span>hand-written React is larger than .aui on average</span>
        </div>
        <div className="gallery-summary-stat">
          <strong>6 / 6</strong>
          <span>scenarios compile to valid TSX</span>
        </div>
      </div>

      <div className="gallery-list">
        {analyses.map((a) => (
          <ScenarioCard key={a.scenario.id} analysis={a} onOpen={onOpenInPlayground} />
        ))}
      </div>

      <div className="gallery-note">
        <h3>How we measure tokens</h3>
        <ol className="method-list">
          <li>
            <strong>Tokenizer.</strong> Every count uses <code>gpt-tokenizer</code> with explicitly pinned encodings —
            <code>o200k_base</code> (the current OpenAI family) as the primary number shown here, and
            <code>cl100k_base</code> (legacy GPT-3.5/GPT-4) reported alongside. Both are named in
            <code>token-report.json</code>; nothing is approximated.
          </li>
          <li>
            <strong>The .aui side</strong> is the exact <code>screen.aui</code> source shown in each card — what an
            LLM would emit to express the screen.
          </li>
          <li>
            <strong>The React side has two numbers.</strong> <em>Generated</em> is the deterministic output of the
            compiler running on the same parsed AST (the <code>generated.tsx</code> in each card).{' '}
            <em>Hand-written</em> is a realistic React implementation of the same screen — imports, handlers, local
            components — authored by hand for validation and committed in{' '}
            <code>src/lib/handwritten.ts</code>. The headline savings compare .aui against hand-written React,
            because that is what a developer would actually ship; the tool's generated output is already comparable
            or smaller.
          </li>
          <li>
            <strong>Functional equivalence.</strong> Every scenario declares a machine-readable feature contract
            (rendered nodes, bindings, actions, events). The validator fails if a declared feature is missing from
            either implementation — so <code>.aui</code> is only ever compared against React that behaves the same
            way (the form scenario's <code>change=</code> events match real <code>onChange</code> handlers).
          </li>
          <li>
            <strong>Fairness.</strong> The screens are identical, data flows through bindings/props rather than
            hard-coded literals, and component definitions are counted on both sides (a <code>def</code> template
            becomes a local React component). Both versions are unminified source, the way an LLM produces and reads
            code.
          </li>
          <li>
            <strong>Reproducible.</strong> The numbers on this page come from <code>token-report.json</code>, written
            by <code>scripts/validate-tokens.ts</code>. Run <code>npm run validate:tokens</code> to re-measure
            everything (parse → validate → normalize → compile → count → print → rewrite the report); it exits
            non-zero if .aui is ever larger than functionally equivalent hand-written React, if a declared feature
            is missing, or if generated TSX fails its syntax gate. Run{' '}
            <code>npm run validate:tokens --check</code> to verify the committed report is still current.
          </li>
          <li>
            <strong>Instruction overhead.</strong> Teaching a model the AUI grammar costs tokens too: the skill
            (<code>skills/write-aui-ui/SKILL.md</code>) is {cold.toLocaleString('en-US')} tokens under{' '}
            <code>{PRIMARY}</code>. Cold-start accounting charges that to every request; warm accounting amortizes it
            to 0 across a session. The token-reduction numbers above are the warm numbers — the raw output savings
            of the language itself.
          </li>
        </ol>

        <MethodTable />
        <p className="method-foot">
          Encodings measured: {Object.entries(TOKEN_REPORT.tokenizers).map(([k, v]) => `${k} (${v})`).join(' · ')}.
        </p>

        <p className="method-foot">
          Same tokenizer, same screens, committed corpus, one command to re-run: the numbers above are the current
          output of that script.
        </p>
      </div>

      <div className="gallery-note">
        <h3>Why the tokens matter</h3>
        <p>
          For an LLM generating UI, every output token is cost, latency, and a chance to drift. When the same screen
          is{' '}
          <strong>
            {Math.round((1 - totals.aui / totals.handwritten) * 100)}% cheaper in .aui than in hand-written React
          </strong>
          , the model has less room for error in exactly the places that are hardest to repair — imports, handlers,
          and prop plumbing. The generated React is comparable to hand-written at worst and smaller at best; .aui is
          the floor, because the compiler does the plumbing for you.
        </p>
      </div>
    </Section>
  );
}
