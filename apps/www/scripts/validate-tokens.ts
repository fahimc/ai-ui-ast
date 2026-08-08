/**
 * Token validation script (v0.2).
 *
 * Re-measures the Examples-page token claim for every gallery scenario:
 *
 *   1. `.aui`        — the exact source shown on the page (gallery.ts).
 *   2. Generated     — the deterministic React the compiler emits from the
 *                      same parsed AST (via the strict compile pipeline).
 *   3. Hand-written  — the realistic React implementation of the same screen
 *                      authored for validation (handwritten.ts).
 *
 * Rules enforced by this script (v0.2):
 *
 *   - Tokenizer encodings are pinned explicitly (o200k_base primary,
 *     cl100k_base legacy) and named in the report. There is NO chars/4
 *     approximation fallback — a tokenizer failure exits non-zero.
 *   - Every scenario carries a machine-readable `features` contract
 *     (render / bindings / actions / events). The benchmark fails when a
 *     declared feature is missing from either implementation, so `.aui` is
 *     only ever compared against functionally equivalent React.
 *   - Every scenario must pass the strict package pipeline (parse →
 *     validate → normalize → compile) with the website registry, and the
 *     generated TSX must transpile (syntax gate).
 *   - Instruction overhead is reported in cold and warm modes from
 *     skills/write-aui-ui/SKILL.md.
 *
 * Usage (from apps/www):
 *   npm run validate:tokens          # measure, print, and write token-report.json
 *   npm run validate:tokens --check  # verify the committed report matches current
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { compile } from '@codedia/parser';
import { GALLERY } from '../src/lib/gallery.ts';
import { HANDWRITTEN } from '../src/lib/handwritten.ts';
import { WWW_REGISTRY } from '../src/lib/registry.ts';
import { countTokens, TOKENIZER_ENCODINGS, ENCODING_LABELS } from '../src/lib/tokens.ts';
import type { TokenizerEncoding } from '../src/lib/tokens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = join(ROOT, 'token-report.json');
const SKILL_PATH = join(ROOT, '..', '..', 'skills', 'write-aui-ui', 'SKILL.md');
const CHECK_MODE = process.argv.includes('--check');

interface EncodingCounts {
  aui: number;
  generated: number;
  handwritten: number;
}

interface ScenarioRow {
  id: string;
  title: string;
  features: { render: string[]; bindings: string[]; actions: string[]; events: string[] };
  tokenizers: Record<TokenizerEncoding, EncodingCounts>;
}

/** Static feature-equivalence gate between .aui and hand-written React. */
function featureFailures(scenario: (typeof GALLERY)[number], handwritten: string): string[] {
  const failures: string[] = [];
  const { auiCode, features } = scenario;
  const has = (re: RegExp, text: string) => re.test(text);
  const word = (s: string) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

  for (const node of features.render) {
    if (!has(word(node), auiCode)) failures.push(`.aui is missing rendered node "${node}"`);
    if (!has(word(node), handwritten)) failures.push(`hand-written React is missing rendered node "${node}"`);
  }
  for (const path of features.bindings) {
    if (!auiCode.includes('$' + path)) failures.push(`.aui is missing binding "$"${path}`);
    if (!handwritten.includes(path)) failures.push(`hand-written React is missing binding "${path}"`);
  }
  for (const action of features.actions) {
    if (!has(new RegExp(`action=${action}\\b`), auiCode)) failures.push(`.aui is missing action "${action}"`);
    if (!has(new RegExp(`onAction\\(['"]${action}['"]`), handwritten)) failures.push(`hand-written React is missing action "${action}"`);
  }
  for (const event of features.events) {
    if (!has(new RegExp(`change=${event}\\b`), auiCode)) failures.push(`.aui is missing change= event "${event}"`);
    // The event must appear as a quoted handler argument in the React side
    // (e.g. onAction('emailChanged', …) or handleChange('emailChanged')).
    if (!handwritten.includes(`'${event}'`) && !handwritten.includes(`"${event}"`)) {
      failures.push(`hand-written React is missing event "${event}"`);
    }
  }
  return failures;
}

