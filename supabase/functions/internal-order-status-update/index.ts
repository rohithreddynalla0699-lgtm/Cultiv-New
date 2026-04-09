// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type OrderStatus = 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';

type NextStatus = 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';

interface InternalOrderStatusUpdateRequest {
  internalSessionToken?: string;
  roleKey?: RoleKey;
  scopeType?: ScopeType;
  scopeStoreId?: string | null;
  orderId?: string;
  nextStatus?: NextStatus;
  cancellationReason?: string;
}

interface InternalAccessSessionRow {
  id: string;
  session_token: string;
  internal_user_id: string;
  role_key: RoleKey;
  scope_type: ScopeType;
  scope_store_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
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

const ALLOWED_NEXT_STATUS: Record<'placed' | 'preparing' | 'ready_for_pickup', NextStatus[]> = {
  placed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['completed'],
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

const extractSessionToken = (body: InternalOrderStatusUpdateRequest): { value?: string; error?: string } => {
  const token = (body.internalSessionToken ?? '').trim();
  if (!token) {
    return { error: 'internalSessionToken is required.' };
  }
  return { value: token };
};

const normalizeUpdatePayload = (body: InternalOrderStatusUpdateRequest): { orderId?: string; nextStatus?: NextStatus; error?: string } => {
  const orderId = (body.orderId ?? '').trim();
  const nextStatus = body.nextStatus;

  if (!orderId) {
    return { error: 'orderId is required.' };
  }

  if (nextStatus !== 'preparing' && nextStatus !== 'ready_for_pickup' && nextStatus !== 'completed' && nextStatus !== 'cancelled') {
    return { error: 'nextStatus must be one of preparing, ready_for_pickup, completed, cancelled.' };
  }

  return { orderId, nextStatus };
};

const verifyAndLoadSession = async (
  db: ReturnType<typeof createClient>,
  token: string,
): Promise<{ valid: true; session: InternalAccessSessionRow } | { valid: false; error: string }> => {
  const { data, error } = await db
    .from('internal_access_sessions')
    .select('id, session_token, internal_user_id, role_key, scope_type, scope_store_id, expires_at, revoked_at, last_seen_at')
    .eq('session_token', token)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Internal session not found.' };
  }

  if (data.revoked_at !== null) {
    return { valid: false, error: 'Internal session has been revoked.' };
  }

  if (new Date(data.expires_at) <= new Date()) {
    return { valid: false, error: 'Internal session has expired.' };
  }

  // Fire-and-forget: update last_seen_at without blocking the response.
  db
    .from('internal_access_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('session_token', token)
    .then(() => {})
    .catch(() => {});

  return { valid: true, session: data as InternalAccessSessionRow };
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

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(400, { success: false, error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const normalizedUpdate = normalizeUpdatePayload(body);
  if (normalizedUpdate.error || !normalizedUpdate.orderId || !normalizedUpdate.nextStatus) {
    return json(400, { success: false, error: normalizedUpdate.error ?? 'Invalid update payload.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyAndLoadSession(db, tokenResult.value);
  if (!verifyResult.valid) {
    return json(401, { success: false, error: verifyResult.error });
  }

  const { role_key: roleKey, scope_type: scopeType, scope_store_id: scopeStoreId } = verifyResult.session;
  const { orderId, nextStatus } = normalizedUpdate;
  const cancellationReason = typeof body.cancellationReason === 'string' ? body.cancellationReason : undefined;

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

  const allowedNextStatuses = ALLOWED_NEXT_STATUS[order.order_status];
  if (!allowedNextStatuses.includes(nextStatus)) {
    return json(409, { success: false, error: `Invalid transition. Allowed: ${allowedNextStatuses.join(', ')}.` });
  }

  let updatePayload: Record<string, unknown> = {
    order_status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus === 'cancelled' && cancellationReason) {
    updatePayload.cancellation_reason = cancellationReason;
  }

  let updateQuery = db
    .from('orders')
    .update(updatePayload)
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

    if (nextStatus === 'completed') {
    const { data: completedOrder, error: completedOrderError } = await db
      .from('orders')
      .select('order_id, customer_id, total_amount, order_status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (completedOrderError) {
      console.error('Failed to load completed order for loyalty award', completedOrderError);
    } else if (
      completedOrder &&
      completedOrder.customer_id &&
      completedOrder.order_status === 'completed'
    ) {
      const points = Math.floor(Number(completedOrder.total_amount) / 10);

      if (points > 0) {
        const { data: existingAwards, error: existingAwardsError } = await db
          .from('loyalty_points_ledger')
          .select('order_id')
          .eq('order_id', completedOrder.order_id)
          .eq('entry_type', 'earn')
          .limit(1);

        if (existingAwardsError) {
          console.error('Failed to verify existing loyalty award', existingAwardsError);
        } else if (!(Array.isArray(existingAwards) && existingAwards.length > 0)) {
          const earnedAt = new Date();
          const expiresAt = new Date(earnedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

          const { error: loyaltyInsertError } = await db
            .from('loyalty_points_ledger')
            .insert({
              user_id: completedOrder.customer_id,
              order_id: completedOrder.order_id,
              entry_type: 'earn',
              points,
              points_remaining: points,
              earned_at: earnedAt.toISOString(),
              expires_at: expiresAt.toISOString(),
              metadata: {
                source: 'order_completion',
                total_amount: completedOrder.total_amount,
              },
            });

          if (loyaltyInsertError) {
            if (loyaltyInsertError.code === '23505') {
              console.info('Loyalty already awarded for order', completedOrder.order_id);
            } else {
              console.error('Failed to insert loyalty ledger row', loyaltyInsertError);
            }
          }
        }
      }
    }
  }

  return json(200, {
    success: true,
    orderId: updatedOrder.order_id,
    updatedStatus: updatedOrder.order_status,
  });
});
