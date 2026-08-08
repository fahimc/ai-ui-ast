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
