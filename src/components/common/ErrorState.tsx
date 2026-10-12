import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ApiError } from '@/types';
import Button from '@/components/common/Button';

export default function ErrorState({ error, onRetry, children }: { error: ApiError; onRetry?: () => void; children?: ReactNode }) {
  return <div className="feedback-state error-state" role="alert">
    <AlertCircle size={19} aria-hidden="true" />
    <div><b>We couldn’t load this information</b><p>{error.message}</p>{children}</div>
    {onRetry && <Button onClick={onRetry}>Try again</Button>}
  </div>;
}
