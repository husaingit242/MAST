import { applications, findings, scans, vulnerabilityTrend } from '@/data/mockData';
import type { Application, Finding, Platform, Scan, ScanStatus, TrendPoint } from '@/types';

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
const demoScans = [...scans];

function upsertScan(scan: Scan): void {
  const index = demoScans.findIndex(item => item.id === scan.id);
  if (index >= 0) demoScans[index] = scan;
  else demoScans.unshift(scan);
}

export const mockProvider = {
  async listApplications(): Promise<Application[]> { return applications; },
  async getApplication(id: string): Promise<Application | null> { return applications.find(app => app.id === id) ?? null; },
  async listFindings(): Promise<Finding[]> { return findings; },
  async getFinding(id: string): Promise<Finding | null> { return findings.find(finding => finding.id === id) ?? null; },
  async listScans(): Promise<Scan[]> { return [...demoScans]; },
  async getScan(id: string): Promise<Scan | null> { return demoScans.find(scan => scan.id === id) ?? null; },
  async getTrend(): Promise<TrendPoint[]> { return vulnerabilityTrend; },
  upsertScan,
  async simulateScan(
    id: string,
    name: string,
    platform: Platform,
    onStatus: (status: ScanStatus, progress: number) => void,
  ): Promise<Scan> {
    onStatus('queued', 0);
    await wait(350);
    onStatus('initializing', 12);
    await wait(450);
    onStatus('running', 42);
    await wait(750);
    onStatus('running', 78);
    await wait(550);
    const scan: Scan = {
      id,
      app: name,
      platform,
      status: 'completed',
      date: 'Just now',
      score: 78,
      progress: 100,
    };
    upsertScan(scan);
    onStatus('completed', 100);
    return scan;
  },
};
