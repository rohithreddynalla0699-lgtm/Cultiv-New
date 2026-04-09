import {
  loadInternalInventoryDashboard,
  updateInternalInventoryItem,
  type InternalInventoryAdjustmentType,
  type InternalInventoryDashboardResponse,
  type InternalInventoryMutationResponse,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export interface InventoryDashboardResult {
  items: InternalInventoryDashboardResponse['items'];
  adjustments: InternalInventoryDashboardResponse['adjustments'];
}

const sessionPayload = (session: InternalAccessSession) => ({
  internalSessionToken: session.internalSessionToken,
  roleKey: session.roleKey,
  scopeType: session.scopeType === 'store' ? 'store' : 'global',
  scopeStoreId: session.scopeStoreId,
});

export const inventoryService = {
  async fetchInventoryDashboard(session: InternalAccessSession, storeId?: string | null, historyLimit = 20) {
    const { data, error } = await loadInternalInventoryDashboard({
      ...sessionPayload(session),
      storeId,
      historyLimit,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load inventory.');
    }

    return {
      items: data.items,
      adjustments: data.adjustments,
    } satisfies InventoryDashboardResult;
  },

  async mutateInventoryItem(params: {
    session: InternalAccessSession;
    storeId?: string | null;
    inventoryItemId: string;
    adjustmentType: InternalInventoryAdjustmentType;
    amount?: number;
    quantity?: number;
    threshold?: number;
    notes?: string;
  }) {
    const { data, error } = await updateInternalInventoryItem({
      ...sessionPayload(params.session),
      storeId: params.storeId,
      inventoryItemId: params.inventoryItemId,
      adjustmentType: params.adjustmentType,
      amount: params.amount,
      quantity: params.quantity,
      threshold: params.threshold,
      notes: params.notes,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not update inventory.');
    }

    return data satisfies InternalInventoryMutationResponse;
  },
};
