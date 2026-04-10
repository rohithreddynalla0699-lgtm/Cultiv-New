import {
  archiveInternalInventoryItem,
  createInternalInventoryItem,
  loadInternalInventoryDashboard,
  updateInternalInventoryItem,
  type InternalInventoryAdjustmentType,
  type InternalInventoryArchiveResponse,
  type InternalInventoryCreateResponse,
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
} satisfies {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
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

  async createInventoryItem(params: {
    session: InternalAccessSession;
    storeId: string;
    name: string;
    category: string;
    unit: string;
    threshold: number;
    initialQuantity?: number;
  }) {
    const { data, error } = await createInternalInventoryItem({
      ...sessionPayload(params.session),
      storeId: params.storeId,
      name: params.name,
      category: params.category,
      unit: params.unit,
      threshold: params.threshold,
      initialQuantity: params.initialQuantity,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not create inventory item.');
    }

    return data satisfies InternalInventoryCreateResponse;
  },

  async archiveInventoryItem(params: {
    session: InternalAccessSession;
    inventoryItemId: string;
  }) {
    const { data, error } = await archiveInternalInventoryItem({
      ...sessionPayload(params.session),
      inventoryItemId: params.inventoryItemId,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not archive inventory item.');
    }

    return data satisfies InternalInventoryArchiveResponse;
  },
};
