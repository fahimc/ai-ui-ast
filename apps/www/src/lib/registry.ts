export type PropType = 'token' | 'string' | 'binding' | 'number' | 'boolean' | 'list';

export interface PropSpec {
  name: string;
  type: PropType;
  tokens?: string[];
  description: string;
  required?: boolean;
}

export type Category = 'Structure' | 'Content' | 'Controls' | 'Feedback' | 'State & Logic';

export interface NodeSpec {
  name: string;
  category: Category;
  description: string;
  props: PropSpec[];
  children: string;
}

export const GAP_TOKENS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
export const PAD_TOKENS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
export const TONE_TOKENS = ['default', 'muted', 'info', 'success', 'warning', 'error'];
export const VARIANT_TOKENS = ['primary', 'secondary', 'ghost', 'danger'];
export const ALIGN_TOKENS = ['start', 'center', 'end', 'stretch'];
export const JUSTIFY_TOKENS = ['start', 'center', 'end', 'between', 'around', 'evenly'];

export const NODE_SPECS: NodeSpec[] = [
  // ── Structure ──────────────────────────────────────────────────────────────
  {
    name: 'Page',
    category: 'Structure',
    description: 'The root element of a view. Owns the page chrome and optional data bindings.',
    props: [{ name: 'data', type: 'binding', description: 'Data context for the whole page, e.g. data=$customer' }],
    children: 'Any layout or content nodes.',
  },
  {
    name: 'Header',
    category: 'Structure',
    description: 'A page header band for titles, avatars, and identity rows.',
    props: [],
    children: 'Row / Stack / content nodes.',
  },
  {
    name: 'Stack',
    category: 'Structure',
    description: 'A vertical flex layout container.',
    props: [
      { name: 'gap', type: 'token', tokens: GAP_TOKENS, description: 'Space between children.' },
      { name: 'align', type: 'token', tokens: ALIGN_TOKENS, description: 'Cross-axis alignment.' },
    ],
    children: 'Any nodes.',
  },
  {
    name: 'Row',
    category: 'Structure',
    description: 'A horizontal flex layout container.',
    props: [
      { name: 'gap', type: 'token', tokens: GAP_TOKENS, description: 'Space between children.' },
      { name: 'align', type: 'token', tokens: ALIGN_TOKENS, description: 'Cross-axis alignment.' },
      { name: 'justify', type: 'token', tokens: JUSTIFY_TOKENS, description: 'Main-axis distribution.' },
    ],
    children: 'Any nodes.',
  },
  {
    name: 'Grid',
    category: 'Structure',
    description: 'A responsive grid that auto-fills columns at a minimum width.',
    props: [
      { name: 'min', type: 'number', description: 'Minimum column width in px, e.g. min=280.' },
      { name: 'gap', type: 'token', tokens: GAP_TOKENS, description: 'Space between cells.' },
    ],
    children: 'Cells (usually Cards or Sections).',
  },
  {
    name: 'Card',
    category: 'Structure',
    description: 'A contained surface with a border, shadow and optional padding.',
    props: [{ name: 'pad', type: 'token', tokens: PAD_TOKENS, description: 'Inner padding.' }],
    children: 'Content and layout nodes.',
  },
  {
    name: 'Section',
    category: 'Structure',
    description: 'A semantic grouping of related content.',
    props: [],
    children: 'Heading and content nodes.',
  },
  {
    name: 'Spacer',
    category: 'Structure',
    description: 'Absorbs remaining space in a flex layout, pushing siblings apart.',
    props: [],
    children: 'None.',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    name: 'Heading',
    category: 'Content',
    description: 'A text header. Defaults to level 2.',
    props: [
      { name: 'level', type: 'number', description: 'Heading level 1–6.' },
      { name: 'tone', type: 'token', tokens: TONE_TOKENS, description: 'Text color.' },
    ],
    children: 'None (uses text content).',
  },
  {
    name: 'Text',
    category: 'Content',
    description: 'Standard body copy.',
    props: [
      { name: 'tone', type: 'token', tokens: TONE_TOKENS, description: 'Text color.' },
      { name: 'weight', type: 'token', tokens: ['normal', 'medium', 'semibold', 'bold'], description: 'Font weight.' },
    ],
    children: 'None (uses text content).',
  },
  {
    name: 'Image',
    category: 'Content',
    description: 'Renders an image.',
    props: [
      { name: 'src', type: 'string', description: 'Image URL or binding.' },
      { name: 'alt', type: 'string', description: 'Accessible alt text.' },
      { name: 'round', type: 'boolean', description: 'Circular crop (avatars).' },
    ],
    children: 'None.',
  },
  {
    name: 'Icon',
    category: 'Content',
    description: 'A semantic inline icon.',
    props: [
      {
        name: 'name',
        type: 'token',
        tokens: ['user', 'mail', 'check', 'x', 'star', 'settings', 'bell', 'search', 'arrow', 'plus', 'home'],
        description: 'Semantic icon name.',
      },
    ],
    children: 'None.',
  },
  {
    name: 'Divider',
    category: 'Content',
    description: 'A horizontal rule that visually separates content.',
    props: [],
    children: 'None.',
  },
  {
    name: 'Avatar',
    category: 'Content',
    description: 'A circular profile image, falling back to an initial when no source is set.',
    props: [
      { name: 'src', type: 'binding', description: 'Image URL or binding.' },
      { name: 'label', type: 'binding', description: 'Name used for the initial fallback.' },
    ],
    children: 'None.',
  },
  {
    name: 'Field',
    category: 'Content',
    description: 'A labelled key/value pair for detail views and forms.',
    props: [
      { name: 'label', type: 'string', description: 'Field label.' },
      { name: 'value', type: 'binding', description: 'Field value or binding.' },
    ],
    children: 'None.',
  },
  {
    name: 'Metric',
    category: 'Content',
    description: 'A compact statistic: large value over a small label.',
    props: [
      { name: 'label', type: 'string', description: 'Metric label.' },
      { name: 'value', type: 'binding', description: 'Metric value or binding.' },
    ],
    children: 'None.',
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  {
    name: 'Button',
    category: 'Controls',
    description: 'A clickable action. Actions are named references, never inline code.',
    props: [
      { name: 'variant', type: 'token', tokens: VARIANT_TOKENS, description: 'Visual style.' },
      { name: 'action', type: 'string', description: 'Named action reference, e.g. action=save.' },
      { name: 'size', type: 'token', tokens: ['sm', 'md', 'lg'], description: 'Button size.' },
      { name: 'disabled', type: 'boolean', description: 'Disables the control.' },
    ],
    children: 'None (uses text content).',
  },
  {
    name: 'Link',
    category: 'Controls',
    description: 'Inline navigation to a route.',
    props: [{ name: 'href', type: 'string', description: 'Destination route.' }],
    children: 'None (uses text content).',
  },
  {
    name: 'Input',
    category: 'Controls',
    description: 'A single-line text field.',
    props: [
      { name: 'type', type: 'token', tokens: ['text', 'email', 'password', 'number', 'search'], description: 'Input type.' },
      { name: 'placeholder', type: 'string', description: 'Placeholder hint.' },
      { name: 'value', type: 'binding', description: 'Binds to app state.' },
    ],
    children: 'None.',
  },
  {
    name: 'Select',
    category: 'Controls',
    description: 'A dropdown picker.',
    props: [
      { name: 'value', type: 'binding', description: 'Selected value binding.' },
      { name: 'options', type: 'list', description: 'Comma-separated options, e.g. options="Pro,Team,Enterprise".' },
    ],
    children: 'None.',
  },
  {
    name: 'Checkbox',
    category: 'Controls',
    description: 'A boolean toggle with label.',
    props: [{ name: 'checked', type: 'binding', description: 'Checked-state binding.' }],
    children: 'None (uses text content as label).',
  },
  {
    name: 'Switch',
    category: 'Controls',
    description: 'An on/off toggle control.',
    props: [{ name: 'checked', type: 'binding', description: 'On-state binding.' }],
    children: 'None (uses text content as label).',
  },

  // ── Feedback ──────────────────────────────────────────────────────────────
  {
    name: 'Alert',
    category: 'Feedback',
    description: 'An important contextual message.',
    props: [{ name: 'tone', type: 'token', tokens: TONE_TOKENS, description: 'Message tone.' }],
    children: 'Text or content nodes.',
  },
  {
    name: 'Badge',
    category: 'Feedback',
    description: 'A compact status indicator.',
    props: [{ name: 'tone', type: 'token', tokens: TONE_TOKENS, description: 'Status tone.' }],
    children: 'None (uses text content).',
  },
  {
    name: 'Spinner',
    category: 'Feedback',
    description: 'An indeterminate loading indicator.',
    props: [{ name: 'size', type: 'token', tokens: ['sm', 'md', 'lg'], description: 'Spinner size.' }],
    children: 'None.',
  },

  // ── State & Logic ─────────────────────────────────────────────────────────
  {
    name: 'If',
    category: 'State & Logic',
    description: 'Conditionally renders its children.',
    props: [{ name: 'condition', type: 'binding', description: 'Truthy check, e.g. condition=$user.loggedIn.' }],
    children: 'Any nodes, rendered when the condition is truthy.',
  },
  {
    name: 'For',
    category: 'State & Logic',
    description: 'Iterates a list and renders children once per item.',
    props: [
      { name: 'each', type: 'binding', description: 'List binding, e.g. each=$projects.' },
      { name: 'in', type: 'binding', description: 'List binding (alternate spelling).' },
    ],
    children: 'Item template, repeated per element.',
  },
];

export const CATEGORY_ORDER: Category[] = ['Structure', 'Content', 'Controls', 'Feedback', 'State & Logic'];

export function nodeSpec(name: string): NodeSpec | undefined {
  return NODE_SPECS.find((n) => n.name === name);
}

export function knownNodes(): Set<string> {
  return new Set(NODE_SPECS.map((n) => n.name));
}
