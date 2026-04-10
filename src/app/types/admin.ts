export type EmployeeShiftStatus = 'on_shift' | 'off_shift';

export type EmployeeRole = 'kitchen' | 'counter' | 'manager';

export interface StoreRecord {
  id: string;
  name: string;
  city: string;
  code: string;
  addressLine1?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  pin: string;
  isActive: boolean;
  createdAt: string;
}

export interface StoreInput {
  name: string;
  city: string;
  code: string;
  addressLine1?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  pin: string;
  isActive: boolean;
}

export interface EmployeeShift {
  id: string;
  employeeId: string;
  storeId: string;
  loginAt: string;
  logoutAt?: string;
  totalHoursWorked: number;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  role: EmployeeRole;
  storeId: string;
  pin: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  status: EmployeeShiftStatus;
  shifts: EmployeeShift[];
}

export interface EmployeeInput {
  name: string;
  role: EmployeeRole;
  storeId: string;
  pin: string;
  phone?: string;
  isActive: boolean;
}

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  inventoryItemId: string;
  code: string;
  storeId: string;
  storeUuid: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  threshold: number;
  status: InventoryStatus;
  updatedAt: string;
  sortOrder?: number;
}

export interface InventoryAdjustmentHistoryItem {
  id: string;
  storeId: string;
  storeUuid: string;
  storeName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  adjustmentType: 'set' | 'add' | 'reduce' | 'threshold_update' | 'receive' | 'manual_correction' | 'out_of_stock' | 'opening_balance';
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  thresholdBefore: number | null;
  thresholdAfter: number | null;
  notes?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export type AdminOrderBoardStatus = 'new' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';

export interface AdminOrderNoteMap {
  [orderId: string]: string;
}

export type StoreScope = 'all' | string;

export type InternalAccessRole = 'owner' | 'admin' | 'store';

export type InternalAccessScopeType = 'global' | 'store';

export interface InternalAccessSession {
  sessionId: string;
  userId: string;
  roleId: string;
  internalSessionToken: string;
  roleKey: InternalAccessRole;
  roleName: string;
  permissionKeys: string[];
  scopeType: InternalAccessScopeType;
  scopeStoreId: string | null;

  loggedInAt: string;
}

export interface AdminPermissions {
  canManageStores: boolean;
  canManageEmployees: boolean;
  canManageMenu: boolean;
  canViewReports: boolean;
  canAccessOrders: boolean;
  canAccessPos: boolean;
  canAccessInventory: boolean;
  canSwitchStores: boolean;
  canViewAllStores: boolean;
}
