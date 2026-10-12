import { LoaderCircle } from 'lucide-react';
export default function LoadingState({ label = 'Loading…' }: { label?: string }) { return <div className="loading-state" role="status" aria-live="polite"><LoaderCircle size={17} className="spin" aria-hidden="true"/>{label}</div>; }
