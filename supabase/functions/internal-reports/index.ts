// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';

interface InternalReportsRequest {
  internalSessionToken?: string;
  action?: 'dashboard';
  storeId?: string | null;
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

const resolveScopedStoreIds = async (db: ReturnType<typeof createClient>, session: InternalAccessSessionRow, requestedStoreId?: string | null) => {
  if (session.scope_type === 'store') {
    if (!session.scope_store_id) {
      return { error: 'Store-scoped session is missing store scope.', status: 400 };
    }
    if (requestedStoreId && requestedStoreId.trim() && requestedStoreId.trim() !== session.scope_store_id) {
      return { error: 'Store-scoped session cannot access another store.', status: 403 };
    }
    return { storeIds: [session.scope_store_id] };
  }

  if (requestedStoreId && requestedStoreId.trim()) {
    return { storeIds: [requestedStoreId.trim()] };
  }

  const { data, error } = await db.from('stores').select('id').eq('is_active', true);
  if (error) {
    return { error: 'Could not load stores for reports.', status: 500 };
  }
  return { storeIds: (data ?? []).map((row: { id: string }) => row.id) };
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
    return json(500, { error: 'Server is not configured for reports.' });
  }

  let body: InternalReportsRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const internalSessionToken = (body.internalSessionToken ?? '').trim();
  if (body.action !== 'dashboard') {
    return json(400, { error: 'action must be dashboard.' });
  }
  if (!internalSessionToken) {
    return json(400, { error: 'internalSessionToken is required.' });
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

  if (!permissionsResult.permissionKeys.includes('can_view_reports')) {
    return json(403, { error: 'You do not have permission to view reports.' });
  }

  const scopeResult = await resolveScopedStoreIds(db, verifiedSession.session, body.storeId ?? null);
  if ('error' in scopeResult) {
    return json(scopeResult.status, { error: scopeResult.error });
  }

  const storeIds = scopeResult.storeIds;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [ordersResult, paymentsResult, itemsResult, storesResult] = await Promise.all([
    db
      .from('orders')
      .select('order_id, store_id, order_type, source_channel, order_status, total_amount, subtotal_amount, discount_amount, tax_amount, tip_amount, created_at')
      .in('store_id', storeIds),
    db
      .from('order_payments')
      .select('order_id, store_id, payment_method, amount, status, recorded_at')
      .in('store_id', storeIds),
    db
      .from('order_items')
      .select('order_id, item_name, quantity, line_total, orders!inner(store_id)')
      .in('orders.store_id', storeIds),
    db
      .from('stores')
      .select('id, name')
      .in('id', storeIds),
  ]);

  if (ordersResult.error || paymentsResult.error || itemsResult.error || storesResult.error) {
    return json(500, { error: 'Could not load reports.' });
  }

  const orders = (ordersResult.data ?? []).filter((row: any) => row.order_status !== 'cancelled');
  const payments = (paymentsResult.data ?? []).filter((row: any) => row.status === 'recorded');
  const orderItems = itemsResult.data ?? [];
  const stores = storesResult.data ?? [];
  const storeNameById = Object.fromEntries(stores.map((row: any) => [row.id, row.name]));

  const todayOrders = orders.filter((row: any) => new Date(row.created_at) >= startOfToday);
  const totalRevenue = orders.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0);
  const todayRevenue = todayOrders.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0);
  const totalTax = orders.reduce((sum: number, row: any) => sum + Number(row.tax_amount ?? 0), 0);
  const todayTax = todayOrders.reduce((sum: number, row: any) => sum + Number(row.tax_amount ?? 0), 0);

  const ordersByChannel = orders.reduce((acc: Record<string, number>, row: any) => {
    const key = row.order_type === 'walk_in' ? 'walk_in' : row.order_type === 'phone' ? 'phone' : 'online';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const paymentMethodSummary = payments.reduce((acc: Record<string, { count: number; amount: number }>, row: any) => {
    const key = row.payment_method ?? 'unknown';
    acc[key] = acc[key] ?? { count: 0, amount: 0 };
    acc[key].count += 1;
    acc[key].amount += Number(row.amount ?? 0);
    return acc;
  }, {});

  const itemSalesSummary = Object.values(orderItems.reduce((acc: Record<string, any>, row: any) => {
    const key = row.item_name;
    acc[key] = acc[key] ?? { itemName: key, quantity: 0, revenue: 0 };
    acc[key].quantity += Number(row.quantity ?? 0);
    acc[key].revenue += Number(row.line_total ?? 0);
    return acc;
  }, {}))
    .sort((left: any, right: any) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 12);

  const storeSalesSummary = storeIds.map((storeId) => {
    const storeOrders = orders.filter((row: any) => row.store_id === storeId);
    return {
      storeId,
      storeName: storeNameById[storeId] ?? 'Unknown store',
      orderCount: storeOrders.length,
      revenue: storeOrders.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0),
      tax: storeOrders.reduce((sum: number, row: any) => sum + Number(row.tax_amount ?? 0), 0),
    };
  }).sort((left, right) => right.revenue - left.revenue);

  return json(200, {
    success: true,
    summary: {
      totalRevenue,
      todayRevenue,
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      averageTicket: orders.length > 0 ? totalRevenue / orders.length : 0,
      totalTax,
      todayTax,
      ordersByChannel,
      paymentMethodSummary,
      itemSalesSummary,
      storeSalesSummary,
    },
  });
});
