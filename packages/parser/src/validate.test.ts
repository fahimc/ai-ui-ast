import test from 'node:test';
import assert from 'node:assert';
import { validate } from './validate.ts';
import { CORE_REGISTRY, defineRegistry, extendRegistry } from './registry.ts';

const codes = (src: string, opts?: Parameters<typeof validate>[1]) => validate(src, opts).map((d) => d.code);

test('valid source produces no diagnostics', () => {
  const src = `Page Dashboard data=$user
  Stack gap=md
    Heading level=2 "Welcome"
    Button variant=primary action=go "Go"`;
  assert.deepStrictEqual(validate(src), []);
});

test('unknown node is an error', () => {
  const diags = validate('Page P\n  FooBar');
  assert.ok(diags.some((d) => d.code === 'AUI_UNKNOWN_NODE' && d.severity === 'error' && d.line === 2));
});

test('unknown prop and invalid token are repairable diagnostics', () => {
  const diags = validate('Page P\n  Button variant=purple size=huge');
  assert.ok(diags.some((d) => d.code === 'AUI_INVALID_TOKEN' && /variant=purple/.test(d.message) && /primary, secondary, ghost, danger/.test(d.message)));
  assert.ok(diags.some((d) => d.code === 'AUI_INVALID_TOKEN' && /size=huge/.test(d.message)));
});

test('duplicate props are flagged', () => {
  assert.ok(codes('Page P\n  Card pad=lg pad=xl').includes('AUI_DUPLICATE_PROP'));
});

test('orphan Else and duplicate Else are errors', () => {
  assert.ok(codes('Page P\nElse').includes('AUI_ORPHAN_ELSE'));
  assert.ok(codes('Page P\n  If condition=$a\n    Text "x"\n  Else\n    Text "y"\n  Else\n    Text "z"').includes('AUI_DUPLICATE_ELSE'));
});

test('For without a list binding is an error', () => {
  assert.ok(codes('Page P\n  For\n    Text "x"').includes('AUI_FOR_MISSING_LIST'));
  assert.ok(codes('Page P\n  For each=$items\n    Text $item.name').length === 0);
});

test('multiple Page roots are flagged', () => {
  assert.ok(codes('Page A\nPage B').includes('AUI_MULTIPLE_PAGE_ROOTS'));
});

test('State is reserved and reported', () => {
  const diags = validate('Page P\n  State name=count initial=0');
  assert.ok(diags.some((d) => d.code === 'AUI_STATE_RESERVED'));
});

test('missing required def params and unknown params are diagnostics', () => {
  const src = `def StatCard label value tone=default
  Card
    Text $label
Page P
  StatCard label="x" nope=1`;
  const diags = validate(src);
  assert.ok(diags.some((d) => d.code === 'AUI_MISSING_REQUIRED_PARAM' && /value/.test(d.message)));
  assert.ok(diags.some((d) => d.code === 'AUI_UNKNOWN_PARAM' && /nope/.test(d.message)));
});

test('duplicate defs and duplicate params are errors', () => {
  assert.ok(codes('def Card\n  Text "x"\ndef Card\n  Text "y"\nPage P').includes('AUI_DUPLICATE_DEF'));
  assert.ok(codes('def A x x\n  Text $x\nPage P').includes('AUI_DUPLICATE_PARAM'));
});

test('def shadowing a core node is a warning', () => {
  const diags = validate('def Card\n  Text "x"\nPage P\n  Card');
  assert.ok(diags.some((d) => d.code === 'AUI_COLLISION' && d.severity === 'warning'));
});

test('invalid identifiers are flagged', () => {
  assert.ok(codes('Page P\n  My-Node').includes('AUI_INVALID_IDENTIFIER'));
  assert.ok(codes('def 1bad\n  Text "x"\nPage P').includes('AUI_INVALID_IDENTIFIER'));
});

