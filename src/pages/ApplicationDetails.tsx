import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Application } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import RiskBadge from '@/components/common/RiskBadge';
import SecurityScore from '@/components/common/SecurityScore';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';

export default function ApplicationDetails() {
  const { id = '' } = useParams();
  const getApplication = useAppStore(state => state.getApplication);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void getApplication(id).then(result => { if (active) setApplication(result); }).catch(reason => { if (active) setError({ message: typeof reason?.message === 'string' ? reason.message : 'Could not load this application.' }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [getApplication, id]);

  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / APPLICATION</div><h1>{application?.name ?? 'Application details'}</h1><p>Application information available from the current data source.</p></div></div>
    {loading ? <LoadingState label="Loading application…"/> : error ? <ErrorState error={error} onRetry={() => { setLoading(true); void getApplication(id).then(setApplication).catch(reason => setError({ message: reason.message })).finally(() => setLoading(false)); }}/> : !application ? <EmptyState title="Application not found" action={<Link className="text-link" to="/applications">Back to applications</Link>}>This application may have been removed or the link may be incorrect.</EmptyState> : <section className="panel detail-panel"><div className="detail-head"><div><span className="muted">{application.packageName} · {application.platform}</span><h2>{application.name}</h2></div><RiskBadge status={application.status}/></div><div className="detail-row"><b>Version</b><span>{application.version}</span></div><div className="detail-row"><b>Security score</b><SecurityScore score={application.score}/></div><div className="detail-row"><b>Last scan</b><span>{application.lastScan}</span></div><div className="detail-actions"><Link to="/scans" className="button secondary">View scan history</Link><Link to="/vulnerabilities" className="button secondary">View findings</Link></div><Link to="/applications" className="text-link back-link"><ArrowLeft size={15}/> All applications</Link></section>}
  </>;
}
