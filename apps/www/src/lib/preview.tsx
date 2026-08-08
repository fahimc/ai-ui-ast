import React from 'react';
import type { Node } from '@ai-ui-ast/parser';
import { nodeSpec } from './registry';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data context so $bindings resolve to something visible in the preview.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_DATA: Record<string, unknown> = {
  customer: {
    name: 'Ada Lovelace',
    email: 'ada@analytical.engine',
    plan: 'Pro',
    status: 'Active',
    projects: 12,
    storage: '48 GB',
    avatar: 'https://i.pravatar.cc/96?img=47',
  },
  user: {
    name: 'Grace Hopper',
    loggedIn: true,
    role: 'Admin',
  },
  items: [
    { id: 1, name: 'Design system audit', status: 'Done', assignee: 'Ada' },
    { id: 2, name: 'AUI compiler v0', status: 'In progress', assignee: 'Grace' },
    { id: 3, name: 'Registry adapter: Radix', status: 'Planned', assignee: 'Alan' },
  ],
  projects: [
    { id: 1, name: 'Website redesign', progress: 0.75, color: 'var(--accent)' },
    { id: 2, name: 'Mobile app', progress: 0.4, color: '#34d399' },
    { id: 3, name: 'Design tokens', progress: 0.9, color: '#fbbf24' },
  ],
  notifications: 3,
  showAdvanced: true,
};

