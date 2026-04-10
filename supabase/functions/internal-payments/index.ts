// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type PaymentMethod = 'cash' | 'upi' | 'card';

interface InternalPosPaymentRequest {
  internalSessionToken?: string;
  action?: 'record_pos_payment';
  orderId?: string;
  paymentMethod?: PaymentMethod;
  amount?: number;
  reference?: string;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
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

  db
    .from('internal_access_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('session_token', token)
    .then(() => {})
    .catch(() => {});

  return { valid: true, session: data as InternalAccessSessionRow };
};

const loadPermissionKeys = async (db: ReturnType<typeof createClient>, internalUserId: string) => {
  const { data, error } = await db
    .from('internal_users')
    .select('roles!inner(role_permissions(is_allowed, permissions(permission_key)))')
    .eq('id', internalUserId)
    .single();

  if (error || !data) {
    return { error: 'Could not load internal user permissions.' };
  }

  const permissionKeys = ((data.roles?.role_permissions ?? []) as Array<{ is_allowed?: boolean; permissions?: { permission_key?: string | null } | null }>)
    .filter((entry) => entry.is_allowed)
    .map((entry) => entry.permissions?.permission_key?.trim())
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey));

  return { permissionKeys: Array.from(new Set(permissionKeys)) };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server is not configured for payments.' });
  }

  let body: InternalPosPaymentRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const internalSessionToken = (body.internalSessionToken ?? '').trim();
  const orderId = (body.orderId ?? '').trim();
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const paymentMethod = body.paymentMethod;
  const amount = Number(body.amount ?? NaN);

  if (body.action !== 'record_pos_payment') {
    return json(400, { error: 'action must be record_pos_payment.' });
  }
  if (!internalSessionToken) {
    return json(400, { error: 'internalSessionToken is required.' });
  }
  if (!orderId) {
    return json(400, { error: 'orderId is required.' });
  }
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'card') {
    return json(400, { error: 'paymentMethod must be cash, upi, or card.' });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return json(400, { error: 'amount must be a non-negative number.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadSession(db, internalSessionToken);
  if (!verifiedSession.valid) {
    return json(401, { error: verifiedSession.error });
  }

  const permissionsResult = await loadPermissionKeys(db, verifiedSession.session.internal_user_id);
  if (permissionsResult.error) {
    return json(500, { error: permissionsResult.error });
  }

  if (!permissionsResult.permissionKeys.includes('can_access_pos')) {
    return json(403, { error: 'You do not have permission to record POS payments.' });
  }

  const { data: orderRow, error: orderError } = await db
    .from('orders')
    .select('order_id, store_id, customer_id, total_amount, order_status, payment_method')
    .eq('order_id', orderId)
    .maybeSingle();

  if (orderError) {
    return json(500, { error: 'Could not load order for payment recording.' });
  }

  if (!orderRow) {
    return json(404, { error: 'Order not found.' });
  }

  if (verifiedSession.session.scope_type === 'store' && verifiedSession.session.scope_store_id !== orderRow.store_id) {
    return json(403, { error: 'Store scope does not allow payment recording for this order.' });
  }

  if (orderRow.order_status === 'cancelled') {
    return json(409, { error: 'Cancelled orders cannot receive payments.' });
  }

  const roundedAmount = Number(amount.toFixed(2));
  const expectedAmount = Number(Number(orderRow.total_amount ?? 0).toFixed(2));
  if (Math.abs(roundedAmount - expectedAmount) > 0.009) {
    return json(409, { error: `Payment amount must match the order total of ${expectedAmount.toFixed(2)}.` });
  }

  const nowIso = new Date().toISOString();

  const { data: paymentRow, error: paymentError } = await db
    .from('order_payments')
    .upsert({
      order_id: orderRow.order_id,
      store_id: orderRow.store_id,
      customer_id: orderRow.customer_id ?? null,
      recorded_by_internal_user_id: verifiedSession.session.internal_user_id,
      payment_method: paymentMethod,
      payment_source: 'pos_manual',
      provider_type: 'manual',
      status: 'recorded',
      amount: roundedAmount,
      currency: 'INR',
      reference: reference || null,
      provider_reference: null,
      metadata: {
        source: 'counter_billing',
        recorded_via: 'internal-payments',
      },
      recorded_at: nowIso,
      updated_at: nowIso,
    }, {
      onConflict: 'order_id',
    })
    .select('payment_id, status, payment_method, amount, recorded_at, reference')
    .single();

  if (paymentError || !paymentRow) {
    return json(500, { error: 'Could not record the payment.' });
  }

  const { error: orderUpdateError } = await db
    .from('orders')
    .update({
      payment_method: paymentMethod,
      payment_status: 'paid',
      paid_at: nowIso,
      payment_reference: reference || null,
      updated_at: nowIso,
    })
    .eq('order_id', orderRow.order_id);

  if (orderUpdateError) {
    return json(500, { error: 'Payment was recorded, but order payment status could not be updated.' });
  }

  return json(200, {
    success: true,
    payment: {
      paymentId: paymentRow.payment_id,
      orderId: orderRow.order_id,
      status: paymentRow.status,
      paymentMethod: paymentRow.payment_method,
      amount: Number(paymentRow.amount ?? roundedAmount),
      recordedAt: paymentRow.recorded_at,
      reference: paymentRow.reference ?? null,
    },
  });
});
