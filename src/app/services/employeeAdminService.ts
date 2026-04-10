import {
  loadInternalEmployeesDashboard,
  type InternalEmployeeDashboardPeriod,
  upsertInternalEmployee,
  deactivateInternalEmployee,
  deleteInternalEmployee,
  type InternalEmployeeDashboardRow,
  type InternalEmployeesDashboardResponse,
  type InternalEmployeeUpsertResponse,
  type InternalEmployeeDeleteResponse,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

const toScopeType = (scopeType: InternalAccessSession['scopeType']): 'global' | 'store' => (
  scopeType === 'store' ? 'store' : 'global'
);

export interface EmployeeDashboardRow extends InternalEmployeeDashboardRow {}

export interface EmployeeDashboardData extends InternalEmployeesDashboardResponse {}

export interface EmployeeUpsertResult extends InternalEmployeeUpsertResponse {}

export interface EmployeeDeleteResult extends InternalEmployeeDeleteResponse {}

export const employeeAdminService = {
  async loadDashboard(session: InternalAccessSession, period: InternalEmployeeDashboardPeriod): Promise<EmployeeDashboardData> {
    const { data, error } = await loadInternalEmployeesDashboard({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
      period,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load employee dashboard.');
    }

    return data;
  },

  async upsertEmployee(session: InternalAccessSession, input: {
    employeeId?: string;
    name: string;
    role: 'manager' | 'kitchen' | 'counter';
    storeId?: string;
    storeCode?: string;
    pin?: string;
    phone?: string;
    isActive: boolean;
  }): Promise<EmployeeUpsertResult> {
    const { data, error } = await upsertInternalEmployee({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
      ...input,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not save employee.');
    }

    return data;
  },

  async deleteEmployee(session: InternalAccessSession, employeeId: string): Promise<EmployeeDeleteResult> {
    const { data, error } = await deleteInternalEmployee({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
      employeeId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not delete employee.');
    }

    return data;
  },

  async deactivateEmployee(session: InternalAccessSession, employeeId: string): Promise<EmployeeDeleteResult> {
    const { data, error } = await deactivateInternalEmployee({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
      employeeId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not deactivate employee.');
    }

    return data;
  },
};
