import type { ComponentDef, Node } from '@codedia/parser';
import { interpolateText, resolvePath, stringifyResolved } from '@codedia/parser';
import { MOCK_DATA } from './mockData.ts';

/**
 * Pure binding resolution shared by the live preview and the render
 * regression tests. A resolver maps a `$path` (without the `$`) to a raw
 * value; `resolveValue` then interpolates that value into display text,
 * never emitting "[object Object]".
 */

export type Resolver = (path: string) => unknown;

export const lookup: Resolver = (path: string): unknown => resolvePath(MOCK_DATA, path);

/**
 * Render a prop value or text content: literal text stays as-is, `$bindings`
 * are resolved (including inside quoted strings like "Welcome back,
 * $user.name"). Unresolved or object-only values keep their `$path` visible.
 */
export function resolveValue(value: string | undefined, resolver: Resolver = lookup): string {
  if (value === undefined) return '';
  return interpolateText(value, (path) => stringifyResolved(resolver(path)));
}

/** Truthiness of a prop: `$bindings` resolve against data, literals are compared. */
export function resolveBool(value: string | undefined, resolver: Resolver = lookup): boolean {
  if (value === undefined) return false;
  if (value.startsWith('$')) {
    const resolved = resolver(value.slice(1));
    if (resolved === undefined || resolved === null) return false;
    const v = String(resolved).toLowerCase();
    if (v === 'false' || v === 'no' || v === '0' || v === '') return false;
    return true; // non-empty strings, numbers, objects are truthy
  }
  const v = value.toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

/**
 * Scope a resolver inside a `def` template usage: `$paramName` reads the
 * instance's prop (falling back to the def's default), and any other path
 * delegates to the outer resolver.
 */
export function defResolver(def: ComponentDef, instance: Node, base: Resolver): Resolver {
  return (path: string) => {
    const root = path.split('.')[0];
    if (def.params.includes(root)) {
      const inst = instance.props.find((p) => p.key === root)?.value;
      const defVal = def.defaultProps.find((p) => p.key === root)?.value;
      const raw = inst ?? defVal;
      if (raw === undefined) return undefined;
      if (raw.startsWith('$')) return base(raw.slice(1));
      return raw;
    }
    return base(path);
  };
}
