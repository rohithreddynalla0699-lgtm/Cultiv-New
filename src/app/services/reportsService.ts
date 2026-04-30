import { loadInternalReports, type InternalReportsSummary } from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export const reportsService = {
  async loadDashboard(
    session: InternalAccessSession,
    params?: {
      storeId?: string | null;
      dateRange?: {
        from?: string | null;
        to?: string | null;
        label?: string;
        preset?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
      } | null;
    },
  ): Promise<InternalReportsSummary> {
    const { data, error } = await loadInternalReports({
      internalSessionToken: session.internalSessionToken,
      storeId: params?.storeId,
      dateRange: params?.dateRange ?? null,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not load reports.');
    }

    return data.summary;
  },
};
