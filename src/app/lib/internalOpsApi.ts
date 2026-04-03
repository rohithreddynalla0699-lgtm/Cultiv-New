/// <reference types="vite/client" />

const INTERNAL_LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-login`;
const INTERNAL_ORDERS_LIST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-orders-list`;
const INTERNAL_ORDER_STATUS_UPDATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-order-status-update`;

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
  source_channel: 'app' | 'walk-in' | 'phone';
  order_status: 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';
  store_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payment_method: 'cash' | 'upi' | 'card' | null;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  created_at: string;
  order_items: InternalOrdersListItemRow[];
}

export interface InternalOrdersListResponse {
  orders: InternalOrdersListOrderRow[];
}

export interface InternalOrderStatusUpdateResponse {
  success: boolean;
  orderId: string;
  updatedStatus: 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'pending';
}

export async function loginInternal(params: {
  mode: 'owner' | 'admin' | 'store';
  pin: string;
  storeCode?: string;
}): Promise<{ data: InternalLoginResponse | null; error: string | null }> {
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const response = await fetch(INTERNAL_LOGIN_URL, {
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
      const message = typeof payload.error === 'string' ? payload.error : 'Login failed.';
      return { data: null, error: message };
    }

    return { data: payload as unknown as InternalLoginResponse, error: null };
  } catch {
    return { data: null, error: 'Network error. Please try again.' };
  }
}

export async function listInternalOrders(params: {
  internalSessionToken: string;
  roleKey: InternalOrdersRoleKey;
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  filters?: InternalOrdersListFilters;
}): Promise<{ data: InternalOrdersListResponse | null; error: string | null }> {
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const response = await fetch(INTERNAL_ORDERS_LIST_URL, {
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
      const message = typeof payload.error === 'string' ? payload.error : 'Could not fetch internal orders.';
      return { data: null, error: message };
    }

    return { data: payload as unknown as InternalOrdersListResponse, error: null };
  } catch {
    return { data: null, error: 'Network error. Please try again.' };
  }
}

export async function updateInternalOrderStatus(params: {
  internalSessionToken: string;
  roleKey: InternalOrdersRoleKey;
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  orderId: string;
  nextStatus: 'preparing' | 'ready_for_pickup' | 'completed';
}): Promise<{ data: InternalOrderStatusUpdateResponse | null; error: string | null }> {
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const response = await fetch(INTERNAL_ORDER_STATUS_UPDATE_URL, {
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
      const message = typeof payload.error === 'string' ? payload.error : 'Could not update order status.';
      return { data: null, error: message };
    }

    return { data: payload as unknown as InternalOrderStatusUpdateResponse, error: null };
  } catch {
    return { data: null, error: 'Network error. Please try again.' };
  }
}
