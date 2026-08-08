import test from 'node:test';
import assert from 'node:assert';
import { scan, stripComment, tokenize } from './lexer.ts';

test('tokenize extracts basic nodes and props with typed raw values', () => {
  const input = `Card pad=lg
  Stack gap=md`;
  const tokens = tokenize(input);
  assert.strictEqual(tokens.length, 2);
  assert.strictEqual(tokens[0].type, 'Card');
  assert.deepStrictEqual(tokens[0].props, [{ key: 'pad', value: { kind: 'bare', value: 'lg' } }]);
  assert.strictEqual(tokens[0].indent, 0);
  assert.strictEqual(tokens[1].type, 'Stack');
  assert.strictEqual(tokens[1].indent, 2);
});

test('values are classified: string, binding, number, boolean, bare', () => {
  const input = 'Input placeholder="you@example.com" value=$form.email level=2 round=true variant=primary';
  const tokens = tokenize(input);
  const props = tokens[0].props;
  assert.deepStrictEqual(props[0], { key: 'placeholder', value: { kind: 'string', value: 'you@example.com' } });
  assert.deepStrictEqual(props[1], { key: 'value', value: { kind: 'binding', path: 'form.email' } });
  assert.deepStrictEqual(props[2], { key: 'level', value: { kind: 'number', value: 2 } });
  assert.deepStrictEqual(props[3], { key: 'round', value: { kind: 'boolean', value: true } });
  assert.deepStrictEqual(props[4], { key: 'variant', value: { kind: 'bare', value: 'primary' } });
});

test('quoted strings starting with $ are strings, unquoted $ are bindings', () => {
  const a = tokenize('Text value="$user.name"')[0];
  assert.deepStrictEqual(a.props[0].value, { kind: 'string', value: '$user.name' });
  const b = tokenize('Text value=$user.name')[0];
  assert.deepStrictEqual(b.props[0].value, { kind: 'binding', path: 'user.name' });
});

test('negative and decimal numbers parse as numbers', () => {
  const t = tokenize('Grid min=-280')[0];
  assert.deepStrictEqual(t.props[0].value, { kind: 'number', value: -280 });
  const t2 = tokenize('Heading level=2.5')[0];
  assert.deepStrictEqual(t2.props[0].value, { kind: 'number', value: 2.5 });
});

test('stripComment removes # only outside quoted strings', () => {
  assert.deepStrictEqual(stripComment('Heading "Dashboard" # title'), { text: 'Heading "Dashboard" ', unterminated: false });
  assert.deepStrictEqual(stripComment('Area stroke="#a78bfa" # hex must stay inside the string'), {
    text: 'Area stroke="#a78bfa" ',
    unterminated: false,
  });
  assert.deepStrictEqual(stripComment('# full line comment'), { text: '', unterminated: false });
  assert.deepStrictEqual(stripComment('Text "has \\" quote # inside" trailing # comment'), {
    text: 'Text "has \\" quote # inside" trailing ',
    unterminated: false,
  });
});

test('comments after imports, bindings, and text are stripped', () => {
  const src = `import { A } from "pkg" # comment
Page P # comment
  Text $user.name # trailing binding comment
  Text "Hello # not a comment" # real comment`;
  const tokens = tokenize(src);
  assert.strictEqual(tokens[0].importDecl?.names[0], 'A');
  assert.strictEqual(tokens[1].type, 'Page');
  assert.strictEqual(tokens[2].textContent, '$user.name');
  assert.strictEqual(tokens[3].textContent, 'Hello # not a comment');
});

test('unterminated strings produce a diagnostic via scan', () => {
  const { diagnostics } = scan('Text "oops');
  assert.strictEqual(diagnostics.length, 1);
  assert.strictEqual(diagnostics[0].code, 'AUI_UNTERMINATED_STRING');
});

test('indentation metadata records tabs', () => {
  const tokens = tokenize('\tCard\n  Stack');
  assert.strictEqual(tokens[0].indentHasTab, true);
  assert.strictEqual(tokens[1].indentHasTab, false);
});

test('import aliases and namespace imports are rejected with diagnostics', () => {
  const { tokens, diagnostics } = scan('import { A as B } from "pkg"\nimport * as NS from "pkg2"');
  assert.strictEqual(diagnostics.length, 2);
  assert.ok(diagnostics.every((d) => d.code === 'AUI_IMPORT_GRAMMAR_UNSUPPORTED'));
  assert.strictEqual(tokens[0].type, 'import');
});

test('side-effect imports parse with sideEffect flag', () => {
  const { tokens } = scan('import "polyfill"');
  assert.deepStrictEqual(tokens[0].importDecl, { names: [], source: 'polyfill', sideEffect: true });
});

test('def lines carry one unified param model', () => {
  const t = tokenize('def StatCard label value tone=default')[0];
  assert.deepStrictEqual(t.params, [
    { name: 'label', required: true },
    { name: 'value', required: true },
    { name: 'tone', defaultValue: { kind: 'bare', value: 'default' }, required: false },
  ]);
  assert.deepStrictEqual(t.props, []);
});
