import type { BindingFrame, ComponentDef, Node, Value } from '@codedia/parser';
import { resolveBindingValue, stringifyResolved, tokenizeText } from '@codedia/parser';
import { MOCK_DATA } from './mockData.ts';

/**
 * Pure binding resolution shared by the live preview and the render
 * regression tests.
 *
 * The preview resolves the *canonical IR* (typed Values) against the same
 * scope model the compiler uses: def params, For `$item`/`$index`, and the
 * root data object. Values render through `stringifyResolved` — never
 * "[object Object]".
 */

/** A scope stack of binding frames (innermost last). */
export type Frames = BindingFrame[];

/** Root scope: the built-in mock data. */
export const ROOT_FRAMES: Frames = [{ kind: 'root' }];

/** Resolve a canonical Value to a raw value against the scope frames. */
export function resolveRaw(value: Value | undefined, frames: Frames): unknown {
  if (value === undefined) return undefined;
  switch (value.kind) {
    case 'string':
    case 'token':
      return value.value;
    case 'number':
      return value.value;
    case 'boolean':
      return value.value;
    case 'list':
      return value.value;
    case 'binding':
      return resolveBindingValue(value.path, frames, MOCK_DATA);
  }
}

/** Resolve a canonical Value to a display string (never `[object Object]`). */
export function resolveValue(value: Value | undefined, frames: Frames): string {
  const raw = resolveRaw(value, frames);
  return stringifyResolved(raw) ?? '';
}

/** Truthiness of a canonical Value. */
export function resolveBool(value: Value | undefined, frames: Frames): boolean {
  const raw = resolveRaw(value, frames);
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  const v = String(raw).toLowerCase();
  return !(v === 'false' || v === 'no' || v === '0' || v === '');
}

/**
 * Interpolate text content (which may contain `$bindings`) against frames.
 * Unresolved bindings keep their `$path` visible.
 */
export function resolveText(text: string | undefined, frames: Frames): string {
  if (text === undefined) return '';
  return tokenizeText(text)
    .map((seg) =>
      seg.kind === 'binding'
        ? stringifyResolved(resolveBindingValue(seg.value, frames, MOCK_DATA)) ?? '$' + seg.value
        : seg.value,
    )
    .join('');
}

/**
 * Build the frames for a `def` usage: each declared param resolves from the
 * instance's prop (falling back to the def's default), then delegates to the
 * outer frames for anything else.
 */
export function defFrames(def: ComponentDef, instance: Node, outer: Frames): Frames {
  const params: Record<string, unknown> = {};
  for (const p of def.params) {
    const inst = instance.kind === 'component' ? instance.props.find((pp) => pp.key === p.name)?.value : undefined;
    if (inst !== undefined) {
      params[p.name] = resolveRaw(inst, outer);
    } else if (p.defaultValue !== undefined) {
      params[p.name] = resolveRaw(p.defaultValue, outer);
    }
  }
  return [...outer, { kind: 'def', params }];
}