/** Syntax gate: generated TSX must transpile. */
function tsxErrors(code: string): string[] {
  const out = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

function measure(): { rows: ScenarioRow[]; totals: Record<TokenizerEncoding, EncodingCounts>; failures: string[] } {
  const rows: ScenarioRow[] = [];
  const totals: Record<TokenizerEncoding, EncodingCounts> = {
    o200k_base: { aui: 0, generated: 0, handwritten: 0 },
    cl100k_base: { aui: 0, generated: 0, handwritten: 0 },
  };
  const failures: string[] = [];

  for (const scenario of GALLERY) {
    const handwritten = HANDWRITTEN[scenario.id];
    if (handwritten === undefined) {
      failures.push(`Missing hand-written React for scenario "${scenario.id}" in src/lib/handwritten.ts`);
      continue;
    }

    // Strict package pipeline must be clean (registry-only imports).
    const result = compile(scenario.auiCode, { registry: WWW_REGISTRY, strict: true });
    if (!result.ok || result.code === undefined) {
      failures.push(
        `Scenario "${scenario.id}" fails strict compilation: ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join(' | ')}`,
      );
      continue;
    }
    const generated = result.code;
    const syntaxErrors = tsxErrors(generated);
    if (syntaxErrors.length > 0) {
      failures.push(`Scenario "${scenario.id}" generates invalid TSX: ${syntaxErrors.join('; ')}`);
    }

    // Functional equivalence gate.
    failures.push(...featureFailures(scenario, handwritten).map((f) => `Scenario "${scenario.id}": ${f}`));

    const tokenizers: Record<TokenizerEncoding, EncodingCounts> = { o200k_base: { aui: 0, generated: 0, handwritten: 0 }, cl100k_base: { aui: 0, generated: 0, handwritten: 0 } };
    for (const encoding of TOKENIZER_ENCODINGS) {
      const aui = countTokens(scenario.auiCode, encoding);
      const gen = countTokens(generated, encoding);
      const hand = countTokens(handwritten, encoding);
      tokenizers[encoding] = { aui, generated: gen, handwritten: hand };
      totals[encoding].aui += aui;
      totals[encoding].generated += gen;
      totals[encoding].handwritten += hand;
      if (!(aui < hand)) {
        failures.push(`Scenario "${scenario.id}" (${encoding}): .aui (${aui}) is not smaller than hand-written React (${hand})`);
      }
      if (!(gen <= hand)) {
        failures.push(`Scenario "${scenario.id}" (${encoding}): generated React (${gen}) exceeds hand-written React (${hand})`);
      }
    }

    rows.push({
      id: scenario.id,
      title: scenario.title,
      features: scenario.features,
      tokenizers,
    });
  }

  return { rows, totals, failures };
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function print(rows: ScenarioRow[], totals: Record<TokenizerEncoding, EncodingCounts>, instructionOverhead: Record<TokenizerEncoding, number>): void {
  for (const encoding of TOKENIZER_ENCODINGS) {
    console.log(`\nToken comparison — ${ENCODING_LABELS[encoding]} (gpt-tokenizer)`);
    console.log('='.repeat(110));
    console.log(pad('Scenario', 30) + pad('.aui', 10) + pad('Generated', 12) + pad('Hand-written', 14) + pad('Saved vs hand-written', 24) + 'React is larger');
    console.log('-'.repeat(110));
    let auiTotal = 0;
    let genTotal = 0;
    let handTotal = 0;
    for (const r of rows) {
      const t = r.tokenizers[encoding];
      auiTotal += t.aui;
      genTotal += t.generated;
      handTotal += t.handwritten;
      console.log(
        pad(r.title.slice(0, 28), 30) +
          pad(String(t.aui), 10) +
          pad(String(t.generated), 12) +
          pad(String(t.handwritten), 14) +
          pad(String(t.handwritten - t.aui), 24) +
          (t.handwritten / t.aui).toFixed(1) + '×',
      );
    }
    console.log('-'.repeat(110));
    console.log(
      pad('TOTAL', 30) +
        pad(String(auiTotal), 10) +
        pad(String(genTotal), 12) +
        pad(String(handTotal), 14) +
        pad(String(handTotal - auiTotal), 24) +
        (handTotal / auiTotal).toFixed(1) + '×',
    );
    console.log();
    console.log(`Saved across all scenarios (${encoding}): ${(handTotal - auiTotal).toLocaleString('en-US')} tokens ` +
      `(${(1 - auiTotal / handTotal) * 100}% fewer than hand-written React).`);
  }

  console.log('\nInstruction overhead (AUI skill, skills/write-aui-ui/SKILL.md):');
  for (const encoding of TOKENIZER_ENCODINGS) {
    console.log(`  ${encoding}: cold ${instructionOverhead[encoding]} tokens per request · warm 0 (amortized across screens in a session)`);
  }
}

function writeReport(rows: ScenarioRow[], totals: Record<TokenizerEncoding, EncodingCounts>, instructionOverhead: Record<TokenizerEncoding, number>): void {
  const report = {
    tokenizers: {
      o200k_base: ENCODING_LABELS.o200k_base,
      cl100k_base: ENCODING_LABELS.cl100k_base,
    },
    primaryEncoding: 'o200k_base' as const,
    note: 'Generated by scripts/validate-tokens.ts — run `npm run validate:tokens` to refresh. Do not edit by hand.',
    instructionOverhead: {
      cold: instructionOverhead,
      warm: { o200k_base: 0, cl100k_base: 0 },
      note: 'Cold charges the full AUI skill (skills/write-aui-ui/SKILL.md) to each request; warm amortizes it to 0 (cached system context across many screens).',
    },
    scenarios: rows,
    totals,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nWrote ${REPORT_PATH}`);
}

function check(rows: ScenarioRow[], totals: Record<TokenizerEncoding, EncodingCounts>, instructionOverhead: Record<TokenizerEncoding, number>): void {
  if (!existsSync(REPORT_PATH)) {
    console.error(`No committed report at ${REPORT_PATH} — run without --check first.`);
    process.exit(1);
  }
  const committed = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
    scenarios: ScenarioRow[];
    totals: Record<TokenizerEncoding, EncodingCounts>;
    instructionOverhead?: { cold?: Record<TokenizerEncoding, number> };
  };
  const byId = new Map(committed.scenarios.map((s) => [s.id, s]));
  const diffs: string[] = [];
  for (const r of rows) {
    const c = byId.get(r.id);
    if (!c) {
      diffs.push(`Scenario "${r.id}" missing from committed report`);
    } else {
      for (const encoding of TOKENIZER_ENCODINGS) {
        const a = r.tokenizers[encoding];
        const b = c.tokenizers[encoding];
        if (a.aui !== b.aui || a.generated !== b.generated || a.handwritten !== b.handwritten) {
          diffs.push(
            `Scenario "${r.id}" (${encoding}) drifted: committed (aui ${b.aui}, generated ${b.generated}, handwritten ${b.handwritten}) ` +
              `≠ current (aui ${a.aui}, generated ${a.generated}, handwritten ${a.handwritten})`,
          );
        }
      }
    }
  }
  for (const s of committed.scenarios) {
    if (!GALLERY.some((g) => g.id === s.id)) diffs.push(`Committed scenario "${s.id}" no longer exists`);
  }
  for (const encoding of TOKENIZER_ENCODINGS) {
    const a = totals[encoding];
    const b = committed.totals[encoding];
    if (a && b && (a.aui !== b.aui || a.generated !== b.generated || a.handwritten !== b.handwritten)) {
      diffs.push(`Totals (${encoding}) drifted.`);
    }
    const cold = committed.instructionOverhead?.cold?.[encoding];
    if (cold !== undefined && cold !== instructionOverhead[encoding]) {
      diffs.push(`Instruction overhead (${encoding}) drifted: committed ${cold} ≠ current ${instructionOverhead[encoding]}.`);
    }
  }
  if (diffs.length > 0) {
    console.error('\nReport is stale — re-run `npm run validate:tokens`:\n');
    for (const d of diffs) console.error('  ✗ ' + d);
    process.exit(1);
  }
  console.log(`\n✓ token-report.json is current (${rows.length} scenarios match, both encodings).`);
}

function readSkillTokens(): Record<TokenizerEncoding, number> {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const out = {} as Record<TokenizerEncoding, number>;
  for (const encoding of TOKENIZER_ENCODINGS) out[encoding] = countTokens(skill, encoding);
  return out;
}

const instructionOverhead = readSkillTokens();
const { rows, totals, failures } = measure();

if (failures.length > 0) {
  console.error('\nValidation failed:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}

print(rows, totals, instructionOverhead);
if (CHECK_MODE) {
  check(rows, totals, instructionOverhead);
} else {
  writeReport(rows, totals, instructionOverhead);
}
