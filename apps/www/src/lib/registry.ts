/**
 * Website registry.
 *
 * Language validation lives in `@codedia/parser` — this module only adapts
 * the package's CORE_REGISTRY for the site's UI (the Language page table)
 * and extends it with preview-specific third-party components that the
 * gallery uses (`@acme/charts`). Nothing here is required for validation.
 */
import {
  CORE_REGISTRY,
  GAP_TOKENS,
  PAD_TOKENS,
  TONE_TOKENS,
  VARIANT_TOKENS,
  ALIGN_TOKENS,
  JUSTIFY_TOKENS,
  extendRegistry,
  type NodeDefinition,
  type PropSpec,
} from '@codedia/parser';

export { GAP_TOKENS, PAD_TOKENS, TONE_TOKENS, VARIANT_TOKENS, ALIGN_TOKENS, JUSTIFY_TOKENS };

export type Category = string;

export interface NodeSpec {
  name: string;
  category: Category;
  description: string;
  props: (PropSpec & { name: string })[];
  children: string;
}

/** The registry the playground/preview/validator use on the website. */
export const WWW_REGISTRY = extendRegistry(CORE_REGISTRY, {
  AreaChart: {
    category: 'Content',
    description: 'A registered third-party area chart from @acme/charts.',
    props: {
      data: { type: 'binding', description: 'Series data binding.' },
      height: { type: 'number', description: 'Chart height in px.' },
    },
    children: 'nodes',
    imports: { source: '@acme/charts', export: 'AreaChart' },
  },
  Area: {
    category: 'Content',
    description: 'A registered series layer from @acme/charts.',
    props: {
      dataKey: { type: 'string', description: 'Series key.' },
      stroke: { type: 'string', description: 'Line colour.' },
      fill: { type: 'string', description: 'Fill colour.' },
    },
    children: 'none',
    imports: { source: '@acme/charts', export: 'Area' },
  },
  XAxis: {
    category: 'Content',
    description: 'A registered chart axis from @acme/charts.',
    props: { dataKey: { type: 'string', description: 'Axis key.' } },
    children: 'none',
    imports: { source: '@acme/charts', export: 'XAxis' },
  },
  CartesianGrid: {
    category: 'Content',
    description: 'A registered chart grid from @acme/charts.',
    props: { strokeDasharray: { type: 'string', description: 'Dash pattern.' } },
    children: 'none',
    imports: { source: '@acme/charts', export: 'CartesianGrid' },
  },
});

/** Node specs for the Language page, derived from the core registry. */
export const NODE_SPECS: NodeSpec[] = Object.entries(CORE_REGISTRY).map(([name, def]: [string, NodeDefinition]) => ({
  name,
  category: def.category ?? 'Other',
  description: def.description ?? '',
  props: Object.entries(def.props).map(([key, spec]: [string, PropSpec]) => ({ name: key, ...spec })),
  children: def.children ?? 'nodes',
}));

export const CATEGORY_ORDER = ['Structure', 'Content', 'Controls', 'Feedback'];

export function nodeSpec(name: string): NodeDefinition | undefined {
  return WWW_REGISTRY[name];
}

export function knownNodes(): Set<string> {
  return new Set(Object.keys(CORE_REGISTRY));
}
