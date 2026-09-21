import { Component, useEffect, useRef, useState } from 'react';

class SectionBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="section-load-message"><p>Não foi possível abrir esta experiência.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button><a href="#contato">Continuar pelo atendimento</a></div> : this.props.children;
  }
}

export default function DeferredSection({ id, label, children, className = '' }) {
  const root = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    observer.observe(root.current);
    const reveal = () => { if (window.location.hash === `#${id}`) setReady(true); };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => { observer.disconnect(); window.removeEventListener('hashchange', reveal); };
  }, [id]);
  return <div id={id} ref={root} className={`deferred-section ${className}`}>
    {ready ? <SectionBoundary>{children}</SectionBoundary> : <div className="container section-load-message"><p>{label}</p><button type="button" onClick={() => setReady(true)}>Abrir agora</button></div>}
  </div>;
}
