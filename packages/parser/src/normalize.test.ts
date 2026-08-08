import test from 'node:test';
import assert from 'node:assert';
import { normalize } from './normalize.ts';
import { parse } from './parser.ts';

const canon = (src: string) => {
  const result = normalize(parse(src));
  assert.ok(result.ok, `normalize failed: ${JSON.stringify(result.diagnostics)}`);
  return result.value!;
};

test('bare values normalize to tokens/strings via the registry', () => {
  const doc = canon(`Page P
  Button variant=primary size=lg disabled=true
  Text tone=muted "Hello"`);
  const button = doc.rootNodes[0].children[0] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.deepStrictEqual(button.props.find((p) => p.key === 'variant')?.value, { kind: 'token', value: 'primary' });
  assert.deepStrictEqual(button.props.find((p) => p.key === 'disabled')?.value, { kind: 'boolean', value: true });
  const text = doc.rootNodes[0].children[1] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.deepStrictEqual(text.props.find((p) => p.key === 'tone')?.value, { kind: 'token', value: 'muted' });
});

test('strings, bindings, and numbers pass through typed', () => {
  const doc = canon(`Page P
  Metric label="Active users" value=$metrics.active
  Grid min=280 gap=md`);
  const metric = doc.rootNodes[0].children[0] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.deepStrictEqual(metric.props.find((p) => p.key === 'label')?.value, { kind: 'string', value: 'Active users' });
  assert.deepStrictEqual(metric.props.find((p) => p.key === 'value')?.value, { kind: 'binding', path: 'metrics.active' });
  const grid = doc.rootNodes[0].children[1] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.deepStrictEqual(grid.props.find((p) => p.key === 'min')?.value, { kind: 'number', value: 280 });
});

test('quoted $ strings stay strings; unquoted become bindings', () => {
  const doc = canon(`Page P
  Text value="$user.name"
  Text value=$user.name`);
  const [a, b] = doc.rootNodes[0].children as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>[];
  assert.deepStrictEqual(a.props[0].value, { kind: 'string', value: '$user.name' });
  assert.deepStrictEqual(b.props[0].value, { kind: 'binding', path: 'user.name' });
});

test('list props split on commas', () => {
  const doc = canon(`Page P
  Select value=$plan options="Free,Pro,Team"`);
  const select = doc.rootNodes[0].children[0] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.deepStrictEqual(select.props.find((p) => p.key === 'options')?.value, { kind: 'list', value: ['Free', 'Pro', 'Team'] });
});

test('If/Else becomes an explicit IfNode with then/else', () => {
  const doc = canon(`If condition=$user.admin
  Badge tone=success "Admin"
Else
  Badge tone=muted "Member"`);
  const ifNode = doc.rootNodes[0];
  assert.strictEqual(ifNode.kind, 'if');
  assert.deepStrictEqual(ifNode.condition, { kind: 'binding', path: 'user.admin' });
  assert.strictEqual(ifNode.then.length, 1);
  assert.strictEqual(ifNode.else!.length, 1);
});

test('For becomes a ForNode with body and each binding', () => {
  const doc = canon(`For each=$items
  Row
    Text $item.name`);
  const forNode = doc.rootNodes[0];
  assert.strictEqual(forNode.kind, 'for');
  assert.deepStrictEqual(forNode.each, { kind: 'binding', path: 'items' });
  assert.strictEqual(forNode.body.length, 1);
});

test('def params carry typed defaults in one model', () => {
  const doc = canon(`def StatCard label value tone=default count=2
  Card
    Text $label
Page P
  StatCard label="x" value=$v`);
  const def = doc.components![0];
  assert.deepStrictEqual(
    def.params.map((p) => ({ name: p.name, required: p.required, def: p.defaultValue })),
    [
      { name: 'label', required: true, def: undefined },
      { name: 'value', required: true, def: undefined },
      { name: 'tone', required: false, def: { kind: 'string', value: 'default' } },
      { name: 'count', required: false, def: { kind: 'number', value: 2 } },
    ],
  );
});

test('Page label is preserved on the canonical node', () => {
  const doc = canon('Page CustomerDetail data=$customer');
  const page = doc.rootNodes[0] as Extract<(typeof doc.rootNodes)[0], { kind: 'component' }>;
  assert.strictEqual(page.label, 'CustomerDetail');
});
