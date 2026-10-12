import { Check, Info, X, XCircle } from 'lucide-react';
import { useUiStore } from '@/store/useUiStore';

const icons = { success: Check, error: XCircle, info: Info };

export default function NotificationCenter() {
  const notifications = useUiStore(state => state.notifications);
  const dismiss = useUiStore(state => state.dismiss);
  return <div className="notification-center" aria-live="polite" aria-relevant="additions removals">
    {notifications.map(notification => {
      const Icon = icons[notification.kind];
      return <div key={notification.id} className={`notification ${notification.kind}`} role={notification.kind === 'error' ? 'alert' : 'status'}>
        <Icon size={17} aria-hidden="true"/><span>{notification.title}</span>
        <button onClick={() => dismiss(notification.id)} aria-label="Dismiss notification"><X size={15}/></button>
      </div>;
    })}
  </div>;
}
