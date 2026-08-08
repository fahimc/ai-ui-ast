import test from 'node:test';
import assert from 'node:assert';
import { tokenize } from './lexer.ts';
import { parse } from './parser.ts';

test('tokenize extracts basic nodes and props', () => {
  const input = `Card pad=lg
  Stack gap=md`;

  const tokens = tokenize(input);
  assert.strictEqual(tokens.length, 2);

  assert.strictEqual(tokens[0].type, 'Card');
  assert.strictEqual(tokens[0].props[0].key, 'pad');
  assert.strictEqual(tokens[0].props[0].value, 'lg');
  assert.strictEqual(tokens[0].indent, 0);

  assert.strictEqual(tokens[1].type, 'Stack');
  assert.strictEqual(tokens[1].props[0].key, 'gap');
  assert.strictEqual(tokens[1].props[0].value, 'md');
  assert.strictEqual(tokens[1].indent, 2);
});

test('tokenize strips quotes from prop values and keeps inner spaces', () => {
  const input = `Input placeholder="you@example.com" value=$form.email`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].props[0].value, 'you@example.com');
  assert.strictEqual(tokens[0].props[1].value, '$form.email');
});

test('tokenize keeps multi-word quoted prop values as one word', () => {
  const input = `StatCard label="Active users" value=$metrics.active`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].type, 'StatCard');
  assert.strictEqual(tokens[0].props[0].key, 'label');
  assert.strictEqual(tokens[0].props[0].value, 'Active users');
  assert.strictEqual(tokens[0].props[1].value, '$metrics.active');
});

test('tokenize treats a trailing bare binding as text content', () => {
  const input = `Heading level=1 $customer.name`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens[0].textContent, '$customer.name');
  assert.deepStrictEqual(tokens[0].props, [{ key: 'level', value: '1' }]);
});

test('tokenize captures a bare page label', () => {
  const input = `Page CustomerDetail data=$customer`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens[0].type, 'Page');
  assert.strictEqual(tokens[0].label, 'CustomerDetail');
  assert.deepStrictEqual(tokens[0].props, [{ key: 'data', value: '$customer' }]);
});

test('tokenize keeps quoted text content with spaces', () => {
  const input = `Text tone=muted "Continue where you left off."`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens[0].textContent, 'Continue where you left off.');
  assert.deepStrictEqual(tokens[0].props, [{ key: 'tone', value: 'muted' }]);
});

test('parse builds nested AST document', () => {
  const input = `Card pad=lg
  Stack gap=md
    Heading level=2 "Title"`;

  const doc = parse(input);
  assert.strictEqual(doc.rootNodes.length, 1);

  const root = doc.rootNodes[0];
  assert.strictEqual(root.type, 'Card');
  assert.strictEqual(root.children.length, 1);

  const stack = root.children[0];
  assert.strictEqual(stack.type, 'Stack');
  assert.strictEqual(stack.children.length, 1);

  const heading = stack.children[0];
  assert.strictEqual(heading.type, 'Heading');
  assert.strictEqual(heading.textContent, 'Title');
  assert.strictEqual(heading.children.length, 0);
});

test('parse collects named and default imports', () => {
  const input = `import { AreaChart, XAxis } from "recharts"
import Default from "some-pkg"
Page P`;

  const doc = parse(input);
  assert.strictEqual(doc.imports!.length, 2);
  assert.deepStrictEqual(doc.imports![0].names, ['AreaChart', 'XAxis']);
  assert.strictEqual(doc.imports![0].source, 'recharts');
  assert.strictEqual(doc.imports![1].defaultName, 'Default');
  assert.strictEqual(doc.rootNodes.length, 1);
  assert.strictEqual(doc.rootNodes[0].type, 'Page');
});

test('parse collects component defs with params and defaults', () => {
  const input = `def StatCard label value tone=success
  Card pad=lg
    Metric label=$label value=$value

def EmptyState icon
  Stack gap=sm
    Icon name=$icon
    Heading level=3 $message

Page P`;

  const doc = parse(input);
  assert.strictEqual(doc.components!.length, 2);

  const stat = doc.components![0];
  assert.strictEqual(stat.name, 'StatCard');
  assert.deepStrictEqual(stat.params, ['label', 'value']);
  assert.deepStrictEqual(stat.defaultProps, [{ key: 'tone', value: 'success' }]);
  assert.strictEqual(stat.children[0].type, 'Card');
  assert.strictEqual(stat.children[0].children[0].type, 'Metric');

  const empty = doc.components![1];
  assert.deepStrictEqual(empty.params, ['icon']);
  assert.strictEqual(empty.children[0].children[0].props[0].value, '$icon');

  assert.strictEqual(doc.rootNodes.length, 1);
});

test('parse keeps Else nodes inside their parent', () => {
  const input = `If condition=$loading
  Spinner
Else
  Card pad=lg
    Heading level=2 "Loaded"`;

  const doc = parse(input);
  const root = doc.rootNodes[0];
  assert.strictEqual(root.type, 'If');
  assert.strictEqual(root.children.length, 2);
  assert.strictEqual(root.children[0].type, 'Spinner');
  assert.strictEqual(root.children[1].type, 'Else');
  assert.strictEqual(root.children[1].children[0].type, 'Card');
});