test('binding path safety: dangerous segments are rejected', () => {
  const diags = validate('Page P\n  Text $user.__proto__.x');
  assert.ok(diags.some((d) => d.code === 'AUI_BINDING_DANGEROUS'));
  assert.ok(validate('Page P\n  Text $user.name').length === 0);
});

test('strict indentation: tabs are errors, jumps are errors', () => {
  assert.ok(codes('Page P\n\tCard').includes('AUI_INDENT_MIXED_TABS_SPACES'));
  assert.ok(codes('Page P\n    Card').includes('AUI_INDENT_INCONSISTENT')); // 4 spaces = 2 levels
});

test('llm indentation mode infers and warns instead of erroring', () => {
  const diags = validate('Page P\n    Card', { indentMode: 'llm' });
  assert.ok(diags.some((d) => d.code === 'AUI_INDENT_INCONSISTENT' && d.severity === 'warning'));
});

test('root nodes must start at column 0', () => {
  assert.ok(codes('  Page P').includes('AUI_INDENT_INCONSISTENT'));
});

test('imports are registry-only by default; allowlists and unsafe mode work', () => {
  assert.ok(codes('import { AreaChart } from "recharts"\nPage P').includes('AUI_COLLISION'));
  assert.ok(codes('import { AreaChart } from "recharts"\nPage P', { imports: { mode: 'explicit', allow: ['recharts'] } }).length === 0);
  assert.ok(codes('import { AreaChart } from "recharts"\nPage P', { imports: { unsafeImports: true } }).length === 0);
  assert.ok(codes('import { AreaChart } from "recharts"\nPage P', { imports: { mode: 'explicit', allow: ['other'] } }).includes('AUI_COLLISION'));
});

test('side-effect imports follow the same policy', () => {
  assert.ok(codes('import "polyfill"\nPage P').includes('AUI_COLLISION'));
  assert.ok(codes('import "polyfill"\nPage P', { imports: { mode: 'explicit', allow: ['polyfill'] } }).length === 0);
});

test('resource limits produce diagnostics instead of runaway recursion', () => {
  const deep = 'Page P\n' + Array.from({ length: 120 }, (_, i) => '  '.repeat(i + 1) + 'Stack').join('\n');
  assert.ok(codes(deep).includes('AUI_TOO_DEEP'));
  assert.ok(codes('Page P\n  Card pad=lg\n'.repeat(300), { limits: { maxNodes: 10 } }).includes('AUI_TOO_MANY_NODES'));
  assert.ok(codes('Page P\n  Card ' + Array.from({ length: 40 }, (_, i) => `p${i}=x`).join(' '), { limits: { maxPropsPerNode: 10 } }).includes('AUI_TOO_MANY_PROPS'));
});

test('registry-driven components validate against the registry', () => {
  const reg = extendRegistry(CORE_REGISTRY, {
    AreaChart: {
      imports: { source: '@acme/charts', export: 'AreaChart' },
      props: { data: { type: 'binding' }, height: { type: 'number' } },
      children: 'nodes',
    },
    Area: { imports: { source: '@acme/charts', export: 'Area' }, props: {}, children: 'none' },
  });
  const ok = validate('Page P\n  AreaChart data=$series height=280\n    Area dataKey="revenue"', { registry: reg });
  assert.deepStrictEqual(ok.filter((d) => d.severity === 'error'), []);
});

test('child constraints are enforced', () => {
  assert.ok(codes('Page P\n  Divider\n    Text "nested"').includes('AUI_CHILD_CONSTRAINT'));
  assert.ok(codes('Page P\n  Heading level=2\n    Text "child"').includes('AUI_CHILD_CONSTRAINT'));
});

test('numeric and boolean prop types are validated', () => {
  const diags = validate('Page P\n  Heading level=abc');
  assert.ok(diags.some((d) => d.code === 'AUI_INVALID_PROP_TYPE' && /level/.test(d.message)));
});
