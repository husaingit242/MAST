import { useEffect } from 'react';
import { Activity, ShieldCheck, Bug, Smartphone, ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '@/components/common/StatCard';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingState from '@/components/common/LoadingState';
import RecentApplicationsTable from '@/components/dashboard/RecentApplicationsTable';
import VulnerabilityDistributionChart from '@/components/dashboard/VulnerabilityDistributionChart';
import VulnerabilityTrendChart from '@/components/dashboard/VulnerabilityTrendChart';
import WorkflowGuide from '@/components/dashboard/WorkflowGuide';
import { useAppStore } from '@/store/useAppStore';
import { mockMode } from '@/services/dataProvider';

export default function Dashboard() {
  const applications = useAppStore(state => state.applications);
  const findings = useAppStore(state => state.findings);
  const scans = useAppStore(state => state.scans);
  const trend = useAppStore(state => state.trend);
  const summary = useAppStore(state => state.dashboardSummary);
  const requests = useAppStore(state => state.requests);
  const loadApplications = useAppStore(state => state.loadApplications);
  const loadFindings = useAppStore(state => state.loadFindings);
  const loadScans = useAppStore(state => state.loadScans);
  const loadTrend = useAppStore(state => state.loadTrend);
  const loadDashboard = useAppStore(state => state.loadDashboard);

  useEffect(() => { void loadApplications(); void loadFindings(); void loadScans(); void loadTrend(); void loadDashboard(); }, [loadApplications, loadFindings, loadScans, loadTrend, loadDashboard]);
  const scores = applications.flatMap(app => app.score === null ? [] : [app.score]);
  const averageScore = scores.length ? `${Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)} /100` : '—';
  const openFindings = findings.filter(finding => !finding.status || finding.status.toLowerCase() === 'open');
  const criticalCount = openFindings.filter(finding => finding.severity === 'Critical').length;
  const dashboardFindingCount = summary ? Object.values(summary.findings).reduce((total, count) => total + count, 0) : openFindings.length;
  const dashboardCriticalCount = summary ? summary.findings.critical : criticalCount;
  const dashboardAppsCount = summary?.applications ?? applications.length;
  const dashboardScansCount = summary?.scans ?? scans.length;

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> SECURITY OPERATIONS</div><h1>Good morning, Syed <span>✦</span></h1><p>Here’s what’s happening across your mobile application portfolio.</p></div><Link to="/upload" className="button primary"><Plus size={17}/> Add application</Link></div>
    {mockMode && <div className="demo-notice" role="note">Demo mode: these are sample records. No security analysis is performed.</div>}
    <div className="stats-grid">
      <StatCard label="Applications" value={String(dashboardAppsCount)} detail="Applications in this workspace" icon={Smartphone} tone="blue"/>
      <StatCard label="Average security score" value={averageScore} detail={scores.length ? 'Mean score among listed applications' : 'No analysis scores available'} icon={ShieldCheck} tone="green"/>
      <StatCard label="Findings" value={String(dashboardFindingCount)} detail={`${dashboardCriticalCount} critical in current data`} icon={Bug} tone="orange"/>
      <StatCard label="Scans" value={String(dashboardScansCount)} detail="Runs recorded in scan history" icon={Activity} tone="purple"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel applications-panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Your latest applications</p></div><Link to="/applications" className="text-link">View all <ArrowRight size={15}/></Link></div>
        {requests.applications.state === 'loading' ? <LoadingState label="Loading applications…"/> : requests.applications.error ? <ErrorState error={requests.applications.error} onRetry={() => void loadApplications()}/> : applications.length ? <RecentApplicationsTable/> : <EmptyState title="No applications yet" action={<Link to="/upload" className="text-link">Add your first application <ArrowRight size={14}/></Link>}>Upload a package to see it in this workspace.</EmptyState>}
      </section>
      <section className="panel distribution-panel"><div className="panel-heading"><div><h2>Findings by severity</h2><p>From loaded findings</p></div><span className="period">Current data</span></div>
        {requests.findings.state === 'loading' ? <LoadingState label="Loading findings…"/> : requests.findings.error ? <ErrorState error={requests.findings.error} onRetry={() => void loadFindings()}/> : <VulnerabilityDistributionChart findings={findings}/>}
      </section>
      <section className="panel trend-panel"><div className="panel-heading"><div><h2>Vulnerability trend</h2><p>{mockMode ? 'Illustrative history in mock mode' : 'Historical trend data is not available from the API yet'}</p></div>{mockMode && <span className="trend-note">DEMO</span>}</div>
        {requests.trend.state === 'loading' ? <LoadingState label="Loading trend…"/> : <VulnerabilityTrendChart data={trend}/>}
      </section>
      <section className="panel workflow-panel"><div className="panel-heading"><div><h2>Workspace workflow</h2><p>Current demo experience</p></div></div><WorkflowGuide/></section>
    </div>
  </>;
}
