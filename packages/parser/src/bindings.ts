/**
 * Binding paths and the scope model shared by the React compiler and the
 * website preview.
 *
 * `.aui` bindings are data references, never an expression language. A path
 * is a dotted sequence of identifiers (`user.name`, `item.progress`). The
 * lexical scope rules (documented in docs/grammar.md) are:
 *
 *   - `$root.path`   — absolute access to the root data object.
 *   - `$param`       — a `def` template parameter, when inside a def body.
 *   - `$item`/`$index` — the current element / index inside a `For` loop.
 *   - `$path`        — resolved against the root `data` object.
 *
 * `Page data=$context` names the data context passed to the page; bindings
 * still resolve against the root data object (see docs/grammar.md for the
 * rationale). `$root.` exists so authors can be explicit about absolute
 * access and so host data can never be shadowed.
 *
 * Both the compiler (which emits TSX expressions) and the preview (which
 * resolves values at runtime) implement exactly these rules.
 */

export const BINDING_PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/** Path segments that must never be traversed (prototype-pollution guards). */
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/** True when a binding path is syntactically valid (`user.name`, …). */
export function isValidBindingPath(path: string): boolean {
  return BINDING_PATH_RE.test(path);
}

/** True when a path contains dangerous/forbidden segments. */
export function isDangerousBindingPath(path: string): boolean {
  return path.split('.').some((seg) => DANGEROUS_SEGMENTS.has(seg));
}

/** Return the dangerous segment, or null when the path is safe. */
export function dangerousSegment(path: string): string | null {
  for (const seg of path.split('.')) {
    if (DANGEROUS_SEGMENTS.has(seg)) return seg;
  }
  return null;
}

/**
 * Scope frames used by the preview resolver, innermost last.
 *
 *   - `{ kind: 'root' }` — the root data object.
 *   - `{ kind: 'def', params: Record<string, unknown> }` — resolved def params.
 *   - `{ kind: 'for', item: unknown, index: number }` — loop iteration.
 *
 * A `Page data=` context does not create a new resolution frame: bindings
 * resolve against root (see the module docstring).
 */
export type BindingFrame = { kind: 'root' } | { kind: 'def'; params: Record<string, unknown> } | { kind: 'for'; item: unknown; index: number };

/**
 * Resolve a binding path (without the `$`) against a scope stack. Returns
 * the raw value, or `undefined` when nothing resolves.
 */
export function resolveBindingValue(path: string, frames: BindingFrame[], rootData: unknown): unknown {
  // Absolute root access: `$root.user.name` → `data.user.name`.
  if (path.startsWith('root.')) {
    return resolvePathSafe(rootData, path.slice('root.'.length));
  }
  if (path === 'root') return rootData;

  const root = path.split('.')[0];

  // Innermost def frames first: a param shadows outer frames.
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    if (frame.kind === 'def' && root in frame.params) {
      const v = frame.params[root];
      return path === root ? v : resolvePathSafe(v, path.slice(root.length + 1));
    }
    if (frame.kind === 'for') {
      if (root === 'item') {
        return path === 'item' ? frame.item : resolvePathSafe(frame.item, path.slice('item.'.length));
      }
      if (root === 'index') return frame.index;
    }
  }

  return resolvePathSafe(rootData, path);
}

/**
 * Own-property-only path walk (never traverses inherited members). The one
 * intentional exception is `length` on arrays — a safe, well-known accessor
 * (`$items.length` → 3) that lives on Array.prototype.
 */
export function resolvePathSafe(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (Array.isArray(cur) && part === 'length') {
      cur = cur.length;
    } else if (cur !== null && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Shared by the compiler: a `$path` binding → the TSX expression to emit. */
export function bindingToTsxExpression(path: string, opts: { defParams: Set<string> }): string {
  if (path.startsWith('root.')) return `data.${path.slice('root.'.length)}`;
  if (path === 'root') return 'data';
  const root = path.split('.')[0];
  if (opts.defParams.has(root)) return path;
  if (root === 'item') return path;
  if (root === 'index') return 'i' + path.slice('index'.length);
  return `data.${path}`;
}
