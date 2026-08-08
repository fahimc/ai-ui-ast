import test from 'node:test';
import assert from 'node:assert';
import ts from 'typescript';
import { parse } from './parser.ts';
import { compileReact } from './react.ts';
import { defineRegistry } from './registry.ts';

/**
 * Real syntax/validity gate: every generated fixture must transpile as TSX.
 * `transpileModule` reports JSX syntax errors (e.g. adjacent siblings in an
 * expression context), which regex assertions can never catch.
 */
function checkTsx(code: string): string[] {
  const out = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

function assertValidTsx(code: string, label: string): void {
  const errors = checkTsx(code);
  assert.deepStrictEqual(errors, [], `${label} produced invalid TSX: ${errors.join('; ')}`);
}

const WWW = defineRegistry({
  AreaChart: { imports: { source: '@acme/charts', export: 'AreaChart' }, props: { data: { type: 'binding' }, height: { type: 'number' } }, children: 'nodes' },
  Area: { imports: { source: '@acme/charts', export: 'Area' }, props: { dataKey: { type: 'string' } }, children: 'none' },
});

test('compileReact emits registry imports, core imports, and def components', () => {
  const doc = parse(`def StatCard label value tone=default
  Card
    Text $label
    Metric value=$value tone=$tone
Page Dashboard
  Stack gap=md
    StatCard label="Active users" value=$metrics.users
    StatCard label="Signups" value=$metrics.signups`);
  const out = compileReact(doc);
  assert.match(out, /import \{ Card, Metric, Page, Stack, Text \} from "@\/components\/ui"/);
  assert.match(out, /function StatCard\(\{ label, value, tone = "default" \}: any\)/);
  assert.match(out, /<StatCard label="Active users" value=\{data\.metrics\.users\} \/>/);
  assert.match(out, /export function Dashboard\(\{ data, onAction \}/);
  assertValidTsx(out, 'defs');
});

test('multi-child If and Else compile to a valid fragment ternary', () => {
  const doc = parse(`Page Users
  If condition=$user.admin
    Badge tone=success "Admin"
    Text "More"
  Else
    Badge tone=muted "Member"
    Text "Less"`);
  const out = compileReact(doc);
  assert.match(out, /\{data\.user\.admin \? \(/);
  assert.match(out, /<>/);
  assert.match(out, /<\/>/);
  assertValidTsx(out, 'multi-child If/Else');
});

test('multi-child For compiles to a keyed Fragment map', () => {
  const doc = parse(`Page Users
  For each=$users
    Badge tone=info $item.status
    Text $item.name`);
  const out = compileReact(doc);
  assert.match(out, /import \{ Fragment \} from 'react'/);
  assert.match(out, /<Fragment key=\{i\}>/);
  assert.match(out, /data\.users\.map\(\(item, i\) => \(/);
  assertValidTsx(out, 'multi-child For');
});

test('single-child For puts the key on the element', () => {
  const doc = parse(`Page Users
  For each=$users
    Row gap=md
      Text $item.name`);
  const out = compileReact(doc);
  assert.match(out, /<Row key=\{i\} gap="md">/);
  assert.ok(!out.includes('Fragment'));
  assertValidTsx(out, 'single-child For');
});

test('multiple document roots compile to a fragment', () => {
  const doc = parse(`Page A
  Card
    Text "one"
Page B
  Card
    Text "two"`);
  const out = compileReact(doc);
  assert.match(out, /<>\n/);
  assertValidTsx(out, 'multiple roots');
});

test('def with multiple root children compiles to a fragment return', () => {
  const doc = parse(`def Pair a b
  Text $a
  Text $b
Page P
  Pair a="x" b="y"`);
  const out = compileReact(doc);
  assert.match(out, /<>/);
  assertValidTsx(out, 'multi-root def');
});

test('nested For + If compiles to valid TSX', () => {
  const doc = parse(`Page P
  For each=$projects
    Card
      Heading level=3 $item.name
      If condition=$item.active
        Badge tone=success "Active"
      Else
        Badge tone=muted "Archived"`);
  const out = compileReact(doc);
  assertValidTsx(out, 'nested For + If');
});

test('numeric and boolean props emit typed JSX values', () => {
  const doc = parse(`Page P
  Heading level=2 "Title"
  Image src=$user.avatar round=true alt="avatar"`);
  const out = compileReact(doc);
  assert.match(out, /<Heading level=\{2\}>/);
  assert.match(out, /round=\{true\}/);
  assertValidTsx(out, 'typed props');
});

test('quoted $ strings stay literal, unquoted become bindings', () => {
  const doc = parse(`Page P
  Text label="$user.name"
  Text label=$user.name`);
  const out = compileReact(doc);
  assert.match(out, /label="\$user\.name"/);
  assert.match(out, /label=\{data\.user\.name\}/);
  assertValidTsx(out, 'literal $ string');
});

test('text containing braces, quotes, backslashes, and newlines is escaped', () => {
  const doc = parse(`Page P
  Text "Hello {world} with \\"quotes\\" and \\\\ backslash"
  Text "line one\\nline two"`);
  const out = compileReact(doc);
  assertValidTsx(out, 'escaped text');
});

test('action names with quotes and backslashes are escaped', () => {
  const doc = parse(`Page P
  Button action=pay\\"now "Pay"`);
  const out = compileReact(doc);
  // The emitted JS string literal must be syntactically valid (the TSX gate
  // below proves it) and must preserve the action name characters.
  assert.ok(out.includes('onAction('));
  assert.ok(out.includes('pay'));
  assertValidTsx(out, 'escaped action');
});

test('change= events compile to target handlers with payloads', () => {
  const doc = parse(`Page P
  Input value=$form.email change=emailChanged
  Checkbox checked=$form.remember change=rememberChanged "Remember"`);
  const out = compileReact(doc);
  assert.match(out, /onChange=\{\(e\) => onAction\("emailChanged", e\.target\.value\)\}/);
  assert.match(out, /onChange=\{\(e\) => onAction\("rememberChanged", e\.target\.checked\)\}/);
  assertValidTsx(out, 'events');
});

test('registry-owned third-party imports are derived, not written', () => {
  const doc = parse(`Page P
  AreaChart data=$metrics.series height=280
    Area dataKey="revenue"`);
  const out = compileReact(doc, { registry: WWW });
  assert.match(out, /import \{ Area, AreaChart \} from "@acme\/charts"/);
  assertValidTsx(out, 'registry imports');
});

test('explicit imports pass through; side-effect imports emit correctly', () => {
  const doc = parse(`import { AreaChart } from "recharts"
import "polyfill"
Page P
  AreaChart data=$series`);
  const out = compileReact(doc);
  assert.match(out, /import \{ AreaChart \} from "recharts"/);
  assert.match(out, /import "polyfill"/);
  assertValidTsx(out, 'explicit + side-effect imports');
});

test('$item, $index and $root bindings resolve in loops', () => {
  const doc = parse(`Page P
  For each=$users
    Row
      Text "$index: $item.name"
      Text $root.site.name`);
  const out = compileReact(doc);
  assert.match(out, /\{i\}: \{item\.name\}/);
  assert.match(out, /\{data\.site\.name\}/);
  assertValidTsx(out, 'loop bindings');
});

test('compileReact is deterministic: same document, same output', () => {
  const src = `Page Demo
  Stack gap=md
    Heading level=2 "Hello"
    Button variant=primary action=go "Go"`;
  const a = compileReact(parse(src));
  const b = compileReact(parse(src));
  assert.strictEqual(a, b);
});

test('registry export aliases are emitted when export differs from node name', () => {
  const reg = defineRegistry({
    LineChart: { imports: { source: '@viz', export: 'Line' }, props: {}, children: 'none' },
  });
  const out = compileReact(parse('Page P\n  LineChart data=$s'), { registry: reg });
  assert.match(out, /import \{ Line as LineChart \} from "@viz"/);
  assertValidTsx(out, 'alias import');
});
