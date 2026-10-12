import api, { assertApiConfigured } from '@/services/api';

export interface UploadedVersion {
  id: string;
  application_id: string;
  original_filename: string;
  file_size: number;
  file_hash: string;
  file_type: 'APK' | 'AAB' | 'IPA' | 'ZIP';
  upload_status: 'completed';
  created_at: string;
}

export const uploadService = {
  async upload(applicationId: string, file: File, onProgress: (percentage: number) => void, signal: AbortSignal): Promise<UploadedVersion> {
    assertApiConfigured();
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<UploadedVersion>(`/applications/${encodeURIComponent(applicationId)}/versions`, form, {
      timeout: 0,
      signal,
      onUploadProgress: event => {
        if (event.total && event.total > 0) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      },
    });
    return response.data;
  },
};
