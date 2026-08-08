/**
 * Text content helpers.
 *
 * .aui text can mix literal text with `$binding` references, both as a
 * standalone value (`Text $user.name`) and inside quoted strings
 * (`Text "Welcome back, $user.name"`). These functions tokenize that text,
 * resolve binding paths against a data object, and stringify resolved values
 * safely — the renderers must never emit "[object Object]".
 */

export interface TextSegment {
  kind: 'text' | 'binding';
  /** For `text`: literal characters. For `binding`: the path without the `$`. */
  value: string;
}

// A binding starts with a letter/underscore (so "$0" or "$129.00" stays
// literal text) and continues through dots into nested paths.
const BINDING_RE = /\$([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)/g;

/** Split text into literal and `$binding` segments. */
export function tokenizeText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = BINDING_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) });
    segments.push({ kind: 'binding', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

/** Resolve a dotted path (`user.name`) against a data object. */
export function resolvePath(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Render a resolved value as display text. Arrays of primitives join with
 * commas; arrays of objects render their length; objects fall back to a
 * `name`/`label` field. Returns null when there is no friendly string — the
 * caller keeps the raw `$path` visible in that case.
 */
export function stringifyResolved(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '0';
    if (value.every((v) => typeof v !== 'object' || v === null)) return value.join(', ');
    return String(value.length);
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.name === 'string') return rec.name;
    if (typeof rec.label === 'string') return rec.label;
  }
  return null;
}

/**
 * Interpolate `$bindings` inside text. `resolve` returns the display string
 * for a binding path, or null to keep the `$path` literal (unresolved, or a
 * value with no friendly string).
 */
export function interpolateText(text: string, resolve: (path: string) => string | null): string {
  return tokenizeText(text)
    .map((seg) => (seg.kind === 'binding' ? resolve(seg.value) ?? '$' + seg.value : seg.value))
    .join('');
}
