import type { Severity } from '@/types';
export default function SeverityBadge({ severity }: { severity: Severity }) { return <span className={`severity ${severity.toLowerCase()}`} aria-label={`Severity: ${severity}`}>{severity}</span>; }
