// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type OrderType = 'online' | 'walk_in' | 'phone';
type OrderStatus = 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';

type ScopeType = 'global' | 'store' | 'owner' | 'admin';

interface OrdersListFilters {
  date?: {
    from?: string;
    to?: string;
  };
  orderType?: OrderType | 'all';
  search?: string;
  status?: OrderStatus | 'all';
}

interface InternalOrdersListRequest {
  internalSessionToken?: string;
  roleKey?: RoleKey;
  scopeType?: ScopeType;
  scopeStoreId?: string | null;
  filters?: OrdersListFilters;
}

interface InternalSessionContext {
  internalSessionToken: string;
  roleKey: RoleKey;
  scopeType: ScopeType;
  scopeStoreId: string | null;
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

const isIsoDateLike = (value: string) => {
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
};

const sanitizeSearchForPostgrest = (value: string) => (
  value
    .trim()
    .replace(/[^a-zA-Z0-9@.+\-_:\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
);

const escapeIlikeValue = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const normalizeScopeType = (scopeType: ScopeType | undefined, roleKey: RoleKey): ScopeType => {
  if (scopeType === 'store' || scopeType === 'global' || scopeType === 'owner' || scopeType === 'admin') {
    return scopeType;
  }

  if (roleKey === 'store') return 'store';
  return 'global';
};

const normalizeSessionPayload = (body: InternalOrdersListRequest): { value?: InternalSessionContext; error?: string } => {
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

const normalizeFilters = (filters: OrdersListFilters | undefined): { value: OrdersListFilters; error?: string } => {
  if (!filters) return { value: {} };

  const normalized: OrdersListFilters = {};

  if (filters.date) {
    const from = filters.date.from?.trim();
    const to = filters.date.to?.trim();

    if (from && !isIsoDateLike(from)) {
      return { value: {}, error: 'filters.date.from must be a valid ISO date string.' };
    }
    if (to && !isIsoDateLike(to)) {
      return { value: {}, error: 'filters.date.to must be a valid ISO date string.' };
    }

    normalized.date = {
      from,
      to,
    };
  }

  if (filters.orderType) {
    if (filters.orderType !== 'all' && filters.orderType !== 'online' && filters.orderType !== 'walk_in' && filters.orderType !== 'phone') {
      return { value: {}, error: 'filters.orderType must be one of all, online, walk_in, phone.' };
    }
    normalized.orderType = filters.orderType;
  }

  if (filters.status) {
    if (
      filters.status !== 'all'
      && filters.status !== 'pending'
      && filters.status !== 'placed'
      && filters.status !== 'preparing'
      && filters.status !== 'ready_for_pickup'
      && filters.status !== 'completed'
      && filters.status !== 'cancelled'
    ) {
      return { value: {}, error: 'filters.status must be one of all, pending, placed, preparing, ready_for_pickup, completed, cancelled.' };
    }
    normalized.status = filters.status;
  }

  if (typeof filters.search === 'string') {
    normalized.search = filters.search.trim();
  }

  return { value: normalized };
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
    return json(500, { error: 'Server is not configured for internal orders access.' });
  }

  let body: InternalOrdersListRequest;
  try {
    body = (await req.json()) as InternalOrdersListRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const normalizedSession = normalizeSessionPayload(body);
  if (normalizedSession.error || !normalizedSession.value) {
    return json(400, { error: normalizedSession.error ?? 'Invalid session payload.' });
  }

  const normalizedFilters = normalizeFilters(body.filters);
  if (normalizedFilters.error) {
    return json(400, { error: normalizedFilters.error });
  }

  const verifyResult = await verifyInternalSession(normalizedSession.value);
  if (!verifyResult.valid) {
    return json(401, { error: 'Invalid internal session.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { roleKey, scopeType, scopeStoreId } = normalizedSession.value;
  const { date, orderType, status, search } = normalizedFilters.value;

  const isStoreScope = scopeType === 'store' || roleKey === 'store';

  let query = db
    .from('orders')
    .select(
      'order_id, order_type, source_channel, order_status, store_id, customer_name, customer_phone, customer_email, payment_method, subtotal_amount, discount_amount, total_amount, created_at, order_items(order_item_id, order_id, item_name, item_category, unit_price, quantity, order_item_selections(order_item_selection_id, order_item_id, group_name_snapshot, option_name))'
    )
    .order('created_at', { ascending: false });

  if (isStoreScope && scopeStoreId) {
    query = query.eq('store_id', scopeStoreId);
  }

  if (date?.from) {
    query = query.gte('created_at', date.from);
  }

  if (date?.to) {
    query = query.lte('created_at', date.to);
  }

  if (orderType && orderType !== 'all') {
    query = query.eq('order_type', orderType);
  }

  if (status && status !== 'all') {
    query = query.eq('order_status', status);
  }

  if (search) {
    const sanitizedSearch = sanitizeSearchForPostgrest(search);
    if (sanitizedSearch) {
      const safePattern = `%${escapeIlikeValue(sanitizedSearch)}%`;
      // Match order id or customer identity fields.
      query = query.or(
        `order_id.ilike.${safePattern},customer_name.ilike.${safePattern},customer_phone.ilike.${safePattern},customer_email.ilike.${safePattern}`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    return json(500, { error: 'Could not fetch internal orders.' });
  }

  return json(200, {
    orders: data ?? [],
  });
});
