import api, { assertApiConfigured } from '@/services/api';
import axios from 'axios';
import type { Application } from '@/types';

interface BackendApplication { id: string; name: string; package_name: string; platform: 'Android' | 'iOS'; status: string; versions: Array<{ version_name: string | null; original_filename?: string }>; }

export const applicationService = {
  async list(): Promise<Application[]> {
    assertApiConfigured();
    const response: unknown = (await api.get('/applications')).data;
    if (Array.isArray(response) && response.every(isApplication)) return response;
    if (isRecord(response) && Array.isArray(response.items) && response.items.every(isBackendApplication)) return response.items.map(mapApplication);
    if (isRecord(response) && Array.isArray(response.data) && response.data.every(isApplication)) return response.data;
    throw { message: 'The applications response had an unexpected format.' };
  },
  async get(id: string): Promise<Application | null> {
    assertApiConfigured();
    try {
      const response: unknown = (await api.get(`/applications/${encodeURIComponent(id)}`)).data;
      const value = isRecord(response) && 'data' in response ? response.data : response;
      if (value === null) return null;
      if (isApplication(value)) return value;
      if (isBackendApplication(value)) return mapApplication(value);
      throw { message: 'The application response had an unexpected format.' };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  async create(input: { name: string; package_name: string; platform: 'Android' | 'iOS' }): Promise<Application> {
    assertApiConfigured();
    const value: unknown = (await api.post('/applications', input)).data;
    if (isBackendApplication(value)) return mapApplication(value);
    throw { message: 'The application response had an unexpected format.' };
  },
  async delete(id: string): Promise<void> {
    assertApiConfigured();
    await api.delete(`/applications/${encodeURIComponent(id)}`);
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApplication(value: unknown): value is Application {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.packageName === 'string' && (value.platform === 'Android' || value.platform === 'iOS') &&
    typeof value.version === 'string' && typeof value.score === 'number' && value.score >= 0 && value.score <= 100 &&
    typeof value.lastScan === 'string' && ['Secure', 'At risk', 'Scanning'].includes(String(value.status));
}

function isBackendApplication(value: unknown): value is BackendApplication {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.package_name === 'string' && (value.platform === 'Android' || value.platform === 'iOS') &&
    Array.isArray(value.versions);
}

function mapApplication(value: BackendApplication): Application {
  return { id: value.id, name: value.name, packageName: value.package_name, platform: value.platform,
    version: value.versions[0]?.version_name ?? value.versions[0]?.original_filename ?? 'Uploaded package', score: null, lastScan: 'No scan yet', status: 'New' };
}
