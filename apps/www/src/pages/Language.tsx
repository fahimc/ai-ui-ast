import { CodeBlock } from '../components/CodeBlock';
import { Section } from '../components/Section';
import { NODE_SPECS, CATEGORY_ORDER, GAP_TOKENS, PAD_TOKENS, TONE_TOKENS, VARIANT_TOKENS } from '../lib/registry';

const OUT_OF_SCOPE = ['No arbitrary CSS', 'No style= / className=', 'No package imports', 'No inline JavaScript', 'No eval', 'No framework syntax'];

const GRAMMAR = `Page CustomerDetail data=$customer
  Header
    Row gap=md align=center
      Avatar src=$customer.avatar label=$customer.name
      Stack gap=xs
        Heading level=1 $customer.name
        Badge tone=success $customer.status`;

export function Language() {
  return (
    <Section
      id="language"
      eyebrow="Language spec v0"
      title="The language"
      lead={'Nodes are indentation-nested declarations: Component prop=value "Text content". No brackets, no XML tags, no JS.'}
    >
      <div className="grammar-row">
        <CodeBlock code={GRAMMAR} lang="aui" label="grammar.aui" />
        <div className="grammar-rules">
          <h3>Grammar rules</h3>
          <ul>
            <li><code>Component</code> starts each node; props follow as <code>key=value</code>.</li>
            <li>Nesting uses a consistent 2-space indent — children are indented relative to their parent.</li>
            <li>Trailing <code>"quoted text"</code> becomes the node's text content.</li>
            <li><code>$bindings</code> reference app state; never inline expressions.</li>
            <li>Actions are named references (<code>action=save</code>), resolved by the compiler.</li>
            <li><code>If condition=$x … Else</code> branches declaratively — indentation, not ternaries.</li>
            <li><code>def Name param1 param2=default</code> defines a reusable component template.</li>
            <li><code>import {"{ AreaChart }"} from "pkg"</code> is the only escape hatch to third-party libraries.</li>
          </ul>
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => (
        <div key={cat} className="node-group">
          <h3 className="node-group-title">{cat}</h3>
          <div className="node-table-wrap">
            <table className="node-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Purpose</th>
                  <th>Props</th>
                </tr>
              </thead>
              <tbody>
                {NODE_SPECS.filter((n) => n.category === cat).map((n) => (
                  <tr key={n.name}>
                    <td>
                      <code className="node-name">{n.name}</code>
                    </td>
                    <td>{n.description}</td>
                    <td>
                      {n.props.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="prop-chips">
                          {n.props.map((p) => (
                            <span key={p.name} className="prop-chip" title={p.description}>
                              <code>{p.name}</code>
                              {p.tokens && <em className="prop-tokens">({p.tokens.join(' | ')})</em>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="tokens-row">
        <div className="token-group">
          <h3>Spacing tokens</h3>
          <p>
            <code>gap</code> and <code>pad</code> accept a fixed scale.
          </p>
          <div className="chip-list">
            {[...new Set([...GAP_TOKENS, ...PAD_TOKENS])].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="token-group">
          <h3>Tone tokens</h3>
          <p>
            <code>tone</code> on Text, Badge, and Alert.
          </p>
          <div className="chip-list">
            {TONE_TOKENS.map((t) => (
              <span key={t} className="chip chip-tone">{t}</span>
            ))}
          </div>
        </div>
        <div className="token-group">
          <h3>Button variants</h3>
          <p>
            <code>variant</code> on Button.
          </p>
          <div className="chip-list">
            {VARIANT_TOKENS.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="out-of-scope">
        <h3>Deliberately absent in v0</h3>
        <div className="chip-list">
          {OUT_OF_SCOPE.map((t) => (
            <span key={t} className="chip chip-out">{t}</span>
          ))}
        </div>
        <p className="muted">
          Escape hatches are a post-v0 concern. The constraint is the point: it is what makes output predictable
          enough for an LLM to hit first try.
        </p>
      </div>
    </Section>
  );
}