function lookup(path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = MOCK_DATA;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Resolve a prop value: $bindings hit mock data, everything else is literal. */
export function resolveValue(value: string | undefined): string {
  if (value === undefined) return '';
  if (value.startsWith('$')) {
    const resolved = lookup(value.slice(1));
    if (resolved !== undefined && resolved !== null) return String(resolved);
    return value; // unresolved binding renders as its path
  }
  return value;
}

export function resolveBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const v = resolveValue(value).toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token maps (mini design system)
// ─────────────────────────────────────────────────────────────────────────────
const SPACE: Record<string, string> = { none: '0', xs: '4px', sm: '8px', md: '12px', lg: '20px', xl: '32px' };

function space(token: string | undefined, fallback = '0'): string {
  return (token && SPACE[token]) || fallback;
}

const TONE_COLOR: Record<string, string> = {
  default: 'var(--ink)',
  muted: 'var(--muted)',
  info: 'var(--tone-info)',
  success: 'var(--tone-success)',
  warning: 'var(--tone-warning)',
  error: 'var(--tone-error)',
};

function toneColor(tone: string | undefined): string {
  return (tone && TONE_COLOR[tone]) || 'var(--ink)';
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function prop(node: Node, key: string): string | undefined {
  return node.props.find((p) => p.key === key)?.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
const ICON_PATHS: Record<string, React.ReactNode> = {
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  mail: <path d="M4 6h16v12H4z M4 7l8 6 8-6" />,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8L12 3Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm5 10a2 2 0 0 0 2 2" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10Z" />,
};

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.user;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Node renderer
// ─────────────────────────────────────────────────────────────────────────────
export function renderNode(node: Node, depth = 0): React.ReactNode {
  const p = (k: string) => prop(node, k);
  const children = node.children.map((c, i) => <React.Fragment key={i}>{renderNode(c, depth + 1)}</React.Fragment>);
  const text = node.textContent !== undefined ? resolveValue(node.textContent) : '';

  switch (node.type) {
    case 'Page':
      return (
        <div className="aui-page">
          {p('title') ? <h2 className="aui-page-title">{resolveValue(p('title'))}</h2> : null}
          {children}
        </div>
      );

    case 'Header':
      return <header className="aui-header">{children}</header>;

    case 'Stack':
      return (
        <div className="aui-stack" style={{ gap: space(p('gap'), '8px'), alignItems: p('align') }}>
          {children}
        </div>
      );

    case 'Row':
      return (
        <div
          className="aui-row"
          style={{ gap: space(p('gap'), '8px'), alignItems: p('align') ?? 'center', justifyContent: p('justify') }}
        >
          {children}
        </div>
      );

    case 'Grid':
      return (
        <div
          className="aui-grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${p('min') || 280}px, 1fr))`,
            gap: space(p('gap'), '12px'),
          }}
        >
          {children}
        </div>
      );

    case 'Card':
      return <div className={cx('aui-card', p('pad') && `pad-${p('pad')}`)}>{children}</div>;

    case 'Section':
      return <section className="aui-section">{children}</section>;

    case 'Spacer':
      return <div className="aui-spacer" />;

    case 'Heading': {
      const level = Math.min(6, Math.max(1, parseInt(p('level') || '2', 10) || 2));
      const Tag = `h${level}` as React.ElementType;
      return <Tag className={cx('aui-heading', `lv-${level}`)} style={{ color: toneColor(p('tone')) }}>{text}</Tag>;
    }

    case 'Text':
      return (
        <p className={cx('aui-text', p('weight') && `w-${p('weight')}`)} style={{ color: toneColor(p('tone')) }}>
          {text}
        </p>
      );

    case 'Image': {
      const round = p('round') !== undefined;
      return (
        <img
          className={cx('aui-image', round && 'round')}
          src={resolveValue(p('src'))}
          alt={resolveValue(p('alt')) || ''}
        />
      );
    }

    case 'Icon':
      return (
        <span className="aui-icon">
          <Icon name={resolveValue(p('name'))} />
        </span>
      );

    case 'Divider':
      return <hr className="aui-divider" />;

    case 'Avatar': {
      const src = resolveValue(p('src'));
      const label = resolveValue(p('label'));
      if (src && src.startsWith('http')) {
        return <img className="aui-avatar" src={src} alt={label} />;
      }
      return <span className="aui-avatar aui-avatar-fallback">{label.charAt(0).toUpperCase() || '?'}</span>;
    }

    case 'Field':
      return (
        <div className="aui-field">
          <span className="aui-field-label">{resolveValue(p('label'))}</span>
          <span className="aui-field-value">{resolveValue(p('value'))}</span>
        </div>
      );

    case 'Metric':
      return (
        <div className="aui-metric">
          <span className="aui-metric-value">{resolveValue(p('value'))}</span>
          <span className="aui-metric-label">{resolveValue(p('label'))}</span>
        </div>
      );

    case 'Button': {
      const variant = p('variant') || 'primary';
      const disabled = resolveBool(p('disabled'));
      return (
        <button
          type="button"
          className={cx('aui-button', `variant-${variant}`, p('size') && `size-${p('size')}`)}
          disabled={disabled}
          title={p('action') ? `action: ${p('action')}` : undefined}
        >
          {text}
        </button>
      );
    }

    case 'Link':
      return (
        <a className="aui-link" href={resolveValue(p('href')) || '#'}>
          {text}
        </a>
      );

    case 'Input':
      return (
        <input
          className="aui-input"
          type={p('type') || 'text'}
          placeholder={resolveValue(p('placeholder'))}
          defaultValue={resolveValue(p('value'))}
          readOnly
        />
      );

    case 'Select':
      return (
        <select className="aui-select" defaultValue={resolveValue(p('value'))}>
          {(p('options') || '').split(',').map((o) => {
            const opt = o.trim();
            return (
              <option key={opt} value={opt}>
                {opt}
              </option>
            );
          })}
        </select>
      );

    case 'Checkbox':
      return (
        <label className="aui-check">
          <input type="checkbox" defaultChecked={resolveBool(p('checked'))} readOnly />
          <span>{text}</span>
        </label>
      );

    case 'Switch':
      return (
        <label className="aui-switch">
          <input type="checkbox" defaultChecked={resolveBool(p('checked'))} readOnly />
          <span className="aui-switch-track">
            <span className="aui-switch-thumb" />
          </span>
          <span>{text}</span>
        </label>
      );

    case 'Alert': {
      const tone = p('tone') || 'info';
      return <div className={cx('aui-alert', `tone-${tone}`)}>{children.length ? children : text}</div>;
    }

    case 'Badge': {
      const tone = p('tone') || 'default';
      return <span className={cx('aui-badge', `tone-${tone}`)}>{text}</span>;
    }

    case 'Spinner': {
      const size = p('size') === 'sm' ? 14 : p('size') === 'lg' ? 26 : 20;
      return (
        <span className="aui-spinner" style={{ width: size, height: size }} aria-label="Loading" role="status" />
      );
    }

    case 'If': {
      const condition = resolveBool(p('condition'));
      return <>{condition ? children : null}</>;
    }

    case 'For': {
      const listBinding = p('each') || p('in') || '$items';
      const list = listBinding.startsWith('$') ? (lookup(listBinding.slice(1)) as unknown[] | undefined) : undefined;
      const items = Array.isArray(list) ? list : [];
      return (
        <>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {node.children.map((child, j) => (
                <React.Fragment key={j}>
                  {renderWithResolver(child, (path) => {
                    if (path.startsWith('item.')) {
                      let cur: unknown = item;
                      for (const part of path.slice(5).split('.')) {
                        if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
                          cur = (cur as Record<string, unknown>)[part];
                        } else return undefined;
                      }
                      return cur;
                    }
                    return lookup(path);
                  })}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </>
      );
    }

    default: {
      // Unknown node: render children with a diagnostic outline.
      const known = nodeSpec(node.type);
      return (
        <div className={cx('aui-unknown', !known && 'aui-unknown-missing')} title={known ? 'Unknown prop set' : `Unknown component "${node.type}"`}>
          {children.length ? children : <span className="aui-unknown-tag">{node.type}</span>}
        </div>
      );
    }
  }
}

// Local re-implementation of renderNode that uses a custom resolver.
function renderWithResolver(node: Node, resolver: (path: string) => unknown): React.ReactNode {
  const p = (k: string) => prop(node, k);
  const rv = (v: string | undefined) => (v !== undefined && v.startsWith('$') ? String(resolver(v.slice(1)) ?? v) : (v ?? ''));
  const children = node.children.map((c, i) => <React.Fragment key={i}>{renderWithResolver(c, resolver)}</React.Fragment>);
  const text = node.textContent !== undefined ? rv(node.textContent) : '';
  const rbool = (v: string | undefined) => {
    const s = rv(v).toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  };

  switch (node.type) {
    case 'Page':
      return <div className="aui-page">{p('title') ? <h2 className="aui-page-title">{rv(p('title'))}</h2> : null}{children}</div>;
    case 'Header':
      return <header className="aui-header">{children}</header>;
    case 'Stack':
      return <div className="aui-stack" style={{ gap: space(p('gap'), '8px'), alignItems: p('align') }}>{children}</div>;
    case 'Row':
      return <div className="aui-row" style={{ gap: space(p('gap'), '8px'), alignItems: p('align') ?? 'center', justifyContent: p('justify') }}>{children}</div>;
    case 'Grid':
      return (
        <div className="aui-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${p('min') || 280}px, 1fr))`, gap: space(p('gap'), '12px') }}>
          {children}
        </div>
      );
    case 'Card':
      return <div className={cx('aui-card', p('pad') && `pad-${p('pad')}`)}>{children}</div>;
    case 'Section':
      return <section className="aui-section">{children}</section>;
    case 'Spacer':
      return <div className="aui-spacer" />;
    case 'Heading': {
      const level = Math.min(6, Math.max(1, parseInt(p('level') || '2', 10) || 2));
      const Tag = `h${level}` as React.ElementType;
      return <Tag className={cx('aui-heading', `lv-${level}`)} style={{ color: toneColor(p('tone')) }}>{text}</Tag>;
    }
    case 'Text':
      return <p className={cx('aui-text', p('weight') && `w-${p('weight')}`)} style={{ color: toneColor(p('tone')) }}>{text}</p>;
    case 'Image': {
      const round = p('round') !== undefined;
      return <img className={cx('aui-image', round && 'round')} src={rv(p('src'))} alt={rv(p('alt')) || ''} />;
    }
    case 'Icon':
      return <span className="aui-icon"><Icon name={rv(p('name'))} /></span>;
    case 'Divider':
      return <hr className="aui-divider" />;
    case 'Avatar': {
      const src = rv(p('src'));
      const label = rv(p('label'));
      if (src && src.startsWith('http')) {
        return <img className="aui-avatar" src={src} alt={label} />;
      }
      return <span className="aui-avatar aui-avatar-fallback">{label.charAt(0).toUpperCase() || '?'}</span>;
    }
    case 'Field':
      return (
        <div className="aui-field">
          <span className="aui-field-label">{rv(p('label'))}</span>
          <span className="aui-field-value">{rv(p('value'))}</span>
        </div>
      );
    case 'Metric':
      return (
        <div className="aui-metric">
          <span className="aui-metric-value">{rv(p('value'))}</span>
          <span className="aui-metric-label">{rv(p('label'))}</span>
        </div>
      );
    case 'Button': {
      const variant = p('variant') || 'primary';
      return (
        <button type="button" className={cx('aui-button', `variant-${variant}`, p('size') && `size-${p('size')}`)} disabled={rbool(p('disabled'))} title={p('action') ? `action: ${p('action')}` : undefined}>
          {text}
        </button>
      );
    }
    case 'Link':
      return <a className="aui-link" href={rv(p('href')) || '#'}>{text}</a>;
    case 'Input':
      return <input className="aui-input" type={p('type') || 'text'} placeholder={rv(p('placeholder'))} defaultValue={rv(p('value'))} readOnly />;
    case 'Select':
      return (
        <select className="aui-select" defaultValue={rv(p('value'))}>
          {(p('options') || '').split(',').map((o) => {
            const opt = o.trim();
            return <option key={opt} value={opt}>{opt}</option>;
          })}
        </select>
      );
    case 'Checkbox':
      return (
        <label className="aui-check">
          <input type="checkbox" defaultChecked={rbool(p('checked'))} readOnly />
          <span>{text}</span>
        </label>
      );
    case 'Switch':
      return (
        <label className="aui-switch">
          <input type="checkbox" defaultChecked={rbool(p('checked'))} readOnly />
          <span className="aui-switch-track"><span className="aui-switch-thumb" /></span>
          <span>{text}</span>
        </label>
      );
    case 'Alert': {
      const tone = p('tone') || 'info';
      return <div className={cx('aui-alert', `tone-${tone}`)}>{children.length ? children : text}</div>;
    }
    case 'Badge': {
      const tone = p('tone') || 'default';
      return <span className={cx('aui-badge', `tone-${tone}`)}>{text}</span>;
    }
    case 'Spinner': {
      const size = p('size') === 'sm' ? 14 : p('size') === 'lg' ? 26 : 20;
      return <span className="aui-spinner" style={{ width: size, height: size }} aria-label="Loading" role="status" />;
    }
    case 'If':
      return <>{rbool(p('condition')) ? children : null}</>;
    case 'For': {
      const listBinding = p('each') || p('in') || '$items';
      const list = listBinding.startsWith('$') ? (resolver(listBinding.slice(1)) as unknown[] | undefined) : undefined;
      const items = Array.isArray(list) ? list : [];
      return (
        <>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {node.children.map((child, j) => (
                <React.Fragment key={j}>{renderWithResolver(child, (path) => {
                  if (path.startsWith('item.')) {
                    let cur: unknown = item;
                    for (const part of path.slice(5).split('.')) {
                      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
                      else return undefined;
                    }
                    return cur;
                  }
                  return resolver(path);
                })}</React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </>
      );
    }
    default: {
      const known = nodeSpec(node.type);
      return (
        <div className={cx('aui-unknown', !known && 'aui-unknown-missing')} title={known ? 'Unknown prop set' : `Unknown component "${node.type}"`}>
          {children.length ? children : <span className="aui-unknown-tag">{node.type}</span>}
        </div>
      );
    }
  }
}

/** Full preview component. */
export function AuiPreview({ nodes }: { nodes: Node[] }) {
  return (
    <div className="aui-preview">
      {nodes.length === 0 ? (
        <div className="aui-preview-empty">Nothing to render — write some .aui code.</div>
      ) : (
        nodes.map((n, i) => <React.Fragment key={i}>{renderNode(n)}</React.Fragment>)
      )}
    </div>
  );
}
