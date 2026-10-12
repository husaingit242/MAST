import api, { assertApiConfigured } from '@/services/api';

export interface ReportRecord { id: string; scan_id: string; report_type: string; status: string; created_at: string; }
export const reportService = {
  async list(): Promise<ReportRecord[]> {
    assertApiConfigured();
    const response: unknown = (await api.get('/reports')).data;
    if (typeof response === 'object' && response !== null && 'items' in response && Array.isArray(response.items)) return response.items as ReportRecord[];
    throw { message: 'The reports response had an unexpected format.' };
  },
};
