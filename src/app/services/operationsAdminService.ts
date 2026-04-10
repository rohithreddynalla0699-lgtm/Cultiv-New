import {
  listManagedInternalUsers,
  upsertManagedStore,
  deactivateManagedStore,
  deleteManagedStore,
  upsertManagedInternalUser,
  deactivateManagedInternalUser,
  deleteManagedInternalUser,
  type ManagedInternalUserRecord,
  type ManagedStoreRecord,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export interface OperationsInternalUserRecord extends ManagedInternalUserRecord {}
export interface OperationsStoreRecord extends ManagedStoreRecord {}

export const operationsAdminService = {
  async loadInternalUsers(session: InternalAccessSession, roleFilter: 'admin' | 'store'): Promise<OperationsInternalUserRecord[]> {
    const { data, error } = await listManagedInternalUsers({
      internalSessionToken: session.internalSessionToken,
      roleFilter,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load internal users.');
    }

    return data.users;
  },

  async saveStore(session: InternalAccessSession, input: {
    targetStoreId?: string;
    name: string;
    city: string;
    code: string;
    addressLine1: string;
    state: string;
    postalCode: string;
    phone?: string;
    isActive: boolean;
    storeLoginFullName?: string;
    storeLoginPin?: string;
    storeLoginIsActive?: boolean;
    storeLoginInternalUserId?: string;
  }) {
    const { data, error } = await upsertManagedStore({
      internalSessionToken: session.internalSessionToken,
      ...input,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not save store.');
    }

    return data;
  },

  async deactivateStore(session: InternalAccessSession, targetStoreId: string) {
    const { data, error } = await deactivateManagedStore({
      internalSessionToken: session.internalSessionToken,
      targetStoreId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not deactivate store.');
    }

    return data;
  },

  async deleteStore(session: InternalAccessSession, targetStoreId: string) {
    const { data, error } = await deleteManagedStore({
      internalSessionToken: session.internalSessionToken,
      targetStoreId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not delete store.');
    }

    return data;
  },

  async saveInternalUser(session: InternalAccessSession, input: {
    internalUserId?: string;
    roleKey: 'admin' | 'store';
    fullName: string;
    storeId?: string;
    pin?: string;
    isActive: boolean;
  }) {
    const { data, error } = await upsertManagedInternalUser({
      internalSessionToken: session.internalSessionToken,
      ...input,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not save internal user.');
    }

    return data;
  },

  async deactivateInternalUser(session: InternalAccessSession, internalUserId: string) {
    const { data, error } = await deactivateManagedInternalUser({
      internalSessionToken: session.internalSessionToken,
      internalUserId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not deactivate internal user.');
    }

    return data;
  },

  async deleteInternalUser(session: InternalAccessSession, internalUserId: string) {
    const { data, error } = await deleteManagedInternalUser({
      internalSessionToken: session.internalSessionToken,
      internalUserId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not delete internal user.');
    }

    return data;
  },
};
