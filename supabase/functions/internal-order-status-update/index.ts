// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type OrderStatus = 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';

type NextStatus = 'preparing' | 'ready_for_pickup' | 'completed';

interface InternalOrderStatusUpdateRequest {
  internalSessionToken?: string;
  roleKey?: RoleKey;
  scopeType?: ScopeType;
  scopeStoreId?: string | null;
  orderId?: string;
  nextStatus?: NextStatus;
}

interface InternalSessionContext {
  internalSessionToken: string;
  roleKey: RoleKey;
  scopeType: ScopeType;
  scopeStoreId: string | null;
}

interface OrderStatusRow {
  order_id: string;
  order_status: OrderStatus;
  store_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const ALLOWED_NEXT_STATUS: Record<'placed' | 'preparing' | 'ready_for_pickup', NextStatus> = {
  placed: 'preparing',
  preparing: 'ready_for_pickup',
  ready_for_pickup: 'completed',
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const normalizeScopeType = (scopeType: ScopeType | undefined, roleKey: RoleKey): ScopeType => {
  if (scopeType === 'store' || scopeType === 'global' || scopeType === 'owner' || scopeType === 'admin') {
    return scopeType;
  }
  if (roleKey === 'store') return 'store';
  return 'global';
};

const normalizeSessionPayload = (body: InternalOrderStatusUpdateRequest): { value?: InternalSessionContext; error?: string } => {
  const internalSessionToken = (body.internalSessionToken ?? '').trim();
  const roleKey = body.roleKey;
  const scopeStoreId = body.scopeStoreId ?? null;

  if (!internalSessionToken) {
    return { error: 'internalSessionToken is required.' };
  }

  if (roleKey !== 'owner' && roleKey !== 'admin' && roleKey !== 'store') {
    return { error: 'roleKey must be one of owner, admin, or store.' };
  }

  const scopeType = normalizeScopeType(body.scopeType, roleKey);
  const isStoreScope = scopeType === 'store' || roleKey === 'store';
  if (isStoreScope && !scopeStoreId) {
    return { error: 'scopeStoreId is required for store scope.' };
  }

  return {
    value: {
      internalSessionToken,
      roleKey,
      scopeType,
      scopeStoreId,
    },
  };
};

const normalizeUpdatePayload = (body: InternalOrderStatusUpdateRequest): { orderId?: string; nextStatus?: NextStatus; error?: string } => {
  const orderId = (body.orderId ?? '').trim();
  const nextStatus = body.nextStatus;

  if (!orderId) {
    return { error: 'orderId is required.' };
  }

  if (nextStatus !== 'preparing' && nextStatus !== 'ready_for_pickup' && nextStatus !== 'completed') {
    return { error: 'nextStatus must be one of preparing, ready_for_pickup, completed.' };
  }

  return { orderId, nextStatus };
};

// Temporary phase: trust payload. Next phase should validate token against
// server-side internal session state and enforce expiry/revocation.
const verifyInternalSession = async (_ctx: InternalSessionContext) => {
  return { valid: true as const };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { success: false, error: 'Server is not configured for internal order status updates.' });
  }

  let body: InternalOrderStatusUpdateRequest;
  try {
    body = (await req.json()) as InternalOrderStatusUpdateRequest;
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body.' });
  }

  const normalizedSession = normalizeSessionPayload(body);
  if (normalizedSession.error || !normalizedSession.value) {
    return json(400, { success: false, error: normalizedSession.error ?? 'Invalid session payload.' });
  }

  const normalizedUpdate = normalizeUpdatePayload(body);
  if (normalizedUpdate.error || !normalizedUpdate.orderId || !normalizedUpdate.nextStatus) {
    return json(400, { success: false, error: normalizedUpdate.error ?? 'Invalid update payload.' });
  }

  const verifyResult = await verifyInternalSession(normalizedSession.value);
  if (!verifyResult.valid) {
    return json(401, { success: false, error: 'Invalid internal session.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { roleKey, scopeType, scopeStoreId } = normalizedSession.value;
  const { orderId, nextStatus } = normalizedUpdate;

  const isStoreScope = scopeType === 'store' || roleKey === 'store';

  const { data: orderRow, error: orderReadError } = await db
    .from('orders')
    .select('order_id, order_status, store_id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (orderReadError) {
    return json(500, { success: false, error: 'Could not load order for status update.' });
  }

  if (!orderRow) {
    return json(404, { success: false, error: 'Order not found.' });
  }

  const order = orderRow as OrderStatusRow;

  if (isStoreScope && scopeStoreId && order.store_id !== scopeStoreId) {
    return json(403, { success: false, error: 'Store scope does not allow updating this order.' });
  }

  if (order.order_status !== 'placed' && order.order_status !== 'preparing' && order.order_status !== 'ready_for_pickup') {
    return json(409, { success: false, error: 'Order status cannot transition from current state.' });
  }

  const expectedNextStatus = ALLOWED_NEXT_STATUS[order.order_status];
  if (nextStatus !== expectedNextStatus) {
    return json(409, { success: false, error: `Invalid transition. Expected next status: ${expectedNextStatus}.` });
  }

  let updateQuery = db
    .from('orders')
    .update({
      order_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .select('order_id, order_status')
    .maybeSingle();

  if (isStoreScope && scopeStoreId) {
    updateQuery = updateQuery.eq('store_id', scopeStoreId);
  }

  const { data: updatedOrder, error: updateError } = await updateQuery;

  if (updateError) {
    return json(500, { success: false, error: 'Could not update order status.' });
  }

  if (!updatedOrder) {
    return json(404, { success: false, error: 'Order not found for update.' });
  }

  return json(200, {
    success: true,
    orderId: updatedOrder.order_id,
    updatedStatus: updatedOrder.order_status,
  });
});
