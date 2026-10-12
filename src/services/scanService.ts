import api, { assertApiConfigured } from '@/services/api';
import axios from 'axios';
import type { Scan } from '@/types';

export const scanService = {
  async list(): Promise<Scan[]> {
    assertApiConfigured();
    const response: unknown = (await api.get('/scans')).data;
    if (Array.isArray(response) && response.every(isScan)) return response;
    if (isRecord(response) && Array.isArray(response.items) && response.items.every(isBackendScan)) return response.items.map(mapScan);
    if (isRecord(response) && Array.isArray(response.data) && response.data.every(isScan)) return response.data;
    throw { message: 'The scans response had an unexpected format.' };
  },
  async get(id: string): Promise<Scan | null> {
    assertApiConfigured();
    try {
      const response: unknown = (await api.get(`/scans/${encodeURIComponent(id)}`)).data;
      const value = isRecord(response) && 'data' in response ? response.data : response;
      if (value === null) return null;
      if (isScan(value)) return value;
      if (isBackendScan(value)) return mapScan(value);
      throw { message: 'The scan response had an unexpected format.' };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  async create(input: { application_id: string; application_version_id: string }): Promise<Scan> {
    assertApiConfigured();
    const value: unknown = (await api.post('/scans', input)).data;
    if (isBackendScan(value)) return mapScan(value);
    throw { message: 'The scan response had an unexpected format.' };
  },
  async cancel(id: string): Promise<Scan> {
    assertApiConfigured();
    const value: unknown = (await api.post(`/scans/${encodeURIComponent(id)}/cancel`)).data;
    if (isBackendScan(value)) return mapScan(value);
    throw { message: 'The scan response had an unexpected format.' };
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isScan(value: unknown): value is Scan {
  return isRecord(value) && typeof value.id === 'string' && typeof value.app === 'string' &&
    (value.platform === 'Android' || value.platform === 'iOS') &&
    ['queued', 'initializing', 'running', 'completed', 'failed', 'cancelled'].includes(String(value.status)) &&
    typeof value.date === 'string' && (typeof value.score === 'number' || value.score === null) &&
    (value.progress === undefined || typeof value.progress === 'number');
}

interface BackendScan { id: string; application_name: string; platform: 'Android' | 'iOS'; status: Scan['status']; score: number | null; created_at: string; }

function isBackendScan(value: unknown): value is BackendScan {
  return isRecord(value) && typeof value.id === 'string' && typeof value.application_name === 'string' &&
    (value.platform === 'Android' || value.platform === 'iOS') &&
    ['queued', 'initializing', 'running', 'completed', 'failed', 'cancelled'].includes(String(value.status)) &&
    (typeof value.score === 'number' || value.score === null) && typeof value.created_at === 'string';
}

function mapScan(value: BackendScan): Scan {
  return { id: value.id, app: value.application_name, platform: value.platform, status: value.status,
    date: new Date(value.created_at).toLocaleString(), score: value.score, progress: value.status === 'queued' ? 0 : undefined };
}
