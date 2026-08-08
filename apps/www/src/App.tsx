import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { Home } from './pages/Home';
import { Language } from './pages/Language';
import { Examples } from './pages/Examples';
import { Roadmap } from './pages/Roadmap';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { DEFAULT_SAMPLE_ID } from './lib/samples';

// ─────────────────────────────────────────────────────────────────────────────
// Hash router — works on static hosts (Netlify) with zero config.
// ─────────────────────────────────────────────────────────────────────────────
type Route = 'home' | 'playground' | 'language' | 'examples' | 'roadmap';

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  switch (hash) {
    case 'playground':
      return 'playground';
    case 'language':
      return 'language';
    case 'examples':
      return 'examples';
    case 'roadmap':
      return 'roadmap';
    default:
      return 'home';
  }
}

function navigate(route: Route) {
  window.location.hash = route === 'home' ? '/' : `/${route}`;
}

function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        {'{ }'}
      </span>
      ai-ui-ast
    </span>
  );
}

const NAV_LINKS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'language', label: 'Language' },
  { route: 'examples', label: 'Examples' },
  { route: 'playground', label: 'Playground' },
  { route: 'roadmap', label: 'Roadmap' },
];

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [customCode, setCustomCode] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((r: Route) => navigate(r), []);

  const openGalleryCode = useCallback((code: string) => {
    setCustomCode(code);
    navigate('playground');
  }, []);

  const clearCustom = useCallback(() => setCustomCode(null), []);

  const onSampleChange = useCallback((id: string) => {
    setSampleId(id);
    setCustomCode(null);
  }, []);

  return (
    <div className="site">
      <nav className="nav">
        <button type="button" className="nav-brand" onClick={() => go('home')}>
          <Logo />
        </button>
        <div className="nav-links">
          {NAV_LINKS.filter((l) => l.route !== 'home').map((l) => (
            <button
              key={l.route}
              type="button"
              className={`nav-link ${route === l.route ? 'active' : ''}`}
              onClick={() => go(l.route)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary nav-cta" onClick={() => go('playground')}>
          Open playground
        </button>
      </nav>

      {route === 'home' && <Home onNavigate={go} />}
      {route === 'language' && <Language />}
      {route === 'examples' && <Examples onOpenInPlayground={openGalleryCode} />}
      {route === 'playground' && (
        <PlaygroundPage sampleId={sampleId} onSampleChange={onSampleChange} customCode={customCode} onClearCustom={clearCustom} />
      )}
      {route === 'roadmap' && <Roadmap />}

      <footer className="footer">
        <div className="footer-inner">
          <Logo />
          <p className="muted">
            An LLM-first UI language that expresses the UI AST directly and compiles deterministically to React.
          </p>
          <div className="footer-links">
            <a href="https://github.com/fahimc/ai-ui-ast" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://github.com/fahimc/ai-ui-ast/blob/main/LANGUAGE_SPEC_V0.md" target="_blank" rel="noreferrer">
              Spec v0
            </a>
            <a href="https://github.com/fahimc/ai-ui-ast/blob/main/BUILD_PLAN.md" target="_blank" rel="noreferrer">
              Build plan
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
