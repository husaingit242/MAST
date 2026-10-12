import api, { assertApiConfigured } from '@/services/api';

export interface DashboardSummary { applications: number; scans: number; findings: Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>; }
export const dashboardService = {
  async summary(): Promise<DashboardSummary> {
    assertApiConfigured();
    return (await api.get<DashboardSummary>('/dashboard/summary')).data;
  },
};
