import { useState } from 'react';
import { highlight, type Lang } from '../lib/highlight';

interface CodeBlockProps {
  code: string;
  lang: Lang;
  label?: string;
  maxHeight?: number;
  className?: string;
}

export function CodeBlock({ code, lang, label, maxHeight, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = highlight(code, lang);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className={`codeblock ${className || ''}`}>
      {(label || true) && (
        <div className="codeblock-bar">
          <span className="codeblock-label">{label || lang}</span>
          <button type="button" className="codeblock-copy" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="codeblock-pre" style={maxHeight ? { maxHeight } : undefined}>
        <code className={`lang-${lang}`}>
          {lines.map((line, i) => (
            <span key={i} className="codeblock-line">
              {line.length === 0 ? '\u00a0' : line.map((tok, j) => (tok.cls ? <span key={j} className={tok.cls}>{tok.text}</span> : <span key={j}>{tok.text}</span>))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
