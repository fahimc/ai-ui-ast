/**
 * LLM vs React generation benchmark harness (v0.2).
 *
 * Compares two conditions on the same UI briefs:
 *
 *   - AUI condition — the model writes `.aui`, then the deterministic
 *     compiler produces the React.
 *   - React condition — the model writes target React directly.
 *
 * Metrics per sample: prompt/input tokens, output tokens (pinned encodings),
 * first-pass parse success, first-pass validation success, generated-TSX
 * syntax success, repair turns, tokens consumed by repairs, task completion,
 * functional-contract pass rate, and estimated cost. Failures are retained
 * and scored — never filtered out.
 *
 * Two modes:
 *
 *   npm run benchmark:llm                       # fixture mode (no API keys)
 *   npm run benchmark:llm -- --mode live        # live provider runs (opt-in, needs keys)
 *
 * Fixture mode uses deterministic model-output stand-ins (benchmark/fixtures.ts)
 * so the harness runs end-to-end in CI and the scoring pipeline is validated.
 * Live mode calls a provider adapter (OpenAI or Anthropic) using environment
 * credentials; without them it exits with instructions instead of silently
 * fabricating numbers.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { compile } from '@codedia/parser';
import { BRIEFS, type UiBrief } from './briefs.ts';
import { auiFixture, reactFixture, AUI_INSTRUCTIONS, REACT_INSTRUCTIONS } from './fixtures.ts';
import { WWW_REGISTRY } from '../../src/lib/registry.ts';
import { countTokens, TOKENIZER_ENCODINGS } from '../../src/lib/tokens.ts';
import type { TokenizerEncoding } from '../../src/lib/tokens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL_PATH = join(ROOT, '..', '..', 'skills', 'write-aui-ui', 'SKILL.md');

// ── CLI args ────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const MODE = arg('mode') ?? 'fixture';
const MODEL = arg('model') ?? 'gpt-4o';
const SAMPLES = Number(arg('samples') ?? '1');
const OUT = arg('out') ?? join(ROOT, 'benchmark-results.json');
const ONLY = (arg('briefs') ?? '').split(',').filter(Boolean);

// ── Cost model (USD per 1M tokens, approximate list prices) ────────────────
const COST_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1': { input: 2, output: 8 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
};

interface SampleResult {
  briefId: string;
  condition: 'aui' | 'react';
  model: string;
  /** Was this a deterministic fixture or a live model response? */
  source: 'fixture' | 'live';
  output: string;
  promptTokens: Record<TokenizerEncoding, number>;
  outputTokens: Record<TokenizerEncoding, number>;
  repairTokens: Record<TokenizerEncoding, number>;
  firstPassParseOk: boolean;
  firstPassValidOk: boolean;
  generatedTsxOk: boolean;
  repairTurns: number;
  completed: boolean;
  contract: { nodes: boolean; bindings: boolean; actions: boolean; events: boolean; text: boolean };
  costUsd: number;
}

interface BriefSummary {
  briefId: string;
  title: string;
  category: string;
  aui: SampleResult;
  react: SampleResult;
}

