import { loadInternalReports, type InternalReportsSummary } from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export const reportsService = {
  async loadDashboard(session: InternalAccessSession, storeId?: string | null): Promise<InternalReportsSummary> {
    const { data, error } = await loadInternalReports({
      internalSessionToken: session.internalSessionToken,
      storeId,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not load reports.');
    }

    return data.summary;
  },
};
