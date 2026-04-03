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

const extractSessionToken = (body: InternalOrdersListRequest): { value?: string; error?: string } => {
  const token = (body.internalSessionToken ?? '').trim();
  if (!token) {
    return { error: 'internalSessionToken is required.' };
  }
  return { value: token };
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
    return json(500, { error: 'Server is not configured for internal orders access.' });
  }

  let body: InternalOrdersListRequest;
  try {
    body = (await req.json()) as InternalOrdersListRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const normalizedFilters = normalizeFilters(body.filters);
  if (normalizedFilters.error) {
    return json(400, { error: normalizedFilters.error });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyAndLoadSession(db, tokenResult.value);
  if (!verifyResult.valid) {
    return json(401, { error: verifyResult.error });
  }

  const { role_key: roleKey, scope_type: scopeType, scope_store_id: scopeStoreId } = verifyResult.session;
  const { date, orderType, status, search } = normalizedFilters.value;

  const isStoreScope = scopeType === 'store' || roleKey === 'store';

  let query = db
    .from('orders')
    .select(
      'order_id, order_type, source_channel, order_status, store_id, customer_name, customer_phone, customer_email, payment_method, subtotal_amount, discount_amount, tax_amount, tip_amount, total_amount, created_at, order_items(order_item_id, order_id, item_name, item_category, unit_price, quantity, order_item_selections(order_item_selection_id, order_item_id, group_name_snapshot, option_name))'
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
