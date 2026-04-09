// --- Missing API response types for status update and shift toggle ---
export interface InternalOrderStatusUpdateResponse {
  success: boolean;
  orderId: string;
  updatedStatus: 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'pending';
}

export interface InternalShiftToggleResponse {
  success: boolean;
  employeeId: string;
  shiftId: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: 'on_shift' | 'off_shift';
}
/// <reference types="vite/client" />

const INTERNAL_LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-login`;
const INTERNAL_ORDERS_LIST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-orders-list`;
const INTERNAL_ORDER_STATUS_UPDATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-order-status-update`;
const INTERNAL_SHIFT_CONTROL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-shift-control`;
const INTERNAL_EMPLOYEES_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-employees`;
const INTERNAL_INVENTORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-inventory`;
const INTERNAL_MENU_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-menu`;

export interface InternalLoginResponse {
  userId: string;
  roleKey: 'owner' | 'admin' | 'store';
  permissionKeys: string[];
  scopeType: 'owner' | 'admin' | 'store';
  scopeStoreId: string | null;
  expiresAt: string;
  internalSessionToken: string;
}

export type InternalOrdersRoleKey = 'owner' | 'admin' | 'store';

export interface InternalOrdersListFilters {
  date?: {
    from?: string;
    to?: string;
  };
  orderType?: 'online' | 'walk_in' | 'phone' | 'all';
  search?: string;
  status?: 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'all';
}

export interface InternalOrdersListSelectionRow {
  order_item_selection_id: string;
  order_item_id: string;
  group_name_snapshot: string;
  option_name: string;
}

export interface InternalOrdersListItemRow {
  order_item_id: string;
  order_id: string;
  item_name: string;
  item_category: string;
  unit_price: number;
  quantity: number;
  order_item_selections: InternalOrdersListSelectionRow[];
}

export interface InternalOrdersListOrderRow {
  order_id: string;
  order_type: 'online' | 'walk_in' | 'phone';
  source_channel: 'app' | 'walk_in' | 'walk-in' | 'phone';
  order_status: 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';
  store_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  payment_method: 'cash' | 'upi' | 'card' | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  tip_amount: number;
  total_amount: number;
  created_at: string;
  order_items: InternalOrdersListItemRow[];
  cancellation_reason?: string;
}

export interface InternalOrdersListResponse {
  orders: InternalOrdersListOrderRow[];
  orderId: string;
  updatedStatus: 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'pending';
}

export interface InternalShiftDashboardEmployee {
  employeeId: string;
  name: string;
  role: 'manager' | 'kitchen' | 'counter';
  status: 'on_shift' | 'off_shift';
  clockInAt: string | null;
  todayHours: number;
  weekHours: number;
  monthHours: number;
}


export interface InternalShiftDashboardResponse {
  employees: InternalShiftDashboardEmployee[];
  currentlyOnShift: number;
}


export interface InternalEmployeeDashboardShift {
  shiftId: string;
  shiftDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  totalHours: number;
}

export type InternalEmployeeDashboardPeriod = 'this_week' | 'last_week' | 'this_month' | 'last_month';

export interface InternalEmployeeDashboardRow {
  employeeId: string;
  name: string;
  role: 'manager' | 'kitchen' | 'counter';
  storeId: string;
  storeCode: string;
  isActive: boolean;
  phone: string | null;
    shiftStatus: 'on_shift' | 'off_shift';
    summaryLabel: string;
    summaryHours: number;
    todayHours: number;
    weekHours: number;
    monthHours: number;
    recentShifts: InternalEmployeeDashboardShift[];
}

export interface InternalEmployeesDashboardResponse {
  employees: InternalEmployeeDashboardRow[];
}

export interface InternalEmployeeUpsertResponse {
  employeeId: string;
  name: string;
  role: 'manager' | 'kitchen' | 'counter';
  storeId: string;
  isActive: boolean;
}

export interface InternalEmployeeDeleteResponse {
  success: boolean;
  message: string;
}

export type InternalInventoryAdjustmentType =
  | 'set'
  | 'add'
  | 'reduce'
  | 'threshold_update'
  | 'receive'
  | 'manual_correction'
  | 'out_of_stock';

export interface InternalInventoryDashboardItem {
  storeInventoryId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  inventoryItemId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  threshold: number;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface InternalInventoryAdjustmentRow {
  adjustmentId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  adjustmentType: InternalInventoryAdjustmentType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  thresholdBefore: number | null;
  thresholdAfter: number | null;
  notes: string | null;
  actorInternalUserId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface InternalInventoryDashboardResponse {
  items: InternalInventoryDashboardItem[];
  adjustments: InternalInventoryAdjustmentRow[];
}

export interface InternalInventoryMutationResponse {
  success: boolean;
  item: InternalInventoryDashboardItem;
  adjustment: InternalInventoryAdjustmentRow;
}

export interface InternalMenuOptionGroup {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number | null;
  sortOrder: number;
}

export interface InternalMenuDashboardItem {
  menuItemId: string;
  categorySlug: string;
  subcategorySlug: string | null;
  name: string;
  description: string | null;
  basePrice: number;
  isAvailable: boolean;
  sortOrder: number;
  imageUrl: string | null;
  calories: number | null;
  proteinGrams: number | null;
  badge: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  optionGroupIds: string[];
  optionGroupCount: number;
}

export interface InternalMenuDashboardResponse {
  items: InternalMenuDashboardItem[];
  optionGroups: InternalMenuOptionGroup[];
}

export interface InternalMenuMutationResponse {
  success: boolean;
  mode: 'created' | 'updated' | 'deleted' | 'soft_disabled';
  item?: InternalMenuDashboardItem;
  menuItemId?: string;
}

const postInternal = async <TResponse>(
  url: string,
  params: Record<string, unknown>,
  fallbackMessage: string
): Promise<{ data: TResponse | null; error: string | null }> => {
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(params),
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof payload.error === 'string' ? payload.error : fallbackMessage;
      return { data: null, error: message };
    }

    return { data: payload as unknown as TResponse, error: null };
  } catch {
    return { data: null, error: 'Network error. Please try again.' };
  }
};

export async function loginInternal(params: {
  mode: 'owner' | 'admin' | 'store';
  pin: string;
  storeCode?: string;
}): Promise<{ data: InternalLoginResponse | null; error: string | null }> {
  return postInternal<InternalLoginResponse>(INTERNAL_LOGIN_URL, params, 'Login failed.');
}

export async function listInternalOrders(params: {
  internalSessionToken: string;
  roleKey: InternalOrdersRoleKey;
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  filters?: InternalOrdersListFilters;
}): Promise<{ data: InternalOrdersListResponse | null; error: string | null }> {
  const cleanFilters = (obj: unknown): Record<string, unknown> => {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      out[key] = value;
    }

    return out;
  };

  const cleanedFilters = cleanFilters(params.filters ?? {});
  const sessionToken = params.internalSessionToken;

  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const response = await fetch(INTERNAL_ORDERS_LIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        ...params,
        filters: cleanedFilters,
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`Failed to fetch internal orders list: ${response.status} ${rawText}`);
    }

    const parsed = JSON.parse(rawText) as InternalOrdersListResponse;

    return {
      data: parsed,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error. Please try again.';
    return { data: null, error: message };
  }
}

export async function updateInternalOrderStatus(params: {
  internalSessionToken: string;
  roleKey: InternalOrdersRoleKey;
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  orderId: string;
  nextStatus: 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';
  cancellationReason?: string;
}): Promise<{ data: InternalOrderStatusUpdateResponse | null; error: string | null }> {
  return postInternal<InternalOrderStatusUpdateResponse>(
    INTERNAL_ORDER_STATUS_UPDATE_URL,
    params,
    'Could not update order status.'
  );
}

export async function loadInternalShiftDashboard(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
}): Promise<{ data: InternalShiftDashboardResponse | null; error: string | null }> {
  return postInternal<InternalShiftDashboardResponse>(
    INTERNAL_SHIFT_CONTROL_URL,
    { ...params, action: 'dashboard' },
    'Could not load shift dashboard.'
  );
}

export async function submitInternalShiftPin(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  employeeId: string;
  pin: string;
}): Promise<{ data: InternalShiftToggleResponse | null; error: string | null }> {
  return postInternal<InternalShiftToggleResponse>(
    INTERNAL_SHIFT_CONTROL_URL,
    { ...params, action: 'submit_pin' },
    'Could not submit employee PIN.'
  );
}

export async function loadInternalEmployeesDashboard(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  period: InternalEmployeeDashboardPeriod;
}): Promise<{ data: InternalEmployeesDashboardResponse | null; error: string | null }> {
  return postInternal<InternalEmployeesDashboardResponse>(
    INTERNAL_EMPLOYEES_URL,
    { ...params, action: 'dashboard' },
    'Could not load employee dashboard.'
  );
}

export async function upsertInternalEmployee(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  employeeId?: string;
  name: string;
  role: 'manager' | 'kitchen' | 'counter';
  storeId?: string;
  storeCode?: string;
  pin?: string;
  phone?: string;
  isActive: boolean;
}): Promise<{ data: InternalEmployeeUpsertResponse | null; error: string | null }> {
  return postInternal<InternalEmployeeUpsertResponse>(
    INTERNAL_EMPLOYEES_URL,
    { ...params, action: 'upsert_employee' },
    'Could not save employee.'
  );
}

export async function deleteInternalEmployee(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  employeeId: string;
}): Promise<{ data: InternalEmployeeDeleteResponse | null; error: string | null }> {
  return postInternal<InternalEmployeeDeleteResponse>(
    INTERNAL_EMPLOYEES_URL,
    { ...params, action: 'delete_employee' },
    'Could not delete employee.'
  );
}

export async function loadInternalInventoryDashboard(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  storeId?: string | null;
  historyLimit?: number;
}): Promise<{ data: InternalInventoryDashboardResponse | null; error: string | null }> {
  return postInternal<InternalInventoryDashboardResponse>(
    INTERNAL_INVENTORY_URL,
    { ...params, action: 'dashboard' },
    'Could not load inventory dashboard.'
  );
}

export async function updateInternalInventoryItem(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  storeId?: string | null;
  inventoryItemId: string;
  adjustmentType: InternalInventoryAdjustmentType;
  amount?: number;
  quantity?: number;
  threshold?: number;
  notes?: string;
}): Promise<{ data: InternalInventoryMutationResponse | null; error: string | null }> {
  return postInternal<InternalInventoryMutationResponse>(
    INTERNAL_INVENTORY_URL,
    { ...params, action: 'adjust_item' },
    'Could not update inventory.'
  );
}

export async function loadInternalMenuDashboard(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
}): Promise<{ data: InternalMenuDashboardResponse | null; error: string | null }> {
  return postInternal<InternalMenuDashboardResponse>(
    INTERNAL_MENU_URL,
    { ...params, action: 'dashboard' },
    'Could not load menu dashboard.'
  );
}

export async function upsertInternalMenuItem(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  menuItemId?: string;
  name: string;
  description?: string | null;
  categorySlug: string;
  subcategorySlug?: string | null;
  basePrice: number;
  isAvailable?: boolean;
  sortOrder?: number;
  imageUrl?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  badge?: string | null;
  optionGroupIds?: string[];
}): Promise<{ data: InternalMenuMutationResponse | null; error: string | null }> {
  return postInternal<InternalMenuMutationResponse>(
    INTERNAL_MENU_URL,
    { ...params, action: 'upsert_item' },
    'Could not save menu item.'
  );
}

export async function setInternalMenuItemAvailability(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  menuItemId: string;
  isAvailable: boolean;
}): Promise<{ data: InternalMenuMutationResponse | null; error: string | null }> {
  return postInternal<InternalMenuMutationResponse>(
    INTERNAL_MENU_URL,
    { ...params, action: 'set_availability' },
    'Could not update menu item availability.'
  );
}

export async function deleteInternalMenuItem(params: {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  menuItemId: string;
}): Promise<{ data: InternalMenuMutationResponse | null; error: string | null }> {
  return postInternal<InternalMenuMutationResponse>(
    INTERNAL_MENU_URL,
    { ...params, action: 'delete_item' },
    'Could not delete menu item.'
  );
}
