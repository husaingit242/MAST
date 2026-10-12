import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function EmptyState({ title, children, action, icon: Icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="empty-state" role="status">
    {Icon && <span className="empty-icon"><Icon size={20}/></span>}
    <h3>{title}</h3>{children && <p>{children}</p>}{action}
  </div>;
}
