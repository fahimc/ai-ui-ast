import test from 'node:test';
import assert from 'node:assert';
import { parse } from './parser.ts';
import { compileReact } from './react.ts';

test('compileReact emits third-party imports, core imports, and def components', () => {
  const doc = parse(`import { AreaChart } from "recharts"
Page Dashboard
  def StatCard label value tone=default
    Card
      Text $label
      Metric value=$value tone=$tone
  Stack gap=md
    StatCard label="Active users" value=$metrics.users
    StatCard label="Signups" value=$metrics.signups`);
  const out = compileReact(doc);
  assert.match(out, /import { AreaChart } from "recharts"/);
  assert.match(out, /import \{ Card, Metric, Page, Stack, Text \} from '@\/components\/ui'/);
  assert.match(out, /function StatCard\(\{ label, value, tone = "default" \}: any\)/);
  assert.match(out, /<StatCard label="Active users" value=\{data\.metrics\.users\} \/>/);
  assert.match(out, /export function Dashboard\(\{ data, onAction \}/);
});

test('compileReact compiles If/Else to a ternary and For to a map', () => {
  const doc = parse(`Page Users
  If condition=$user.admin
    Badge tone=success "Admin"
  Else
    Badge tone=muted "Member"
  For each=$users
    Row
      Text $item.name`);
  const out = compileReact(doc);
  assert.match(out, /\{data\.user\.admin \? \(/);
  assert.match(out, /\) : \(/);
  assert.match(out, /Badge tone="success">Admin<\/Badge>/);
  assert.match(out, /\{data\.users\.map\(\(item, i\) => \(/);
  assert.match(out, /<Text>\{item\.name\}<\/Text>/);
});

test('compileReact interpolates bindings inside text content', () => {
  const doc = parse(`Page Home
  Heading level=1 "Welcome back, $user.name"`);
  const out = compileReact(doc);
  assert.match(out, /<Heading level="1">Welcome back, \{data\.user\.name\}<\/Heading>/);
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
