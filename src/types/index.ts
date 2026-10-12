export type Platform = 'Android' | 'iOS';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
export type ApplicationStatus = 'Secure' | 'At risk' | 'Scanning' | 'New';
export type ScanStatus = 'queued' | 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LoadState = 'idle' | 'loading' | 'success' | 'error';
export type ResourceName = 'applications' | 'scans' | 'findings' | 'trend' | 'dashboard';
export interface TrendPoint { month: string; findings: number; }

export interface Application {
  id: string;
  name: string;
  packageName: string;
  platform: Platform;
  version: string;
  score: number | null;
  lastScan: string;
  status: ApplicationStatus;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  app: string;
  applicationId?: string;
  file: string;
  description: string;
  status?: string;
  recommendation?: string | null;
}

export interface Scan {
  id: string;
  app: string;
  platform: Platform;
  status: ScanStatus;
  date: string;
  score: number | null;
  progress?: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ResourceRequest {
  state: LoadState;
  error: ApiError | null;
}

export interface Notification {
  id: string;
  title: string;
  kind: 'success' | 'error' | 'info';
}
