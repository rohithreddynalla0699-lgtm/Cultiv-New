import {
  listInternalStoreCredentialTargets,
  updateInternalCredential,
  type InternalCredentialUpdateResponse,
  type InternalStoreCredentialTarget,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export interface StoreCredentialTarget extends InternalStoreCredentialTarget {}
export interface CredentialUpdateResult extends InternalCredentialUpdateResponse {}

export const credentialsAdminService = {
  async loadInternalTargets(session: InternalAccessSession, roleFilter: 'admin' | 'store'): Promise<StoreCredentialTarget[]> {
    const { data, error } = await listInternalStoreCredentialTargets({
      internalSessionToken: session.internalSessionToken,
      roleFilter,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load internal login targets.');
    }

    return data.targets;
  },

  async updateEmployeePin(session: InternalAccessSession, employeeId: string, newPin: string): Promise<CredentialUpdateResult> {
    const { data, error } = await updateInternalCredential({
      internalSessionToken: session.internalSessionToken,
      targetType: 'employee',
      targetId: employeeId,
      newPin,
      revokeExistingSessions: false,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not update employee shift PIN.');
    }

    return data;
  },

  async updateStoreLoginPin(session: InternalAccessSession, internalUserId: string, newPin: string): Promise<CredentialUpdateResult> {
    const { data, error } = await updateInternalCredential({
      internalSessionToken: session.internalSessionToken,
      targetType: 'internal_user',
      targetId: internalUserId,
      newPin,
      revokeExistingSessions: true,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not update store login PIN.');
    }

    return data;
  },

  async updateAdminPin(session: InternalAccessSession, internalUserId: string, newPin: string): Promise<CredentialUpdateResult> {
    const { data, error } = await updateInternalCredential({
      internalSessionToken: session.internalSessionToken,
      targetType: 'internal_user',
      targetId: internalUserId,
      newPin,
      revokeExistingSessions: true,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not update admin login PIN.');
    }

    return data;
  },
};
