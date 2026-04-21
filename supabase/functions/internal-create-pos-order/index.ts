// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type PaymentMethod = 'cash' | 'upi' | 'card';

interface InternalPosOrderItem {
  itemId?: string;
  title?: string;
  category?: string;
  quantity?: number;
  price?: number;
  selections?: Array<{
    section?: string;
    choices?: string[];
  }>;
}

interface InternalCreatePosOrderRequest {
  internalSessionToken?: string;
  storeId?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  subtotal?: number;
  taxAmount?: number;
  tipAmount?: number;
  total?: number;
  items?: InternalPosOrderItem[];
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const isValidUuid = (value: unknown): value is string =>
  typeof value === 'string' && uuidPattern.test(value.trim());

const roundMoney = (value: unknown) => Number(Number(value ?? 0).toFixed(2));

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

const validateItems = (items: unknown): items is InternalPosOrderItem[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  return items.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const quantity = Number((item as InternalPosOrderItem).quantity);
    const price = Number((item as InternalPosOrderItem).price);

    return (
      typeof (item as InternalPosOrderItem).title === 'string'
      && (item as InternalPosOrderItem).title!.trim().length > 0
      && typeof (item as InternalPosOrderItem).category === 'string'
      && (item as InternalPosOrderItem).category!.trim().length > 0
      && Number.isInteger(quantity)
      && quantity > 0
      && Number.isFinite(price)
      && price >= 0
    );
  });
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
    return json(500, { error: 'Server is not configured for POS checkout.' });
  }

  let body: InternalCreatePosOrderRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const internalSessionToken = (body.internalSessionToken ?? '').trim();
  const storeId = (body.storeId ?? '').trim();
  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : null;
  const paymentMethod = body.paymentMethod;
  const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
  const subtotal = roundMoney(body.subtotal);
  const taxAmount = roundMoney(body.taxAmount);
  const tipAmount = roundMoney(body.tipAmount);
  const total = roundMoney(body.total);

  if (!internalSessionToken) {
    return json(400, { error: 'internalSessionToken is required.' });
  }
  if (!isValidUuid(storeId)) {
    return json(400, { error: 'storeId must be a valid store UUID.' });
  }
  if (customerId && !isValidUuid(customerId)) {
    return json(400, { error: 'customerId must be a valid customer UUID.' });
  }
  if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'card') {
    return json(400, { error: 'paymentMethod must be cash, upi, or card.' });
  }
  if (![subtotal, taxAmount, tipAmount, total].every((amount) => Number.isFinite(amount) && amount >= 0)) {
    return json(400, { error: 'subtotal, taxAmount, tipAmount, and total must be non-negative numbers.' });
  }
  if (total <= 0) {
    return json(400, { error: 'total must be greater than zero.' });
  }
  if (!validateItems(body.items)) {
    return json(400, { error: 'POS order must include valid items.' });
  }

  const computedSubtotal = roundMoney(body.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));
  if (Math.abs(computedSubtotal - subtotal) > 0.01) {
    return json(400, { error: 'subtotal must match POS item totals.' });
  }
  if (Math.abs(roundMoney(subtotal + taxAmount + tipAmount) - total) > 0.01) {
    return json(400, { error: 'total must match subtotal, taxAmount, and tipAmount.' });
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
    return json(403, { error: 'You do not have permission to create POS orders.' });
  }

  if (verifiedSession.session.scope_type === 'store' && verifiedSession.session.scope_store_id !== storeId) {
    return json(403, { error: 'Store scope does not allow checkout for this store.' });
  }

  const { data: rpcResult, error: rpcError } = await db.rpc('create_internal_pos_order_with_payment', {
    p_store_id: storeId,
    p_internal_user_id: verifiedSession.session.internal_user_id,
    p_customer_id: customerId || null,
    p_customer_name: body.customerName ?? null,
    p_customer_phone: body.customerPhone ?? null,
    p_customer_email: body.customerEmail ?? null,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference || null,
    p_subtotal_amount: subtotal,
    p_tax_amount: taxAmount,
    p_tip_amount: tipAmount,
    p_total_amount: total,
    p_items: body.items,
  });

  if (rpcError || !rpcResult) {
    return json(500, { error: rpcError?.message ?? 'Could not complete POS checkout.' });
  }

  return json(200, {
    success: true,
    order: {
      orderId: rpcResult.orderId,
      orderNumber: rpcResult.orderNumber,
      orderStatus: rpcResult.orderStatus,
      storeId: rpcResult.storeId,
      customerId: rpcResult.customerId ?? null,
      customerName: rpcResult.customerName,
      customerPhone: rpcResult.customerPhone ?? null,
      customerEmail: rpcResult.customerEmail ?? null,
      paymentMethod: rpcResult.paymentMethod,
      paymentReference: rpcResult.paymentReference ?? null,
      subtotal: Number(rpcResult.subtotal ?? 0),
      taxAmount: Number(rpcResult.taxAmount ?? 0),
      tipAmount: Number(rpcResult.tipAmount ?? 0),
      total: Number(rpcResult.total ?? 0),
      createdAt: rpcResult.createdAt,
    },
    payment: {
      paymentId: rpcResult.paymentId,
      orderId: rpcResult.orderId,
      status: rpcResult.paymentStatus,
      paymentMethod: rpcResult.paymentMethod,
      amount: Number(rpcResult.total ?? 0),
      recordedAt: rpcResult.createdAt,
      reference: rpcResult.paymentReference ?? null,
    },
  });
});
