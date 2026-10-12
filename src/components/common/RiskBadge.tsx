import type { ApplicationStatus } from '@/types';
export default function RiskBadge({ status }: { status: ApplicationStatus }) { return <span className={`risk ${status === 'Secure' ? 'secure' : status === 'Scanning' ? 'scanning' : status === 'New' ? '' : 'atrisk'}`}><i aria-hidden="true"/>{status}</span>; }
