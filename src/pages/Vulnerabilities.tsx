import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import SeverityBadge from '@/components/common/SeverityBadge';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

export default function Vulnerabilities() {
  const findings = useAppStore(state => state.findings);
  const request = useAppStore(state => state.requests.findings);
  const load = useAppStore(state => state.loadFindings);
  const [query, setQuery] = useState('');
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => findings.filter(finding => `${finding.id} ${finding.title} ${finding.category} ${finding.app} ${finding.file}`.toLowerCase().includes(query.trim().toLowerCase())), [findings, query]);
  const criticalCount = findings.filter(finding => finding.severity === 'Critical').length;

  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / RISK CENTER</div><h1>Vulnerabilities</h1><p>Review and prioritize the findings available in this workspace.</p></div><span className="open-count">{findings.length} findings · {criticalCount} critical</span></div>
    <section className="panel listing"><div className="panel-heading"><div><h2>All findings</h2><p>Filter findings by title, ID, category, or file</p></div><label className="search-field"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search findings" aria-label="Search findings"/></label></div>
      {request.state === 'loading' ? <LoadingState label="Loading findings…"/> : request.error ? <ErrorState error={request.error} onRetry={() => void load()}/> : !findings.length ? <EmptyState title="No vulnerabilities detected" action={<Link to="/applications" className="text-link">View applications</Link>}>There are no findings in the current data source.</EmptyState> : !filtered.length ? <EmptyState title="No findings match your search" action={<button className="text-link text-button" onClick={() => setQuery('')}>Clear search</button>}>Try a different search term.</EmptyState> : <div className="table-wrap"><table><thead><tr><th scope="col">FINDING</th><th scope="col">SEVERITY</th><th scope="col">CATEGORY</th><th scope="col">APPLICATION</th><th scope="col">LOCATION</th></tr></thead><tbody>{filtered.map(finding => <tr key={finding.id}><td><Link className="finding-link" to={`/vulnerability/${encodeURIComponent(finding.id)}`}><b>{finding.title}</b><small>{finding.id}</small></Link></td><td><SeverityBadge severity={finding.severity}/></td><td>{finding.category}</td><td>{finding.app}</td><td className="muted" title={finding.file}>{finding.file.split('/').at(-1)}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
