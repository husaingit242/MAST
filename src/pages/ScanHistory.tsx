import { useEffect } from 'react';
import { Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import { mockMode } from '@/services/dataProvider';

export default function ScanHistory() {
  const scans = useAppStore(state => state.scans);
  const request = useAppStore(state => state.requests.scans);
  const load = useAppStore(state => state.loadScans);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / ACTIVITY</div><h1>Scan history</h1><p>Track available analysis runs and demo flows.</p></div></div>
    {mockMode && <div className="demo-notice" role="note">Demo records are illustrative; they do not represent real security-analysis results.</div>}
    <section className="panel listing"><div className="panel-heading"><div><h2>Recent scans</h2><p>{scans.length} runs in the current data source</p></div></div>
      {request.state === 'loading' ? <LoadingState label="Loading scans…"/> : request.error ? <ErrorState error={request.error} onRetry={() => void load()}/> : !scans.length ? <EmptyState title="No scans found" action={<Link to="/upload" className="text-link">{mockMode ? 'Start a demo flow' : 'Upload a package and queue a scan'}</Link>}>Scan history will appear here when available.</EmptyState> : <div className="table-wrap"><table><thead><tr><th scope="col">SCAN</th><th scope="col">APPLICATION</th><th scope="col">PLATFORM</th><th scope="col">DATE</th><th scope="col">STATUS</th><th scope="col">SCORE</th></tr></thead><tbody>{scans.map(scan => <tr key={scan.id}><td><Link className="text-link" to={`/active-scan?scan=${encodeURIComponent(scan.id)}`}>{scan.id}</Link></td><td>{scan.app}</td><td>{scan.platform}</td><td>{scan.date}</td><td><span className={`scan-badge ${scan.status}`}><i aria-hidden="true"/>{scan.status}</span></td><td>{scan.score === null ? '—' : `${scan.score}/100`}</td></tr>)}</tbody></table></div>}
    </section>
    <div className="tip"><Clock3 size={17}/>{mockMode ? 'The demo scan status is simulated locally. No app package is sent to a server.' : 'Scan creation and status polling are not integrated in API mode yet.'}</div>
  </>;
}
