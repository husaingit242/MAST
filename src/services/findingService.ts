import api, { assertApiConfigured } from '@/services/api';
import axios from 'axios';
import type { Finding } from '@/types';

export const findingService = {
  async list(): Promise<Finding[]> {
    assertApiConfigured();
    const response: unknown = (await api.get('/findings')).data;
    if (Array.isArray(response) && response.every(isFinding)) return response;
    if (isRecord(response) && Array.isArray(response.items) && response.items.every(isBackendFinding)) return response.items.map(mapFinding);
    if (isRecord(response) && Array.isArray(response.data) && response.data.every(isFinding)) return response.data;
    throw { message: 'The findings response had an unexpected format.' };
  },
  async get(id: string): Promise<Finding | null> {
    assertApiConfigured();
    try {
      const response: unknown = (await api.get(`/findings/${encodeURIComponent(id)}`)).data;
      const value = isRecord(response) && 'data' in response ? response.data : response;
      if (value === null) return null;
      if (isFinding(value)) return value;
      if (isBackendFinding(value)) return mapFinding(value);
      throw { message: 'The finding response had an unexpected format.' };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  async update(id: string, status: string): Promise<void> {
    assertApiConfigured();
    await api.patch(`/findings/${encodeURIComponent(id)}`, { status });
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFinding(value: unknown): value is Finding {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' &&
    ['Critical', 'High', 'Medium', 'Low', 'Info'].includes(String(value.severity)) && typeof value.category === 'string' &&
    typeof value.app === 'string' && typeof value.file === 'string' && typeof value.description === 'string';
}

interface BackendFinding { id: string; title: string; severity: Finding['severity']; category: string; application_id: string; application_name: string; location: string | null; description: string; recommendation: string | null; status: string; }

function isBackendFinding(value: unknown): value is BackendFinding {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' &&
    ['Critical', 'High', 'Medium', 'Low', 'Info'].includes(String(value.severity)) && typeof value.category === 'string' &&
    typeof value.application_id === 'string' && typeof value.application_name === 'string' && typeof value.description === 'string';
}

function mapFinding(value: BackendFinding): Finding {
  return { id: value.id, title: value.title, severity: value.severity, category: value.category, app: value.application_name,
    applicationId: value.application_id, file: value.location ?? '—', description: value.description, status: value.status, recommendation: value.recommendation };
}
