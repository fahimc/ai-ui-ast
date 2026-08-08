/**
 * Component registry for @codedia/parser v0.2.
 *
 * The registry is the host-owned contract that constrains the language:
 * which nodes exist, which props they accept, how prop values are typed,
 * which token enums are legal, what children are allowed, and (for
 * third-party components) which package export supplies the node. Strict
 * compilation derives every import from the registry — models never invent
 * package specifiers.
 *
 * A default core registry is exported; the website and host apps may extend
 * it with their own components (and preview-specific rendering metadata),
 * but language validation never depends on apps/www.
 */

export type PropType = 'token' | 'string' | 'binding' | 'number' | 'boolean' | 'list';

export interface PropSpec {
  type: PropType;
  /** Legal values when `type: 'token'`. */
  tokens?: string[];
  required?: boolean;
  description?: string;
}

/**
 * Semantic event mapping. `.aui` uses framework-neutral names (`change=`)
 * and the registry owns the target-specific extraction:
 * `change: { target: 'onChange', payload: 'target.value' }` compiles to
 * `onChange={(e) => onAction('emailChanged', e.target.value)}`.
 */
export interface EventSpec {
  /** Target prop name, e.g. `onChange`. */
  target: string;
  /** Expression path on the event object, e.g. `target.value` / `target.checked`. */
  payload?: string;
}

/** How a registry node maps to a target import. */
export interface ImportMapping {
  source: string;
  export: string;
}

export interface NodeDefinition {
  category?: string;
  description?: string;
  props: Record<string, PropSpec>;
  /**
   * Child constraint: `'none'` (no children), `'text'` (text content only,
   * no element children), `'nodes'` (element children), or `'any'`.
   * Defaults to `'nodes'`.
   */
  children?: 'none' | 'text' | 'nodes' | 'any';
  /** Semantic event props (e.g. `change=`) and their target mapping. */
  events?: Record<string, EventSpec>;
  /**
   * Registry-owned third-party mapping. When present, using this node
   * imports `{ export } from "source"` — no `import` line needed in `.aui`.
   * Nodes without an explicit mapping import from the core adapter alias.
   */
  imports?: ImportMapping;
}

export type Registry = Record<string, NodeDefinition>;

/** Build a registry object. Typed for convenience; plain objects work too. */
export function defineRegistry(defs: Registry): Registry {
  return defs;
}

export const GAP_TOKENS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
export const PAD_TOKENS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
export const TONE_TOKENS = ['default', 'muted', 'info', 'success', 'warning', 'error'];
export const VARIANT_TOKENS = ['primary', 'secondary', 'ghost', 'danger'];
export const ALIGN_TOKENS = ['start', 'center', 'end', 'stretch'];
export const JUSTIFY_TOKENS = ['start', 'center', 'end', 'between', 'around', 'evenly'];

/** Default adapter alias emitted for core nodes (your design-system mapping). */
export const CORE_IMPORT_SOURCE = '@/components/ui';

const p = (type: PropType, extra?: Partial<PropSpec>): PropSpec => ({ type, ...extra });

/**
 * The default/core registry shipped with the package. It is intentionally
 * small and design-system-neutral: host apps extend it (or replace it) with
 * their own design system and third-party components.
 */
