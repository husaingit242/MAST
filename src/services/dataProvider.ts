import { applicationService } from '@/services/applicationService';
import { findingService } from '@/services/findingService';
import { scanService } from '@/services/scanService';
import { isMockMode } from '@/services/api';
import { mockProvider } from '@/services/mockProvider';

export const dataProvider = isMockMode()
  ? mockProvider
  : {
      listApplications: applicationService.list,
      getApplication: applicationService.get,
      listFindings: findingService.list,
      getFinding: findingService.get,
      listScans: scanService.list,
      getScan: scanService.get,
      getTrend: async () => [],
    };

export const mockMode = isMockMode();
