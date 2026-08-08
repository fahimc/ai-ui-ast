import test from 'node:test';
import assert from 'node:assert';
import { compile } from './compile.ts';
import { formatDiagnostics, formatDiagnosticsForLLM } from './diagnostics.ts';

test('compile produces code, raw ast, canonical ast, and diagnostics', () => {
  const result = compile('Page Dashboard data=$metrics\n  Stack gap=md\n    Heading level=1 "Overview"');
  assert.strictEqual(result.ok, true);
  assert.ok(result.code!.includes('export function Dashboard'));
  assert.ok(result.rawAst.rootNodes[0].type === 'Page');
  assert.strictEqual(result.ast!.rootNodes[0].kind, 'component');
  assert.deepStrictEqual(result.diagnostics, []);
});

test('strict compile refuses to emit code when errors exist', () => {
  const result = compile('Page P\n  UnknownThing', { strict: true });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, undefined);
  assert.ok(result.diagnostics.some((d) => d.code === 'AUI_UNKNOWN_NODE'));
});

test('lenient compile emits code alongside diagnostics', () => {
  const result = compile('Page P\n  UnknownThing');
  assert.strictEqual(result.ok, false);
  assert.ok(result.code!.includes('export function P'));
});

test('strict compile succeeds on valid input with warnings', () => {
  const result = compile('Page P\n  Card nope=x', { strict: true });
  assert.strictEqual(result.ok, true); // warnings do not block strict compile
  assert.ok(result.diagnostics.some((d) => d.code === 'AUI_UNKNOWN_PROP' && d.severity === 'warning'));
});

test('registry-only import policy blocks explicit imports in strict mode', () => {
  const result = compile('import { AreaChart } from "recharts"\nPage P', { strict: true });
  assert.strictEqual(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.code === 'AUI_COLLISION'));
});

test('explicit imports work through the allowlist option', () => {
  const result = compile('import { AreaChart } from "recharts"\nPage P', { strict: true, imports: { mode: 'explicit', allow: ['recharts'] } });
  assert.strictEqual(result.ok, true);
});

test('formatDiagnostics renders line-anchored, LLM-friendly output', () => {
  const result = compile('Page P\n  Button variant=purple', { strict: true });
  const text = formatDiagnostics(result.diagnostics);
  assert.match(text, /line 2/);
  assert.match(text, /AUI_INVALID_TOKEN/);
  const llm = formatDiagnosticsForLLM(result.diagnostics, 'Page P\n  Button variant=purple');
  assert.match(llm, /AUI_INVALID_TOKEN at line 2(?::\d+)?/);
  assert.match(llm, /Button variant=purple/);
});

test('compile output is deterministic', () => {
  const src = 'Page Dashboard data=$metrics\n  Stack gap=md\n    Metric label="Active users" value=$metrics.active';
  assert.strictEqual(compile(src).code, compile(src).code);
});

test('componentName option overrides the generated name', () => {
  const result = compile('Page P\n  Text "x"', { componentName: 'CustomView' });
  assert.ok(result.code!.includes('export function CustomView'));
});
