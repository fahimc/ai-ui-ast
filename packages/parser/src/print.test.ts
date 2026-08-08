import test from 'node:test';
import assert from 'node:assert';
import { parse } from './parser.ts';
import { printAui } from './print.ts';
import { normalize } from './normalize.ts';

function roundTrip(src: string): string {
  const once = normalize(parse(src));
  assert.ok(once.ok, `first normalize failed: ${JSON.stringify(once.diagnostics)}`);
  const printed = printAui(once.value!);
  const twice = normalize(parse(printed));
  assert.ok(twice.ok, `second normalize failed: ${JSON.stringify(twice.diagnostics)}\n--- printed ---\n${printed}`);
  return printed;
}

test('printAui prints a simple tree deterministically', () => {
  const printed = roundTrip(`Page Dashboard data=$user
  Stack gap=md
    Heading level=2 "Welcome"
    Button variant=primary action=go "Go"`);
  // `action=go` is a string-typed prop, so the canonical printer quotes it.
  assert.strictEqual(
    printed,
    `Page Dashboard data=$user
  Stack gap=md
    Heading level=2 "Welcome"
    Button variant=primary action="go" "Go"`,
  );
});

test('printAui renders structural If/Else and For explicitly', () => {
  const printed = roundTrip(`If condition=$user.admin
  Badge tone=success "Admin"
  Text "More"
Else
  Badge tone=muted "Member"
For each=$items
  Row
    Text $item.name`);
  assert.ok(printed.includes('If condition=$user.admin'));
  assert.ok(printed.includes('Else'));
  assert.ok(printed.includes('For each=$items'));
});

test('round-trip preserves typed values', () => {
  const src = `Page P
  Heading level=2 "Title"
  Image round=true src=$user.avatar
  Text label="$user.name"
  Select value=$plan options="Free,Pro"`;
  const a = normalize(parse(src)).value!;
  const b = normalize(parse(printAui(a))).value!;
  assert.deepStrictEqual(a, b);
});

test('round-trip preserves defs with defaults', () => {
  const src = `def StatCard label value tone=default count=2
  Card
    Text $label
    Metric value=$value tone=$tone
Page P
  StatCard label="x" value=$v`;
  const a = normalize(parse(src)).value!;
  const b = normalize(parse(printAui(a))).value!;
  // Line numbers shift in the reprinted source; semantics must not.
  assert.deepStrictEqual(stripLines(a), stripLines(b));
});

function stripLines(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLines);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'line') continue;
      out[k] = stripLines(v);
    }
    return out;
  }
  return value;
}

test('printAui escapes quotes, backslashes, and newlines in strings', () => {
  const printed = roundTrip(`Page P
  Text "He said \\"hi\\" then \\\\ went"
  Text "line one\\nline two"`);
  assert.ok(printed.includes('"He said \\"hi\\" then \\\\ went"'));
  assert.ok(printed.includes('"line one\\nline two"'));
});

test('empty documents print to an empty string', () => {
  assert.strictEqual(printAui(normalize(parse('')).value!), '');
});
