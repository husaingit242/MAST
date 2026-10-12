import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = { reports: 'Reports', 'api-security': 'API security', 'dynamic-analysis': 'Dynamic analysis', 'reverse-engineering': 'Reverse engineering', owasp: 'OWASP mobile top 10', settings: 'Settings' };

export default function GenericPage({ title: requestedTitle }: { title?: string } = {}) {
  const location = useLocation();
  const title = requestedTitle ?? titles[location.pathname.split('/')[1]] ?? 'Planned module';
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / PLANNED MODULE</div><h1>{title}</h1><p>This module is not available in the current MAST phase.</p></div></div>
    <section className="panel placeholder">
      <span className="placeholder-icon"><ShieldAlert size={25}/></span>
      <h2>{title} is planned</h2>
      <p>This placeholder keeps the workspace navigation ready. Its feature workflow is planned for a later MAST phase.</p>
      <Link to="/applications" className="button secondary">Browse applications</Link>
    </section>
  </>;
}
