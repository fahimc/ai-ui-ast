import { useEffect, useMemo, useRef, useState } from 'react';
import { parse } from '@ai-ui-ast/parser';
import { SAMPLES } from '../lib/samples';
import { validate, type Diagnostic } from '../lib/validate';
import { compileReact } from '../lib/compileReact';
import { AuiPreview } from '../lib/preview';
import { CodeBlock } from './CodeBlock';

type Tab = 'preview' | 'ast' | 'react';

interface PlaygroundProps {
  sampleId: string;
  onSampleChange: (id: string) => void;
}

function countNodes(doc: { rootNodes: { children: unknown[] }[] }): number {
  let n = 0;
  const walk = (nodes: { children: unknown[] }[]) => {
    for (const node of nodes) {
      n += 1;
      walk((node as { children: unknown[] }).children as { children: unknown[] }[]);
    }
  };
  walk(doc.rootNodes);
  return n;
}

export function Playground({ sampleId, onSampleChange }: PlaygroundProps) {
  const [code, setCode] = useState(() => SAMPLES.find((s) => s.id === sampleId)?.code ?? SAMPLES[0].code);
  const [tab, setTab] = useState<Tab>('preview');
  const gutterRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sample = SAMPLES.find((s) => s.id === sampleId);
    if (sample) setCode(sample.code);
  }, [sampleId]);

  const { doc, diags, react, astJson, error, nodeCount } = useMemo(() => {
    try {
      const parsed = parse(code);
      const d = validate(code);
      return {
        doc: parsed,
        diags: d,
        react: compileReact(parsed),
        astJson: JSON.stringify(parsed, null, 2),
        error: null as string | null,
        nodeCount: countNodes(parsed),
      };
    } catch (e) {
      return {
        doc: { rootNodes: [] },
        diags: [],
        react: '',
        astJson: '',
        error: e instanceof Error ? e.message : 'Unexpected parse error',
        nodeCount: 0,
      };
    }
  }, [code]);

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const errors = diags.filter((d) => d.severity === 'error').length;
  const warnings = diags.filter((d) => d.severity === 'warning').length;

  const syncScroll = () => {
    if (gutterRef.current && taRef.current) {
      gutterRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  const onEditorScroll = () => syncScroll();

  const loadSample = (id: string) => {
    onSampleChange(id);
  };

  const reset = () => {
    const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
    setCode(sample.code);
  };

  const tabLabel = (t: Tab): string => {
    if (t === 'ast') return `AST · ${nodeCount} nodes`;
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div className="playground">
      <div className="playground-toolbar">
        <label className="playground-sample">
          <span>Example</span>
          <select value={sampleId} onChange={(e) => loadSample(e.target.value)}>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Reset
        </button>
        <span className="playground-status">
          {lineCount} lines · {nodeCount} nodes
          {errors > 0 && <span className="status-error"> · {errors} error{errors > 1 ? 's' : ''}</span>}
          {warnings > 0 && <span className="status-warn"> · {warnings} warning{warnings > 1 ? 's' : ''}</span>}
        </span>
      </div>

      <div className="playground-body">
        <div className="playground-editor-pane">
          <div className="editor-shell">
            <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="editor-gutter-line">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={taRef}
              className="editor-textarea"
              value={code}
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
              onScroll={onEditorScroll}
              aria-label="AUI source editor"
            />
          </div>
          {error && <div className="playground-error">{error}</div>}
          {diags.length > 0 && (
            <div className="playground-diags">
              {diags.slice(0, 12).map((d: Diagnostic, i) => (
                <div key={i} className={`diag diag-${d.severity}`}>
                  <span className="diag-line">L{d.line}</span>
                  {d.message}
                </div>
              ))}
              {diags.length > 12 && <div className="diag-more">…and {diags.length - 12} more</div>}
            </div>
          )}
        </div>

        <div className="playground-output-pane">
          <div className="playground-tabs">
            {(['preview', 'ast', 'react'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`playground-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>
          <div className="playground-output">
            {tab === 'preview' && (
              <div className="preview-canvas">
                <AuiPreview nodes={doc.rootNodes} />
                <div className="preview-note">
                  Live preview — bindings resolve against built-in mock data; components come from the v0 design-system registry.
                </div>
              </div>
            )}
            {tab === 'ast' && <CodeBlock code={astJson} lang="json" label="canonical-ui-ast.json" maxHeight={560} />}
            {tab === 'react' && <CodeBlock code={react} lang="tsx" label="generated Component.tsx" maxHeight={560} />}
          </div>
        </div>
      </div>
    </div>
  );
}
