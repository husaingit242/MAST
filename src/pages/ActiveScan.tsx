import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import ProgressBar from '@/components/common/ProgressBar';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { mockMode } from '@/services/dataProvider';
import { useUiStore } from '@/store/useUiStore';
import Button from '@/components/common/Button';
import { toApiError } from '@/services/api';

const demoStatusCopy = {
  queued: 'Waiting to start…', initializing: 'Preparing the demo…', running: 'Running a UI-only scan simulation…',
  completed: 'Demo flow complete. No security analysis was performed.', failed: 'The demo flow could not be completed.', cancelled: 'The demo flow was cancelled.',
};
const apiStatusCopy = {
  queued: 'Queued. This Phase 1 backend does not have an analysis worker.', initializing: 'An analysis worker is not implemented yet.',
  running: 'A real analyzer is not implemented in this phase.', completed: 'This scan is marked complete by a future worker.',
  failed: 'The scan job reported a failure.', cancelled: 'The queued scan was cancelled.',
};

export default function ActiveScan() {
  const scan = useAppStore(state => state.activeScan);
  const cancelQueuedScan = useAppStore(state => state.cancelQueuedScan);
  const loadScan = useAppStore(state => state.loadScan);
  const notify = useUiStore(state => state.notify);
  const [cancelling, setCancelling] = useState(false);
  const [params] = useSearchParams();
  const requestedScanId = params.get('scan');
  const [loadingRequestedScan, setLoadingRequestedScan] = useState(false);
  const notifiedStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedScanId || scan?.id === requestedScanId) return;
    let active = true;
    setLoadingRequestedScan(true);
    void loadScan(requestedScanId).catch(reason => notify(toApiError(reason).message, 'error')).finally(() => { if (active) setLoadingRequestedScan(false); });
    return () => { active = false; };
  }, [loadScan, notify, requestedScanId, scan?.id]);
  useEffect(() => {
    if (!scan || (scan.status !== 'completed' && scan.status !== 'failed') || notifiedStatus.current === scan.status) return;
    notifiedStatus.current = scan.status;
    notify(scan.status === 'completed' ? 'Demo scan flow completed.' : 'Demo scan flow failed.', scan.status === 'completed' ? 'success' : 'error');
  }, [notify, scan]);
  if (loadingRequestedScan && scan?.id !== requestedScanId) return <LoadingState label="Loading scan status…"/>;
  if (!scan) return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / ANALYSIS</div><h1>Active scan</h1><p>View a scan status here after starting the demo flow.</p></div></div>
    <EmptyState title="No active scan" action={<Link to="/upload" className="button primary">Choose a package</Link>}>Start a demo scan from the upload screen. Packages are not uploaded or analyzed.</EmptyState>
  </>;

  const running = scan.status === 'queued' || scan.status === 'initializing' || scan.status === 'running';
  const StatusIcon = scan.status === 'failed' ? XCircle : running ? LoaderCircle : CheckCircle2;
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / ANALYSIS</div><h1>Active scan</h1><p>{scan.app}</p></div></div>
    {mockMode && <div className="demo-notice" role="note">Demo simulation only: no security checks are run against this package.</div>}
    <section className="panel scan-panel">
      <div className="scan-status"><span className="scan-symbol"><StatusIcon className={running ? 'spin' : ''} size={23}/></span><div><h2>{scan.status[0].toUpperCase() + scan.status.slice(1)}</h2><p>{(mockMode ? demoStatusCopy : apiStatusCopy)[scan.status]}</p></div>{scan.progress !== undefined && <b>{scan.progress}%</b>}</div>
      {mockMode && <ProgressBar value={scan.progress ?? 0} label="Demo workflow progress"/>}
      <div className="scan-checks"><div><CheckCircle2 size={16}/> {mockMode ? 'Package selection' : 'Package stored'} <span>Complete</span></div><div><CheckCircle2 size={16}/> {mockMode ? 'File validation (browser only)' : 'Server-side upload validation'} <span>Complete</span></div><div>{running ? <LoaderCircle className="spin" size={16}/> : scan.status === 'failed' ? <XCircle size={16}/> : <CheckCircle2 size={16}/>} {mockMode ? 'Simulated scan status' : 'Analysis worker (future phase)'} <span>{scan.status}</span></div></div>
      <div className="detail-actions">{!mockMode && scan.status === 'queued' && <Button disabled={cancelling} onClick={() => { setCancelling(true); void cancelQueuedScan(scan.id).then(() => notify('Queued scan cancelled.', 'info')).catch(reason => notify(toApiError(reason).message, 'error')).finally(() => setCancelling(false)); }}>{cancelling ? 'Cancelling…' : 'Cancel queued scan'}</Button>}<Link to="/scans" className="button secondary">View scan history</Link><Link to="/applications" className="button secondary">Applications</Link></div>
    </section>
  </>;
}
