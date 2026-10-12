import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import RiskBadge from '@/components/common/RiskBadge';
import SecurityScore from '@/components/common/SecurityScore';

export default function RecentApplicationsTable() {
  const applications = useAppStore(state => state.applications);
  return <div className="table-wrap"><table><thead><tr><th scope="col">APPLICATION</th><th scope="col">PLATFORM</th><th scope="col">SECURITY SCORE</th><th scope="col">LAST SCAN</th><th scope="col">STATUS</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{applications.slice(0, 4).map(app => <tr key={app.id}>
    <td><div className="app-cell"><span className="app-icon" aria-hidden="true">{app.platform === 'Android' ? 'A' : '●'}</span><span><b>{app.name}</b><small>{app.packageName}</small></span></div></td>
    <td>{app.platform} <span className="muted">· {app.version}</span></td><td><SecurityScore score={app.score}/></td><td>{app.lastScan}</td><td><RiskBadge status={app.status}/></td>
    <td><Link aria-label={`Open details for ${app.name}`} className="arrow-link" to={`/application/${encodeURIComponent(app.id)}`}><ArrowUpRight size={16}/></Link></td>
  </tr>)}</tbody></table></div>;
}
