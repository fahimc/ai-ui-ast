import test from 'node:test';
import assert from 'node:assert';
import { parse } from './parser.ts';

test('parse builds a nested raw AST with line numbers', () => {
  const input = `Card pad=lg
  Stack gap=md
    Heading level=2 "Title"`;
  const doc = parse(input);
  assert.strictEqual(doc.rootNodes.length, 1);
  const root = doc.rootNodes[0];
  assert.strictEqual(root.type, 'Card');
  assert.strictEqual(root.line, 1);
  assert.strictEqual(root.props[0].value.kind, 'bare');
  const stack = root.children[0];
  assert.strictEqual(stack.type, 'Stack');
  assert.strictEqual(stack.line, 2);
  const heading = stack.children[0];
  assert.strictEqual(heading.type, 'Heading');
  assert.strictEqual(heading.textContent, 'Title');
  assert.deepStrictEqual(heading.props[0].value, { kind: 'number', value: 2 });
});

test('parse collects imports, defs, and root nodes', () => {
  const input = `import { AreaChart, XAxis } from "recharts"
def StatCard label value tone=success
  Card pad=lg
    Metric label=$label value=$value
Page P`;
  const doc = parse(input);
  assert.deepStrictEqual(doc.imports![0].names, ['AreaChart', 'XAxis']);
  const stat = doc.components![0];
  assert.strictEqual(stat.name, 'StatCard');
  assert.deepStrictEqual(
    stat.params.map((p) => ({ name: p.name, required: p.required, def: p.defaultValue?.kind })),
    [
      { name: 'label', required: true, def: undefined },
      { name: 'value', required: true, def: undefined },
      { name: 'tone', required: false, def: 'bare' },
    ],
  );
  assert.strictEqual(stat.children[0].type, 'Card');
  assert.strictEqual(doc.rootNodes[0].type, 'Page');
  assert.strictEqual(doc.rootNodes[0].label, 'P');
});

test('parse keeps Else nodes inside their parent If', () => {
  const doc = parse(`If condition=$loading
  Spinner
Else
  Card pad=lg
    Heading level=2 "Loaded"`);
  const root = doc.rootNodes[0];
  assert.strictEqual(root.type, 'If');
  assert.strictEqual(root.children.length, 2);
  assert.strictEqual(root.children[1].type, 'Else');
  assert.strictEqual(root.children[1].children[0].type, 'Card');
});

test('parse records a trailing bare binding as textContent', () => {
  const doc = parse(`Heading level=1 $customer.name`);
  assert.strictEqual(doc.rootNodes[0].textContent, '$customer.name');
  assert.deepStrictEqual(doc.rootNodes[0].props[0].value, { kind: 'number', value: 1 });
});

test('parse handles quoted multi-word text content', () => {
  const doc = parse(`Text tone=muted "Continue where you left off."`);
  assert.strictEqual(doc.rootNodes[0].textContent, 'Continue where you left off.');
});

test('empty documents parse to empty trees', () => {
  const doc = parse('');
  assert.deepStrictEqual(doc.rootNodes, []);
  assert.deepStrictEqual(doc.imports, []);
  assert.deepStrictEqual(doc.components, []);
});

test('unicode and emoji survive in quoted text and comments', () => {
  const doc = parse(`Text "Grüße 👋 — déjà vu" # 中文 comment 👍
  Heading level=2 "🚀"`);
  assert.strictEqual(doc.rootNodes[0].textContent, 'Grüße 👋 — déjà vu');
  assert.strictEqual(doc.rootNodes[0].children[0].textContent, '🚀');
  assert.strictEqual(doc.rootNodes[0].children[0].props[0].value.kind, 'number');
});
