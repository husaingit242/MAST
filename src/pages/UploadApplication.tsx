import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, FileArchive, ShieldCheck, Upload, X } from 'lucide-react';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import ProgressBar from '@/components/common/ProgressBar';
import { validatePackageFile, allowedPackageExtensions } from '@/services/fileValidation';
import { mockMode } from '@/services/dataProvider';
import { toApiError } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useUiStore } from '@/store/useUiStore';
import type { Platform } from '@/types';

const accept = allowedPackageExtensions.join(',');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadApplication() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [createApplication, setCreateApplication] = useState(false);
  const [name, setName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [platform, setPlatform] = useState<Platform>('Android');
  const [success, setSuccess] = useState<{ applicationId: string; applicationName: string; versionId: string; filename: string; fileType: string; size: number; hash: string; createdAt: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const abortController = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const applications = useAppStore(state => state.applications);
  const request = useAppStore(state => state.requests.applications);
  const loadApplications = useAppStore(state => state.loadApplications);
  const uploadPackage = useAppStore(state => state.uploadPackage);
  const startDemoScan = useAppStore(state => state.startDemoScan);
  const uploadStatus = useAppStore(state => state.uploadStatus);
  const uploadProgress = useAppStore(state => state.uploadProgress);
  const uploadError = useAppStore(state => state.uploadError);
  const notify = useUiStore(state => state.notify);
  const busy = uploadStatus === 'pending' || uploadStatus === 'uploading' || uploadStatus === 'processing';

  useEffect(() => {
    if (!mockMode) void loadApplications();
  }, [loadApplications]);

  function selectFile(candidate?: File) {
    setError(null);
    setSuccess(null);
    if (!candidate) return;
    const validationError = validatePackageFile(candidate);
    if (validationError) {
      setFile(null);
      setError(validationError);
      notify(validationError, 'error');
      if (input.current) input.current.value = '';
      return;
    }
    setFile(candidate);
    notify('Package selected. The server will perform its own validation.', 'info');
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) { selectFile(event.currentTarget.files?.[0]); }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) selectFile(event.dataTransfer.files[0]);
  }

  async function submitUpload() {
    if (!file) return;
    if (mockMode) {
      const demoPlatform: Platform = file.name.toLowerCase().endsWith('.ipa') ? 'iOS' : 'Android';
      void startDemoScan(file.name, demoPlatform).catch(reason => notify(toApiError(reason).message, 'error'));
      notify('Mock demo only: this file was not uploaded, executed, or analyzed.', 'info');
      navigate('/active-scan');
      return;
    }

    if (createApplication && (!name.trim() || !packageName.trim())) {
      setError('Enter an application name and package identifier.');
      return;
    }
    if (!createApplication && !applicationId) {
      setError('Select an application or create a new one.');
      return;
    }

    const controller = new AbortController();
    abortController.current = controller;
    setError(null);
    try {
      const result = await uploadPackage({
        applicationId: createApplication ? null : applicationId,
        newApplication: createApplication ? { name: name.trim(), package_name: packageName.trim(), platform } : undefined,
        file,
        signal: controller.signal,
      });
      setSuccess({
        applicationId: result.application.id,
        applicationName: result.application.name,
        versionId: result.version.id,
        filename: result.version.original_filename,
        fileType: result.version.file_type,
        size: result.version.file_size,
        hash: result.version.file_hash,
        createdAt: result.version.created_at,
      });
      notify('Application package uploaded and stored.', 'success');
    } catch (reason) {
      if (controller.signal.aborted) {
        notify('Upload cancelled.', 'info');
      } else {
        const message = toApiError(reason).message;
        setError(message);
        notify(message, 'error');
      }
    } finally {
      abortController.current = null;
    }
  }

  function cancelUpload() { abortController.current?.abort(); }

  const selectedApplication = applications.find(application => application.id === applicationId);

  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE / APPLICATION INTAKE</div><h1>Add an application</h1><p>Upload a package to private storage. Uploading does not start a security scan.</p></div></div>
    <section className="panel upload-panel">
      <label className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <input ref={input} className="drop-input" type="file" accept={accept} onChange={onChange} disabled={busy} aria-label="Choose an APK, IPA, AAB, or ZIP package"/>
        <span className="upload-icon"><Upload size={22}/></span><b>{file ? file.name : 'Drop your application package here'}</b>
        <span>{file ? `${formatBytes(file.size)} · Ready for server validation` : <>or <u>browse files</u> on your device</>}</span>
        <small>Allowed: APK, AAB, IPA, ZIP · Server limit: 500 MB by default</small>
      </label>

      {!mockMode && <div className="upload-metadata">
        <label>Application association<select value={createApplication ? '__new__' : applicationId} onChange={event => {
          const value = event.target.value;
          setCreateApplication(value === '__new__');
          setApplicationId(value === '__new__' ? '' : value);
          setError(null);
        }} disabled={busy}>
          <option value="">{request.state === 'loading' ? 'Loading applications…' : 'Select an existing application'}</option>
          {applications.map(application => <option key={application.id} value={application.id}>{application.name} · {application.platform}</option>)}
          <option value="__new__">Create a new application</option>
        </select></label>
        {createApplication && <>
          <label>Application name<input value={name} onChange={event => setName(event.target.value)} maxLength={120} required disabled={busy}/></label>
          <label>Package identifier<input value={packageName} onChange={event => setPackageName(event.target.value)} placeholder="com.example.mobile" maxLength={255} required disabled={busy}/></label>
          <label>Platform<select value={platform} onChange={event => setPlatform(event.target.value as Platform)} disabled={busy}><option>Android</option><option>iOS</option></select></label>
        </>}
        {!createApplication && selectedApplication && <p className="upload-selected-app">Selected: <strong>{selectedApplication.name}</strong> · {selectedApplication.platform}</p>}
      </div>}

      {request.state === 'error' && !mockMode && <p className="upload-error" role="alert">{request.error?.message ?? 'Applications could not be loaded.'}</p>}
      {(error || (!mockMode && uploadError)) && <p className="upload-error" role="alert">{error ?? uploadError}</p>}

      {busy && <div className="upload-progress" aria-live="polite">
        {uploadStatus === 'pending' ? <p>Preparing secure upload…</p> : uploadStatus === 'processing' ? <ProgressBar value={uploadProgress} label="Upload received · Validating and finalizing…"/> : <ProgressBar value={uploadProgress} label={uploadProgress > 0 ? `Uploading… ${uploadProgress}%` : 'Uploading package…'}/>}
        {uploadStatus === 'uploading' && <Button variant="secondary" onClick={cancelUpload}><X size={14}/> Cancel upload</Button>}
      </div>}

      {success && <div className="upload-success" role="status">
        <div className="upload-success-title"><CheckCircle2 size={18}/><strong>Upload successful</strong><span>Stored · {success.fileType}</span></div>
        <dl>
          <div><dt>Application</dt><dd>{success.applicationName}</dd></div>
          <div><dt>File</dt><dd>{success.filename}</dd></div>
          <div><dt>Size</dt><dd>{formatBytes(success.size)}</dd></div>
          <div><dt>SHA-256</dt><dd><code>{success.hash}</code></dd></div>
          <div><dt>Uploaded</dt><dd>{new Date(success.createdAt).toLocaleString()}</dd></div>
        </dl>
        <Button variant="secondary" onClick={() => navigate(`/application/${encodeURIComponent(success.applicationId)}`)}>View application</Button>
      </div>}

      {mockMode && <div className="upload-info"><ShieldCheck size={18}/><span>Mock mode is on. Client-side checks are guidance only; this file stays in your browser and is not uploaded. The demo button runs an illustrative local status flow only.</span></div>}
      {!mockMode && <div className="upload-info"><ShieldCheck size={18}/><span>The API authenticates you, verifies application ownership, validates package content and size, computes SHA-256, and stores the file privately. No package is executed, extracted, or analyzed.</span></div>}
      {mockMode && applications.length === 0 && <EmptyState title="API upload is not connected in mock mode" icon={FileArchive}>Switch VITE_USE_MOCK_DATA to false and sign in to upload a package to the backend.</EmptyState>}

      {mockMode
        ? <Button variant="primary" disabled={!file} onClick={() => void submitUpload()}>Run mock demo</Button>
        : <Button variant="primary" disabled={!file || busy || (!createApplication && !applicationId) || (createApplication && (!name.trim() || !packageName.trim()))} onClick={() => void submitUpload()}>{uploadStatus === 'completed' ? 'Upload another package' : busy ? 'Upload in progress…' : 'Upload package'}</Button>}
      {success && <Link className="text-link upload-another" to="/applications">View all applications</Link>}
    </section>
  </>;
}