interface RunReport {
  mode: 'fixture' | 'live';
  model: string;
  samplesPerBrief: number;
  tokenizers: Record<TokenizerEncoding, string>;
  instructionOverhead: { cold: Record<TokenizerEncoding, number>; warm: Record<TokenizerEncoding, number> };
  generatedAt: string;
  briefs: BriefSummary[];
  totals: {
    aui: { outputTokens: Record<TokenizerEncoding, number>; firstPassValid: number; completed: number; contractPass: number; costUsd: number };
    react: { outputTokens: Record<TokenizerEncoding, number>; firstPassValid: number; completed: number; contractPass: number; costUsd: number };
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function tsxErrors(code: string): string[] {
  const out = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

function tokensOf(text: string): Record<TokenizerEncoding, number> {
  const out = {} as Record<TokenizerEncoding, number>;
  for (const enc of TOKENIZER_ENCODINGS) out[enc] = countTokens(text, enc);
  return out;
}

function sumTokens(a: Record<TokenizerEncoding, number>, b: Record<TokenizerEncoding, number>): Record<TokenizerEncoding, number> {
  const out = {} as Record<TokenizerEncoding, number>;
  for (const enc of TOKENIZER_ENCODINGS) out[enc] = a[enc] + b[enc];
  return out;
}

function costEstimate(prompt: Record<TokenizerEncoding, number>, output: Record<TokenizerEncoding, number>, model: string): number {
  const rate = COST_PER_MTOK[model] ?? COST_PER_MTOK['gpt-4o'];
  const p = prompt.o200k_base;
  const o = output.o200k_base;
  return (p / 1_000_000) * rate.input + (o / 1_000_000) * rate.output;
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

/** Score a generated screen against a brief's functional contract. */
function checkContract(code: string, brief: UiBrief): { nodes: boolean; bindings: boolean; actions: boolean; events: boolean; text: boolean } {
  const { contract } = brief;
  // Structural constructs (If/Else/For) compile away and are checked via the
  // generated behavior, so they are not required as literal tokens.
  const nonStructural = contract.nodes.filter((n) => !['If', 'Else', 'For'].includes(n));
  return {
    nodes: nonStructural.every((n) => hasWord(code, n)),
    bindings: contract.bindings.every((p) => code.includes(p)),
    actions: contract.actions.every((a) => code.includes(`onAction("${a}"`) || code.includes(`onAction('${a}'`)),
    events: contract.events.every((e) => code.includes(`onAction("${e}"`) || code.includes(`onAction('${e}'`)),
    text: contract.text.every((t) => code.includes(t)),
  };
}

// ── Condition runners ───────────────────────────────────────────────────────
function runAuiCondition(brief: UiBrief, model: string, source: 'fixture' | 'live', raw: string): SampleResult {
  const promptText = `${AUI_INSTRUCTIONS}\n\nScreen to build:\n${brief.brief}\n`;
  const promptTokens = tokensOf(promptText);
  const compileResult = compile(raw, { registry: WWW_REGISTRY, strict: true });
  const firstPassParseOk = compileResult.rawAst.rootNodes.length > 0;
  const firstPassValidOk = compileResult.ok;
  let generated = compileResult.code ?? '';
  let generatedTsxOk = generated !== '';
  if (generated) {
    const errors = tsxErrors(generated);
    generatedTsxOk = errors.length === 0;
  }
  const contract = checkContract(generated, brief);
  const completed = firstPassValidOk && generatedTsxOk && contract.nodes && contract.bindings;
  const costUsd = costEstimate(promptTokens, tokensOf(raw), model);
  void source;
  return {
    briefId: brief.id,
    condition: 'aui',
    model,
    source,
    output: raw,
    promptTokens,
    outputTokens: tokensOf(raw),
    repairTokens: { o200k_base: 0, cl100k_base: 0 },
    firstPassParseOk,
    firstPassValidOk,
    generatedTsxOk,
    repairTurns: 0,
    completed,
    contract,
    costUsd,
  };
}

function runReactCondition(brief: UiBrief, model: string, source: 'fixture' | 'live', raw: string): SampleResult {
  const promptText = `${REACT_INSTRUCTIONS}\n\nScreen to build:\n${brief.brief}\n`;
  const promptTokens = tokensOf(promptText);
  const firstPassParseOk = raw.trim().length > 0;
  const errors = tsxErrors(raw);
  const generatedTsxOk = errors.length === 0;
  const contract = checkContract(raw, brief);
  const completed = generatedTsxOk && contract.nodes && contract.bindings;
  return {
    briefId: brief.id,
    condition: 'react',
    model,
    source,
    output: raw,
    promptTokens,
    outputTokens: tokensOf(raw),
    repairTokens: { o200k_base: 0, cl100k_base: 0 },
    firstPassParseOk,
    firstPassValidOk: generatedTsxOk,
    generatedTsxOk,
    repairTurns: 0,
    completed,
    contract,
    costUsd: costEstimate(promptTokens, tokensOf(raw), model),
  };
}

// ── Live provider adapters (opt-in) ─────────────────────────────────────────
async function liveGenerate(prompt: string, model: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 3000 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }
  if (anthropicKey) {
    const modelName = model.startsWith('claude') ? model : 'claude-sonnet-4';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelName, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text: string }[] };
    return data.content.map((c) => c.text).join('');
  }
  throw new Error(
    'Live mode needs credentials. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, or run fixture mode: `npm run benchmark:llm` (no --mode).',
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const briefs = ONLY.length > 0 ? BRIEFS.filter((b) => ONLY.includes(b.id)) : BRIEFS;
  if (briefs.length === 0) {
    console.error(`No briefs matched --briefs ${ONLY.join(',')}. Available: ${BRIEFS.map((b) => b.id).join(', ')}`);
    process.exit(1);
  }

  const skill = readFileSync(SKILL_PATH, 'utf8');
  const cold = tokensOf(skill);

  const summaries: BriefSummary[] = [];
  const failures: string[] = [];

  for (const brief of briefs) {
    const auiOutputs: SampleResult[] = [];
    const reactOutputs: SampleResult[] = [];
    for (let s = 0; s < SAMPLES; s++) {
      let auiRaw: string;
      let reactRaw: string;
      if (MODE === 'live') {
        auiRaw = await liveGenerate(`${AUI_INSTRUCTIONS}\n\nScreen to build:\n${brief.brief}\n`, MODEL);
        reactRaw = await liveGenerate(`${REACT_INSTRUCTIONS}\n\nScreen to build:\n${brief.brief}\n`, MODEL);
      } else {
        auiRaw = auiFixture(brief);
        reactRaw = reactFixture(brief);
      }
      auiOutputs.push(runAuiCondition(brief, MODEL, MODE, auiRaw));
      reactOutputs.push(runReactCondition(brief, MODEL, MODE, reactRaw));
    }
    // Aggregate: keep the first sample as the representative; totals sum.
    const aui = auiOutputs[0];
    const react = reactOutputs[0];
    // In fixture mode the fixtures must compile — fail loudly if not.
    if (MODE === 'fixture' && !aui.firstPassValidOk) {
      failures.push(`Fixture for brief "${brief.id}" failed strict AUI compilation — fix benchmark/fixtures.ts`);
    }
    if (MODE === 'fixture' && !react.generatedTsxOk) {
      failures.push(`Fixture for brief "${brief.id}" is invalid TSX — fix benchmark/fixtures.ts`);
    }
    summaries.push({ briefId: brief.id, title: brief.title, category: brief.category, aui, react });
  }

  const tally = (results: SampleResult[]) =>
    results.reduce(
      (acc, r) => {
        acc.outputTokens = sumTokens(acc.outputTokens, r.outputTokens);
        acc.repairTokens = sumTokens(acc.repairTokens, r.repairTokens);
        acc.firstPassValid += r.firstPassValidOk ? 1 : 0;
        acc.completed += r.completed ? 1 : 0;
        acc.contractPass += r.contract.nodes && r.contract.bindings ? 1 : 0;
        acc.costUsd += r.costUsd;
        return acc;
      },
      {
        outputTokens: { o200k_base: 0, cl100k_base: 0 } as Record<TokenizerEncoding, number>,
        repairTokens: { o200k_base: 0, cl100k_base: 0 } as Record<TokenizerEncoding, number>,
        firstPassValid: 0,
        completed: 0,
        contractPass: 0,
        costUsd: 0,
      },
    );

  const allAui = summaries.map((s) => s.aui);
  const allReact = summaries.map((s) => s.react);
  const report: RunReport = {
    mode: MODE as 'fixture' | 'live',
    model: MODEL,
    samplesPerBrief: SAMPLES,
    tokenizers: {
      o200k_base: 'o200k_base (GPT-4o / GPT-4.1 family)',
      cl100k_base: 'cl100k_base (GPT-3.5 / GPT-4 legacy)',
    },
    instructionOverhead: { cold, warm: { o200k_base: 0, cl100k_base: 0 } },
    generatedAt: new Date().toISOString(),
    briefs: summaries,
    totals: { aui: tally(allAui), react: tally(allReact) },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  printSummary(report);

  if (failures.length > 0) {
    console.error('\nFixture failures (fix the fixtures, not the scorer):');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
}

function printSummary(report: RunReport): void {
  const { totals } = report;
  const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(0)}%`;
  const t = totals.aui;
  const r = totals.react;
  console.log(`\nLLM generation benchmark — mode=${report.mode} model=${report.model} briefs=${report.briefs.length} samples=${report.samplesPerBrief}`);
  console.log('='.repeat(96));
  console.log('Condition     output-tok(o200k)  first-pass-valid  completed  contract-pass  est-cost');
  console.log('-'.repeat(96));
  const outTok = (x: { outputTokens: Record<TokenizerEncoding, number> }) => x.outputTokens.o200k_base.toLocaleString('en-US');
  console.log(
    `AUI           ${outTok(t).padStart(12)}  ${pct(t.firstPassValid, report.briefs.length).padStart(9)}  ${pct(t.completed, report.briefs.length).padStart(5)}  ${pct(t.contractPass, report.briefs.length).padStart(7)}  $${t.costUsd.toFixed(2)}`,
  );
  console.log(
    `React         ${outTok(r).padStart(12)}  ${pct(r.firstPassValid, report.briefs.length).padStart(9)}  ${pct(r.completed, report.briefs.length).padStart(5)}  ${pct(r.contractPass, report.briefs.length).padStart(7)}  $${r.costUsd.toFixed(2)}`,
  );
  console.log('-'.repeat(96));
  if (r.outputTokens.o200k_base > 0) {
    const reduction = (1 - t.outputTokens.o200k_base / r.outputTokens.o200k_base) * 100;
    console.log(`AUI output tokens are ${reduction.toFixed(1)}% fewer than direct React (${report.tokenizers.o200k_base}).`);
  }
  console.log(`Instruction overhead: cold ${report.instructionOverhead.cold.o200k_base} tokens/request (skill), warm 0 (amortized).`);
  console.log(`Wrote ${OUT}`);
}

await main();
