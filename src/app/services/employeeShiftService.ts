import {
  loadInternalShiftDashboard,
  submitInternalShiftPin,
  type InternalShiftDashboardEmployee,
  type InternalShiftDashboardResponse,
  type InternalShiftToggleResponse,
} from '../lib/internalOpsApi';
import type { EmployeeRole, InternalAccessSession } from '../types/admin';

export type ShiftAction = 'clock_in' | 'clock_out';

export interface ShiftDashboardEmployee extends InternalShiftDashboardEmployee {}

export interface ShiftDashboardData extends InternalShiftDashboardResponse {}

export interface ShiftToggleResult extends InternalShiftToggleResponse {}

const toShiftScopeType = (scopeType: InternalAccessSession['scopeType']): 'global' | 'store' => (
  scopeType === 'store' ? 'store' : 'global'
);

export const employeeShiftService = {
  getRoleForSession(role: EmployeeRole) {
    return role === 'manager' ? 'store_manager' : 'staff';
  },

  async loadDashboard(session: InternalAccessSession): Promise<ShiftDashboardData> {
    const { data, error } = await loadInternalShiftDashboard({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toShiftScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load shift dashboard.');
    }

    return data;
  },

  async submitPin(session: InternalAccessSession, employeeId: string, pin: string): Promise<ShiftToggleResult> {
    const { data, error } = await submitInternalShiftPin({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: toShiftScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId,
      employeeId,
      pin,
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not submit employee PIN.');
    }

    return data;
  },
};