export const CORE_REGISTRY: Registry = {
  // ── Structure ──────────────────────────────────────────────────────────
  Page: {
    category: 'Structure',
    description: 'The root element of a view. Owns the page chrome and optional data context.',
    props: { data: p('binding', { description: 'Data context for the whole page, e.g. data=$customer' }) },
    children: 'any',
  },
  Header: {
    category: 'Structure',
    description: 'A page header band for titles, avatars, and identity rows.',
    props: {},
    children: 'nodes',
  },
  Stack: {
    category: 'Structure',
    description: 'A vertical flex layout container.',
    props: {
      gap: p('token', { tokens: GAP_TOKENS, description: 'Space between children.' }),
      align: p('token', { tokens: ALIGN_TOKENS, description: 'Cross-axis alignment.' }),
    },
    children: 'nodes',
  },
  Row: {
    category: 'Structure',
    description: 'A horizontal flex layout container.',
    props: {
      gap: p('token', { tokens: GAP_TOKENS, description: 'Space between children.' }),
      align: p('token', { tokens: ALIGN_TOKENS, description: 'Cross-axis alignment.' }),
      justify: p('token', { tokens: JUSTIFY_TOKENS, description: 'Main-axis distribution.' }),
    },
    children: 'nodes',
  },
  Grid: {
    category: 'Structure',
    description: 'A responsive grid that auto-fills columns at a minimum width.',
    props: {
      min: p('number', { description: 'Minimum column width in px, e.g. min=280.' }),
      gap: p('token', { tokens: GAP_TOKENS, description: 'Space between cells.' }),
      cols: p('number', { description: 'Fixed column count, e.g. cols=3.' }),
    },
    children: 'nodes',
  },
  Card: {
    category: 'Structure',
    description: 'A contained surface with a border, shadow and optional padding.',
    props: {
      pad: p('token', { tokens: PAD_TOKENS, description: 'Inner padding.' }),
      max: p('token', { tokens: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Maximum width.' }),
      tone: p('token', { tokens: TONE_TOKENS, description: 'Surface tone.' }),
    },
    children: 'nodes',
  },
  Section: {
    category: 'Structure',
    description: 'A semantic grouping of related content.',
    props: { title: p('string', { description: 'Optional section title.' }) },
    children: 'nodes',
  },
  Spacer: {
    category: 'Structure',
    description: 'Absorbs remaining space in a flex layout, pushing siblings apart.',
    props: { size: p('token', { tokens: GAP_TOKENS, description: 'Space to reserve.' }) },
    children: 'none',
  },

  // ── Content ────────────────────────────────────────────────────────────
  Heading: {
    category: 'Content',
    description: 'A text header. Defaults to level 2.',
    props: {
      level: p('number', { description: 'Heading level 1–6.' }),
      tone: p('token', { tokens: TONE_TOKENS, description: 'Text color.' }),
    },
    children: 'text',
  },
  Text: {
    category: 'Content',
    description: 'Standard body copy.',
    props: {
      tone: p('token', { tokens: TONE_TOKENS, description: 'Text color.' }),
      weight: p('token', { tokens: ['normal', 'medium', 'semibold', 'bold'], description: 'Font weight.' }),
      align: p('token', { tokens: ALIGN_TOKENS, description: 'Text alignment.' }),
    },
    children: 'text',
  },
  Image: {
    category: 'Content',
    description: 'Renders an image.',
    props: {
      src: p('string', { description: 'Image URL or binding.' }),
      alt: p('string', { description: 'Accessible alt text.' }),
      round: p('boolean', { description: 'Circular crop (avatars).' }),
    },
    children: 'none',
  },
  Icon: {
    category: 'Content',
    description: 'A semantic inline icon.',
    props: {
      name: p('token', {
        tokens: ['user', 'mail', 'check', 'x', 'star', 'settings', 'bell', 'search', 'arrow', 'plus', 'home', 'chart', 'zap'],
        description: 'Semantic icon name.',
      }),
    },
    children: 'none',
  },
  Divider: { category: 'Content', description: 'A horizontal rule that visually separates content.', props: {}, children: 'none' },
  Avatar: {
    category: 'Content',
    description: 'A circular profile image, falling back to an initial when no source is set.',
    props: {
      src: p('binding', { description: 'Image URL or binding.' }),
      label: p('binding', { description: 'Name used for the initial fallback.' }),
    },
    children: 'none',
  },
  Field: {
    category: 'Content',
    description: 'A labelled key/value pair for detail views and forms.',
    props: {
      label: p('string', { description: 'Field label.' }),
      value: p('binding', { description: 'Field value or binding.' }),
    },
    children: 'none',
  },
  Metric: {
    category: 'Content',
    description: 'A compact statistic: large value over a small label.',
    props: {
      label: p('string', { description: 'Metric label.' }),
      value: p('binding', { description: 'Metric value or binding.' }),
    },
    children: 'none',
  },

  // ── Controls ───────────────────────────────────────────────────────────
  Button: {
    category: 'Controls',
    description: 'A clickable action. Actions are named references, never inline code.',
    props: {
      variant: p('token', { tokens: VARIANT_TOKENS, description: 'Visual style.' }),
      action: p('string', { description: 'Named action reference, e.g. action=save.' }),
      size: p('token', { tokens: ['sm', 'md', 'lg'], description: 'Button size.' }),
      disabled: p('boolean', { description: 'Disables the control.' }),
    },
    children: 'text',
  },
  Link: {
    category: 'Controls',
    description: 'Inline navigation to a route.',
    props: { href: p('string', { description: 'Destination route.' }) },
    children: 'text',
  },
  Input: {
    category: 'Controls',
    description: 'A single-line text field.',
    props: {
      type: p('token', { tokens: ['text', 'email', 'password', 'number', 'search'], description: 'Input type.' }),
      placeholder: p('string', { description: 'Placeholder hint.' }),
      value: p('binding', { description: 'Binds to app state.' }),
      label: p('string', { description: 'Field label.' }),
    },
    children: 'none',
    events: { change: { target: 'onChange', payload: 'target.value' } },
  },
  Select: {
    category: 'Controls',
    description: 'A dropdown picker.',
    props: {
      value: p('binding', { description: 'Selected value binding.' }),
      options: p('list', { description: 'Comma-separated options, e.g. options="Pro,Team,Enterprise".' }),
      label: p('string', { description: 'Field label.' }),
    },
    children: 'none',
    events: { change: { target: 'onChange', payload: 'target.value' } },
  },
  Checkbox: {
    category: 'Controls',
    description: 'A boolean toggle with label.',
    props: { checked: p('binding', { description: 'Checked-state binding.' }) },
    children: 'text',
    events: { change: { target: 'onChange', payload: 'target.checked' } },
  },
  Switch: {
    category: 'Controls',
    description: 'An on/off toggle control.',
    props: { checked: p('binding', { description: 'On-state binding.' }) },
    children: 'text',
    events: { change: { target: 'onChange', payload: 'target.checked' } },
  },

  // ── Feedback ───────────────────────────────────────────────────────────
  Alert: {
    category: 'Feedback',
    description: 'An important contextual message.',
    props: { tone: p('token', { tokens: TONE_TOKENS, description: 'Message tone.' }) },
    children: 'any',
  },
  Badge: {
    category: 'Feedback',
    description: 'A compact status indicator.',
    props: { tone: p('token', { tokens: TONE_TOKENS, description: 'Status tone.' }) },
    children: 'text',
  },
  Spinner: {
    category: 'Feedback',
    description: 'An indeterminate loading indicator.',
    props: { size: p('token', { tokens: ['sm', 'md', 'lg'], description: 'Spinner size.' }) },
    children: 'none',
  },
};

export const CATEGORY_ORDER = ['Structure', 'Content', 'Controls', 'Feedback'];

/** Structural language constructs — validated structurally, not as components. */
export const STRUCTURAL_NODES = new Set(['If', 'Else', 'For']);

/** Reserved identifiers the language mentions but does not yet implement. */
export const RESERVED_NODES: Record<string, string> = {
  State: 'State is reserved and not yet supported in v0.2. A complete state-transition model is required before it ships.',
};

export function nodeDef(registry: Registry, name: string): NodeDefinition | undefined {
  return registry[name];
}

/** Resolve the target import for a node name (registry mapping or core adapter). */
export function importFor(registry: Registry, name: string): ImportMapping {
  const def = registry[name];
  if (def?.imports) return def.imports;
  return { source: CORE_IMPORT_SOURCE, export: name };
}

/** Merge two registries (extension wins). */
export function extendRegistry(base: Registry, extra: Registry): Registry {
  return { ...base, ...extra };
}
