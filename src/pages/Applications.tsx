import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import RiskBadge from '@/components/common/RiskBadge';
import SecurityScore from '@/components/common/SecurityScore';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

export default function Applications() {
  const applications = useAppStore(state => state.applications);
  const request = useAppStore(state => state.requests.applications);
  const load = useAppStore(state => state.loadApplications);
  const [query, setQuery] = useState('');
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => applications.filter(app => `${app.name} ${app.packageName} ${app.platform}`.toLowerCase().includes(query.trim().toLowerCase())), [applications, query]);

  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / INVENTORY</div><h1>Applications</h1><p>Manage and monitor your mobile application portfolio.</p></div><Link to="/upload" className="button primary"><Plus size={17}/> Add application</Link></div>
    <section className="panel listing"><div className="panel-heading"><div><h2>Application inventory</h2><p>{applications.length} applications in your workspace</p></div><label className="search-field"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter applications" aria-label="Filter applications"/></label></div>
      {request.state === 'loading' ? <LoadingState label="Loading applications…"/> : request.error ? <ErrorState error={request.error} onRetry={() => void load()}/> : !applications.length ? <EmptyState title="No applications yet" action={<Link to="/upload" className="text-link">Add an application</Link>}>Upload an APK, IPA, AAB, or ZIP package to begin.</EmptyState> : !filtered.length ? <EmptyState title="No search results" action={<button className="text-link text-button" onClick={() => setQuery('')}>Clear search</button>}>No applications match “{query}”.</EmptyState> : <div className="table-wrap"><table><thead><tr><th scope="col">APPLICATION</th><th scope="col">PLATFORM</th><th scope="col">VERSION</th><th scope="col">SECURITY SCORE</th><th scope="col">LAST SCAN</th><th scope="col">STATUS</th></tr></thead><tbody>{filtered.map(app => <tr key={app.id}><td><Link className="app-cell" to={`/application/${encodeURIComponent(app.id)}`}><span className="app-icon" aria-hidden="true">{app.platform === 'Android' ? 'A' : '●'}</span><span><b>{app.name}</b><small>{app.packageName}</small></span></Link></td><td>{app.platform}</td><td>{app.version}</td><td><SecurityScore score={app.score}/></td><td>{app.lastScan}</td><td><RiskBadge status={app.status}/></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
