import { create } from 'zustand';
import { dataProvider, mockMode } from '@/services/dataProvider';
import { mockProvider } from '@/services/mockProvider';
import { toApiError } from '@/services/api';
import { applicationService } from '@/services/applicationService';
import { uploadService, type UploadedVersion } from '@/services/uploadService';
import { scanService } from '@/services/scanService';
import { dashboardService, type DashboardSummary } from '@/services/dashboardService';
import type { ApiError, Application, Finding, LoadState, ResourceName, ResourceRequest, Scan, ScanStatus, Platform, TrendPoint } from '@/types';

type AppState = {
  applications: Application[];
  findings: Finding[];
  scans: Scan[];
  trend: TrendPoint[];
  dashboardSummary: DashboardSummary | null;
  activeScan: Scan | null;
  uploadStatus: 'idle' | 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'rejected' | 'cancelled';
  uploadProgress: number;
  uploadedVersion: UploadedVersion | null;
  uploadError: string | null;
  requests: Record<ResourceName, ResourceRequest>;
  loadApplications: () => Promise<void>;
  loadFindings: () => Promise<void>;
  loadScans: () => Promise<void>;
  loadScan: (id: string) => Promise<Scan | null>;
  loadTrend: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  getApplication: (id: string) => Promise<Application | null>;
  getFinding: (id: string) => Promise<Finding | null>;
  startDemoScan: (name: string, platform: Platform) => Promise<void>;
  uploadPackage: (input: { applicationId: string | null; newApplication?: { name: string; package_name: string; platform: Platform }; file: File; signal: AbortSignal }) => Promise<{ application: Application; version: UploadedVersion }>;
  cancelQueuedScan: (id: string) => Promise<void>;
  setRequest: (resource: ResourceName, state: LoadState, error?: ApiError | null) => void;
};

const idleRequest: ResourceRequest = { state: 'idle', error: null };

