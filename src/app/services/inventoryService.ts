import {
  archiveInternalInventoryItem,
  createInternalInventoryItem,
  deleteInternalInventoryItem,
  loadInternalInventoryDashboard,
  unarchiveInternalInventoryItem,
  updateInternalInventoryItem,
  type InternalInventoryMutationAdjustmentType,
  type InternalInventoryArchiveResponse,
  type InternalInventoryCreateResponse,
  type InternalInventoryDeleteResponse,
  type InternalInventoryDashboardResponse,
  type InternalInventoryMutationResponse,
  type InternalInventoryUnarchiveResponse,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export interface InventoryDashboardResult {
  items: InternalInventoryDashboardResponse['items'];
  archivedItems: InternalInventoryDashboardResponse['archivedItems'];
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
      items: Array.isArray(data.items) ? data.items : [],
      archivedItems: Array.isArray(data.archivedItems) ? data.archivedItems : [],
      adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
    } satisfies InventoryDashboardResult;
  },

  async mutateInventoryItem(params: {
    session: InternalAccessSession;
    storeId?: string | null;
    inventoryItemId: string;
    adjustmentType: InternalInventoryMutationAdjustmentType;
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
    storeId: string;
    inventoryItemId: string;
  }) {
    const { data, error } = await archiveInternalInventoryItem({
      ...sessionPayload(params.session),
      storeId: params.storeId,
      inventoryItemId: params.inventoryItemId,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not archive inventory item.');
    }

    return data satisfies InternalInventoryArchiveResponse;
  },

  async unarchiveInventoryItem(params: {
    session: InternalAccessSession;
    storeId: string;
    inventoryItemId: string;
  }) {
    const { data, error } = await unarchiveInternalInventoryItem({
      ...sessionPayload(params.session),
      storeId: params.storeId,
      inventoryItemId: params.inventoryItemId,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not restore inventory item.');
    }

    return data satisfies InternalInventoryUnarchiveResponse;
  },

  async deleteInventoryItem(params: {
    session: InternalAccessSession;
    storeId: string;
    inventoryItemId: string;
  }) {
    const { data, error } = await deleteInternalInventoryItem({
      ...sessionPayload(params.session),
      storeId: params.storeId,
      inventoryItemId: params.inventoryItemId,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not delete inventory item from this store.');
    }

    return data satisfies InternalInventoryDeleteResponse;
  },
};
