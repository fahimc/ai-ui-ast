import test from 'node:test';
import assert from 'node:assert';
import { compile } from '@codedia/parser';
import type { CanonicalDocument, ComponentDef, Node, Value } from '@codedia/parser';
import { SAMPLES } from './samples.ts';
import { GALLERY } from './gallery.ts';
import { WWW_REGISTRY } from './registry.ts';
import { defFrames, resolveRaw, resolveText, resolveValue } from './resolve.ts';
import type { Frames } from './resolve.ts';
import { ROOT_FRAMES } from './resolve.ts';

/**
 * Regression guard for the live preview: every playground sample and gallery
 * scenario must render its displayed text without "[object Object]", without
 * the word "undefined", and without a `$binding` left unresolved.
 *
 * It walks each document's *canonical IR* — the same normalized tree the
 * preview renders — with the same scope frames (def params, For item/index,
 * root data), so preview parity is structural, not coincidental.
 */

const DISPLAY_PROPS = new Set(['title', 'src', 'alt', 'name', 'label', 'value', 'placeholder', 'href']);

function renderedTextsFor(doc: CanonicalDocument): string[] {
  const out: string[] = [];
  const defs: Map<string, ComponentDef> = new Map((doc.components ?? []).map((d) => [d.name, d]));

  const walk = (node: Node, frames: Frames) => {
    if (node.kind === 'if') {
      for (const child of node.then) walk(child, frames);
      if (node.else) for (const child of node.else) walk(child, frames);
      return;
    }
    if (node.kind === 'for') {
      const list = resolveRaw(node.each, frames);
      const items = Array.isArray(list) ? list : [];
      for (let i = 0; i < items.length; i++) {
        const itemFrames: Frames = [...frames, { kind: 'for', item: items[i], index: i }];
        for (const child of node.body) walk(child, itemFrames);
      }
      return;
    }
    // ComponentNode.
    const def = defs.get(node.type);
    if (def) {
      for (const child of def.children) walk(child, defFrames(def, node, frames));
      return;
    }
    if (node.textContent !== undefined) out.push(resolveText(node.textContent, frames));
    for (const prop of node.props) {
      if (DISPLAY_PROPS.has(prop.key)) out.push(resolveValue(prop.value as Value, frames));
    }
    for (const child of node.children) walk(child, frames);
  };

  for (const root of doc.rootNodes) walk(root, ROOT_FRAMES);
  return out;
}

function checkExamples(label: string, code: string): void {
  const result = compile(code, { registry: WWW_REGISTRY });
  assert.ok(result.ast, `${label}: expected a canonical AST (${result.diagnostics.map((d) => d.code).join(', ')})`);
  const rendered = renderedTextsFor(result.ast!);
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
  const frames: Frames = [...ROOT_FRAMES, { kind: 'for', item: project, index: 0 }];
  assert.strictEqual(resolveText('Progress $item.progress', frames), 'Progress 75%');
  assert.strictEqual(resolveText('Welcome back, $user.name', ROOT_FRAMES), 'Welcome back, Grace Hopper');
});
