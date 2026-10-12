import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingState from '@/components/common/LoadingState';
import { mockMode } from '@/services/dataProvider';
import { reportService, type ReportRecord } from '@/services/reportService';
import { toApiError } from '@/services/api';

export default function Reports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(!mockMode);
  const [error, setError] = useState<{ message: string } | null>(null);
  async function load() {
    setLoading(true); setError(null);
    try { setReports(await reportService.list()); }
    catch (reason) { setError(toApiError(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!mockMode) void load(); }, []);
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / OUTPUT</div><h1>Reports</h1><p>Review report records linked to your scans.</p></div></div>
    {mockMode ? <EmptyState title="Report generation is not available in demo mode" action={<Link to="/scans" className="text-link">View scan history</Link>}>The demo dataset does not contain report records.</EmptyState>
      : <section className="panel listing"><div className="panel-heading"><div><h2>Report requests</h2><p>Generation remains deferred; requests are not downloadable.</p></div></div>
        {loading ? <LoadingState label="Loading reports…"/> : error ? <ErrorState error={error} onRetry={() => void load()}/> : !reports.length ? <EmptyState title="No reports available" action={<Link to="/scans" className="text-link">View scan history</Link>}>Create a report request after a scan in a later phase.</EmptyState> : <div className="table-wrap"><table><thead><tr><th scope="col">REPORT</th><th scope="col">SCAN</th><th scope="col">FORMAT</th><th scope="col">STATUS</th><th scope="col">CREATED</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}><td><b>{report.id}</b></td><td>{report.scan_id}</td><td>{report.report_type.toUpperCase()}</td><td>{report.status === 'not_implemented' ? 'Generation not implemented' : report.status}</td><td>{new Date(report.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
      </section>}
  </>;
}