export const useAppStore = create<AppState>((set, get) => ({
  applications: [],
  findings: [],
  scans: [],
  trend: [],
  dashboardSummary: null,
  activeScan: null,
  uploadStatus: 'idle',
  uploadProgress: 0,
  uploadedVersion: null,
  uploadError: null,
  requests: { applications: idleRequest, findings: idleRequest, scans: idleRequest, trend: idleRequest, dashboard: idleRequest },
  setRequest: (resource, state, error = null) => set(current => ({
    requests: { ...current.requests, [resource]: { state, error } },
  })),
  loadApplications: async () => {
    if (get().requests.applications.state === 'loading') return;
    get().setRequest('applications', 'loading');
    try {
      set({ applications: await dataProvider.listApplications() });
      get().setRequest('applications', 'success');
    } catch (error) {
      get().setRequest('applications', 'error', toApiError(error));
    }
  },
  loadFindings: async () => {
    if (get().requests.findings.state === 'loading') return;
    get().setRequest('findings', 'loading');
    try {
      set({ findings: await dataProvider.listFindings() });
      get().setRequest('findings', 'success');
    } catch (error) {
      get().setRequest('findings', 'error', toApiError(error));
    }
  },
  loadScans: async () => {
    if (get().requests.scans.state === 'loading') return;
    get().setRequest('scans', 'loading');
    try {
      set({ scans: await dataProvider.listScans() });
      get().setRequest('scans', 'success');
    } catch (error) {
      get().setRequest('scans', 'error', toApiError(error));
    }
  },
  loadScan: async id => {
    try {
      const scan = await dataProvider.getScan(id);
      if (scan) set({ activeScan: scan });
      return scan;
    } catch (error) { throw toApiError(error); }
  },
  loadTrend: async () => {
    if (get().requests.trend.state === 'loading') return;
    get().setRequest('trend', 'loading');
    try {
      set({ trend: await dataProvider.getTrend() });
      get().setRequest('trend', 'success');
    } catch (error) {
      get().setRequest('trend', 'error', toApiError(error));
    }
  },
  loadDashboard: async () => {
    if (mockMode) { get().setRequest('dashboard', 'success'); return; }
    if (get().requests.dashboard.state === 'loading') return;
    get().setRequest('dashboard', 'loading');
    try {
      set({ dashboardSummary: await dashboardService.summary() });
      get().setRequest('dashboard', 'success');
    } catch (error) { get().setRequest('dashboard', 'error', toApiError(error)); }
  },
  getApplication: async id => {
    const cached = get().applications.find(application => application.id === id);
    if (cached) return cached;
    try { return await dataProvider.getApplication(id); }
    catch (error) { throw toApiError(error); }
  },
  getFinding: async id => {
    const cached = get().findings.find(finding => finding.id === id);
    if (cached) return cached;
    try { return await dataProvider.getFinding(id); }
    catch (error) { throw toApiError(error); }
  },
  startDemoScan: async (name, platform) => {
    if (!mockMode) throw { message: 'Package upload is not connected to the API yet. The file was not sent.' };
    const initial: Scan = { id: `DEMO-${Date.now()}`, app: name, platform, status: 'queued', date: 'Just now', score: null, progress: 0 };
    set({ activeScan: initial, scans: [initial, ...get().scans] });
    mockProvider.upsertScan(initial);
    try {
      await mockProvider.simulateScan(initial.id, name, platform, (status: ScanStatus, progress) => {
        set(state => {
          const scan = state.activeScan ? { ...state.activeScan, status, progress, score: status === 'completed' ? 78 : null } : null;
          if (scan) mockProvider.upsertScan(scan);
          return {
            activeScan: scan,
            scans: scan ? [scan, ...state.scans.filter(item => item.id !== scan.id)] : state.scans,
          };
        });
      });
    } catch (error) {
      const apiError = toApiError(error);
      set(state => ({ activeScan: state.activeScan ? { ...state.activeScan, status: 'failed' } : null }));
      throw apiError;
    }
  },
  uploadPackage: async ({ applicationId, newApplication, file, signal }) => {
    if (mockMode) throw { message: 'API mode is required for server upload.' };
    set({ uploadStatus: 'pending', uploadProgress: 0, uploadedVersion: null, uploadError: null });
    let application: Application | null = null;
    let newlyCreated = false;
    try {
      if (applicationId) {
        application = get().applications.find(item => item.id === applicationId) ?? await applicationService.get(applicationId);
        if (!application) throw { message: 'The selected application could not be found.' };
      } else if (newApplication) {
        application = await applicationService.create(newApplication);
        newlyCreated = true;
        set(state => ({ applications: [application!, ...state.applications.filter(item => item.id !== application!.id)] }));
      } else {
        throw { message: 'Select an application or enter details for a new one.' };
      }
      set({ uploadStatus: 'uploading' });
      const version = await uploadService.upload(application.id, file, uploadProgress => set({
        uploadProgress,
        uploadStatus: uploadProgress >= 100 ? 'processing' : 'uploading',
      }), signal);
      const updatedApplication: Application = {
        ...application,
        version: version.original_filename,
        score: null,
        lastScan: 'No scan yet',
        status: 'New',
      };
      set(state => ({
        uploadStatus: 'completed',
        uploadProgress: 100,
        uploadedVersion: version,
        uploadError: null,
        applications: [updatedApplication, ...state.applications.filter(item => item.id !== updatedApplication.id)],
      }));
      return { application: updatedApplication, version };
    } catch (error) {
      if (newlyCreated && application) {
        try {
          await applicationService.delete(application.id);
          set(state => ({ applications: state.applications.filter(item => item.id !== application!.id) }));
        } catch { /* Keep the upload error; the empty application can be removed later. */ }
      }
      const apiError = toApiError(error);
      const rejected = [400, 404, 409, 413, 415, 422].includes(apiError.status ?? 0);
      set({ uploadStatus: signal.aborted ? 'cancelled' : rejected ? 'rejected' : 'failed', uploadError: signal.aborted ? null : apiError.message });
      throw apiError;
    }
  },
  cancelQueuedScan: async id => {
    const scan = await scanService.cancel(id);
    set(state => ({ activeScan: state.activeScan?.id === id ? scan : state.activeScan, scans: [scan, ...state.scans.filter(item => item.id !== id)] }));
  },
}));
