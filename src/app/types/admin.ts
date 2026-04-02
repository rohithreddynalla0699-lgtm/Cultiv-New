export type EmployeeShiftStatus = 'on_shift' | 'off_shift';

export type EmployeeRole = 'kitchen' | 'counter' | 'manager';

export interface StoreRecord {
  id: string;
  name: string;
  city: string;
  code: string;
  pin: string;
  isActive: boolean;
  createdAt: string;
}

export interface StoreInput {
  name: string;
  city: string;
  code: string;
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
  code: string;
  storeId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  threshold: number;
  status: InventoryStatus;
  updatedAt: string;
}

export type AdminOrderBoardStatus = 'new' | 'preparing' | 'ready' | 'picked_up';

export interface AdminOrderNoteMap {
  [orderId: string]: string;
}

export type StoreScope = 'all' | string;

export type InternalAccessRole = 'owner' | 'admin' | 'store';

export interface InternalAccessSession {
  role: InternalAccessRole;
  storeId?: string;
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