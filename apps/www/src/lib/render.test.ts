import test from 'node:test';
import assert from 'node:assert';
import { parse } from '@codedia/parser';
import type { ComponentDef, Document, Node } from '@codedia/parser';
import { resolvePath } from '@codedia/parser';
import { SAMPLES } from './samples.ts';
import { GALLERY } from './gallery.ts';
import { defResolver, lookup, resolveValue } from './resolve.ts';
import type { Resolver } from './resolve.ts';

/**
 * Regression guard for the live preview: every playground sample and gallery
 * scenario must render its displayed text without "[object Object]", without
 * the word "undefined", and without a `$binding` left unresolved.
 *
 * It walks each parsed document exactly the way AuiPreview does (def params
 * resolve from their instance, For loops put `$item` in scope) but uses the
 * pure `resolveValue` path instead of React, so it runs under node --test.
 */

/** Props the preview actually renders as text (vs. layout/token props). */
const DISPLAY_PROPS = new Set(['title', 'src', 'alt', 'name', 'label', 'value', 'placeholder', 'href']);

function renderedTextsFor(doc: Document): string[] {
  const out: string[] = [];
  const defs: Map<string, ComponentDef> = new Map((doc.components ?? []).map((d) => [d.name, d]));

  const walk = (node: Node, resolver: Resolver) => {
    const def = defs.get(node.type);
    if (def) {
      // A def usage renders its template body with params scoped from this
      // instance; the usage's own props are the arguments, not displayed text.
      for (const child of def.children) walk(child, defResolver(def, node, resolver));
      return;
    }

    if (node.textContent !== undefined) out.push(resolveValue(node.textContent, resolver));
    for (const p of node.props) {
      if (DISPLAY_PROPS.has(p.key)) out.push(resolveValue(p.value, resolver));
    }

    if (node.type === 'For') {
      const listBinding = node.props.find((p) => p.key === 'each' || p.key === 'in')?.value;
      const list = listBinding?.startsWith('$') ? resolver(listBinding.slice(1)) : undefined;
      const items = Array.isArray(list) ? list : [];
      for (const item of items) {
        const itemResolver: Resolver = (path) =>
          path.startsWith('item.') ? resolvePath(item, path.slice('item.'.length)) : resolver(path);
        for (const child of node.children) {
          if (child.type !== 'Else') walk(child, itemResolver);
        }
      }
      return;
    }

    for (const child of node.children) walk(child, resolver);
  };

  for (const root of doc.rootNodes) walk(root, lookup);
  return out;
}

function checkExamples(label: string, code: string): void {
  const doc = parse(code);
  const rendered = renderedTextsFor(doc);
  assert.ok(rendered.length > 0, `${label}: expected at least one rendered text`);
  for (const text of rendered) {
    assert.ok(!text.includes('[object Object]'), `${label}: rendered "[object Object]" in: "${text}"`);
    assert.ok(!text.includes('undefined'), `${label}: rendered "undefined" in: "${text}"`);
    assert.ok(!/\$[A-Za-z_]/.test(text), `${label}: unresolved binding in: "${text}"`);
  }
}

test('all playground samples render without [object Object] or unresolved bindings', () => {
  for (const s of SAMPLES) checkExamples(`sample "${s.label}"`, s.code);
});

test('all gallery scenarios render without [object Object] or unresolved bindings', () => {
  for (const g of GALLERY) checkExamples(`gallery "${g.title}"`, g.auiCode);
});

test('interpolated bindings inside quoted text resolve (progress + greeting)', () => {
  const project = { name: 'Website redesign', progress: '75%' };
  const resolve: Resolver = (path) =>
    path.startsWith('item.') ? resolvePath(project, path.slice('item.'.length)) : lookup(path);

  assert.strictEqual(resolveValue('Progress $item.progress', resolve), 'Progress 75%');
  assert.strictEqual(resolveValue('Welcome back, $user.name'), 'Welcome back, Grace Hopper');
});
