// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';

interface InternalReportsRequest {
  internalSessionToken?: string;
  action?: 'dashboard';
  storeId?: string | null;
  dateRange?: {
    from?: string;
    to?: string;
    label?: string;
    preset?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';
  } | null;
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

type ReconciliationAnomalyType =
  | 'initiated_older_than_15_minutes'
  | 'pending_action_older_than_15_minutes'
  | 'failed'
  | 'cancelled'
  | 'orphaned'
  | 'succeeded_without_order'
  | 'paid_order_missing_order_payment';

type NotificationAnomalySource = 'receipt_delivery' | 'notification_event';

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

const isValidIsoDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const normalizeDateRange = (
  dateRange: InternalReportsRequest['dateRange'],
): {
  from: string | null;
  to: string | null;
  label: string;
  preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'all_time';
} | null => {
  if (!dateRange) {
    return {
      from: null,
      to: null,
      label: 'All time',
      preset: 'all_time',
    };
  }

  const from = isValidIsoDate(dateRange.from) ? new Date(String(dateRange.from)).toISOString() : null;
  const to = isValidIsoDate(dateRange.to) ? new Date(String(dateRange.to)).toISOString() : null;
  const preset = (
    dateRange.preset === 'today'
    || dateRange.preset === 'yesterday'
    || dateRange.preset === 'this_week'
    || dateRange.preset === 'this_month'
    || dateRange.preset === 'custom'
  ) ? dateRange.preset : 'all_time';

  if ((from && !to) || (!from && to)) {
    return null;
  }

  if (from && to && new Date(from) > new Date(to)) {
    return null;
  }

  return {
    from,
    to,
    label: String(dateRange.label ?? '').trim() || 'Selected range',
    preset,
  };
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

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const isOlderThan15Minutes = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() > FIFTEEN_MINUTES_MS;
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
  const normalizedDateRange = normalizeDateRange(body.dateRange ?? null);
  if (!normalizedDateRange) {
    return json(400, { error: 'dateRange must include a valid from/to pair.' });
  }

  let ordersQuery = db
      .from('orders')
      .select('order_id, store_id, customer_id, order_type, source_channel, order_status, total_amount, subtotal_amount, discount_amount, tax_amount, tip_amount, payment_status, created_at')
      .in('store_id', storeIds);

  let customerPaymentsQuery = db
    .from('customer_payments')
    .select('payment_id, status, store_id, amount, gateway, gateway_order_id, gateway_payment_id, order_id, failure_message, created_at, updated_at')
    .in('store_id', storeIds);

  if (normalizedDateRange.from && normalizedDateRange.to) {
    ordersQuery = ordersQuery
      .gte('created_at', normalizedDateRange.from)
      .lte('created_at', normalizedDateRange.to);
    customerPaymentsQuery = customerPaymentsQuery
      .gte('created_at', normalizedDateRange.from)
      .lte('created_at', normalizedDateRange.to);
  }

  const [ordersResult, storesResult, customerPaymentsResult] = await Promise.all([
    ordersQuery,
    db
      .from('stores')
      .select('id, name')
      .in('id', storeIds),
    customerPaymentsQuery,
  ]);

  if (ordersResult.error || storesResult.error || customerPaymentsResult.error) {
    return json(500, { error: 'Could not load reports.' });
  }

  const allOrders = ordersResult.data ?? [];
  const orders = allOrders.filter((row: any) => row.order_status !== 'cancelled');
  const stores = storesResult.data ?? [];
  const customerPayments = customerPaymentsResult.data ?? [];
  const storeNameById = Object.fromEntries(stores.map((row: any) => [row.id, row.name]));
  const allOrderIds = allOrders.map((row: any) => row.order_id);
  const filteredOrderIds = orders.map((row: any) => row.order_id);
  const customerPaymentOrderIds = customerPayments
    .map((row: any) => row.order_id)
    .filter((orderId: string | null): orderId is string => Boolean(orderId));
  const reconciliationOrderIds = Array.from(new Set(customerPaymentOrderIds));

  const safeFilteredOrderIds = filteredOrderIds.length > 0 ? filteredOrderIds : ['00000000-0000-0000-0000-000000000000'];
  const safeReconciliationOrderIds = reconciliationOrderIds.length > 0 ? reconciliationOrderIds : ['00000000-0000-0000-0000-000000000000'];

  let receiptDeliveriesQuery = db
    .from('receipt_deliveries')
    .select('id, order_id, delivery_method, recipient, status, provider, error_code, error_message, sent_at, created_at');

  let notificationEventsQuery = db
    .from('notification_events')
    .select('id, channel, purpose, status, provider, recipient, customer_id, order_id, store_id, error_code, error_message, sent_at, created_at, updated_at');

  if (normalizedDateRange.from && normalizedDateRange.to) {
    receiptDeliveriesQuery = receiptDeliveriesQuery
      .gte('created_at', normalizedDateRange.from)
      .lte('created_at', normalizedDateRange.to);
    notificationEventsQuery = notificationEventsQuery
      .gte('created_at', normalizedDateRange.from)
      .lte('created_at', normalizedDateRange.to);
  }

  if (allOrderIds.length > 0) {
    const safeAllOrderIds = allOrderIds.length > 0 ? allOrderIds : ['00000000-0000-0000-0000-000000000000'];
    receiptDeliveriesQuery = receiptDeliveriesQuery.in('order_id', safeAllOrderIds);
  } else {
    receiptDeliveriesQuery = receiptDeliveriesQuery.limit(0);
  }

  const shouldIncludeGlobalNotificationEvents = verifiedSession.session.scope_type !== 'store' && !body.storeId?.trim();
  if (!shouldIncludeGlobalNotificationEvents) {
    notificationEventsQuery = notificationEventsQuery.in('store_id', storeIds);
  }

  const [paymentsResult, itemsResult, reconciliationOrderPaymentsResult, receiptDeliveriesResult, notificationEventsResult] = filteredOrderIds.length > 0 || reconciliationOrderIds.length > 0 || allOrderIds.length > 0 || shouldIncludeGlobalNotificationEvents
    ? await Promise.all([
      db
        .from('order_payments')
        .select('order_id, store_id, payment_method, amount, status, recorded_at')
        .in('order_id', safeFilteredOrderIds),
      db
        .from('order_items')
        .select('order_id, item_name, quantity, line_total')
        .in('order_id', safeFilteredOrderIds),
      db
        .from('order_payments')
        .select('order_id, status')
        .in('order_id', safeReconciliationOrderIds),
      receiptDeliveriesQuery,
      notificationEventsQuery,
    ])
    : [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];

  if (paymentsResult.error || itemsResult.error || reconciliationOrderPaymentsResult.error || receiptDeliveriesResult.error || notificationEventsResult.error) {
    return json(500, { error: 'Could not load reports.' });
  }

  const payments = (paymentsResult.data ?? []).filter((row: any) => row.status === 'recorded');
  const orderItems = itemsResult.data ?? [];
  const reconciliationOrderPayments = reconciliationOrderPaymentsResult.data ?? [];
  const receiptDeliveries = receiptDeliveriesResult.data ?? [];
  const notificationEvents = (notificationEventsResult.data ?? []).filter((row: any) => {
    if (!body.storeId?.trim()) return true;
    return Boolean(row.store_id) && storeIds.includes(row.store_id);
  });
  const orderById = new Map(allOrders.map((row: any) => [row.order_id, row]));
  const reconciliationPaymentByOrderId = new Map(reconciliationOrderPayments.map((row: any) => [row.order_id, row]));

  const reconciliationSummary = {
    initiatedOlderThan15Minutes: 0,
    pendingActionOlderThan15Minutes: 0,
    failed: 0,
    cancelled: 0,
    orphaned: 0,
    succeededWithoutOrder: 0,
    paidOrderMissingOrderPayment: 0,
  };

  const anomalyPriority: Record<ReconciliationAnomalyType, number> = {
    orphaned: 0,
    succeeded_without_order: 1,
    paid_order_missing_order_payment: 2,
    initiated_older_than_15_minutes: 3,
    pending_action_older_than_15_minutes: 4,
    failed: 5,
    cancelled: 6,
  };

  const anomalies = customerPayments.flatMap((row: any) => {
    const anomalyTypes: ReconciliationAnomalyType[] = [];
    const status = String(row.status ?? '').trim().toLowerCase();
    const matchingOrder = row.order_id ? orderById.get(row.order_id) : null;
    const matchingOrderPayment = row.order_id ? reconciliationPaymentByOrderId.get(row.order_id) : null;

    if (status === 'initiated' && isOlderThan15Minutes(row.created_at)) {
      reconciliationSummary.initiatedOlderThan15Minutes += 1;
      anomalyTypes.push('initiated_older_than_15_minutes');
    }

    if (status === 'pending_action' && isOlderThan15Minutes(row.created_at)) {
      reconciliationSummary.pendingActionOlderThan15Minutes += 1;
      anomalyTypes.push('pending_action_older_than_15_minutes');
    }

    if (status === 'failed') {
      reconciliationSummary.failed += 1;
      anomalyTypes.push('failed');
    }

    if (status === 'cancelled') {
      reconciliationSummary.cancelled += 1;
      anomalyTypes.push('cancelled');
    }

    if (status === 'orphaned') {
      reconciliationSummary.orphaned += 1;
      anomalyTypes.push('orphaned');
    }

    if (status === 'succeeded' && !row.order_id) {
      reconciliationSummary.succeededWithoutOrder += 1;
      anomalyTypes.push('succeeded_without_order');
    }

    if (
      row.order_id
      && matchingOrder
      && String(matchingOrder.payment_status ?? '').trim().toLowerCase() === 'paid'
      && !matchingOrderPayment
    ) {
      reconciliationSummary.paidOrderMissingOrderPayment += 1;
      anomalyTypes.push('paid_order_missing_order_payment');
    }

    return anomalyTypes.map((anomalyType) => ({
      anomalyType,
      paymentId: row.payment_id,
      status: String(row.status ?? ''),
      storeId: row.store_id,
      storeName: storeNameById[row.store_id] ?? 'Unknown store',
      amount: Number(row.amount ?? 0),
      gateway: String(row.gateway ?? ''),
      gatewayOrderId: row.gateway_order_id ? String(row.gateway_order_id) : null,
      gatewayPaymentId: row.gateway_payment_id ? String(row.gateway_payment_id) : null,
      orderId: row.order_id ? String(row.order_id) : null,
      failureMessage: row.failure_message ? String(row.failure_message) : null,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    }));
  })
    .sort((left, right) => {
      const priorityDelta = anomalyPriority[left.anomalyType] - anomalyPriority[right.anomalyType];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, 50);

  const notificationSummary = {
    failedReceiptDeliveries: 0,
    failedNotificationEvents: 0,
    notDeliveredNotificationEvents: 0,
    sentNotificationEvents: 0,
  };

  const notificationAnomalies = [
    ...receiptDeliveries
      .filter((row: any) => String(row.status ?? '').trim().toLowerCase() !== 'success')
      .map((row: any) => {
        const matchingOrder = row.order_id ? orderById.get(row.order_id) : null;
        notificationSummary.failedReceiptDeliveries += 1;
        return {
          source: 'receipt_delivery' as NotificationAnomalySource,
          eventId: String(row.id),
          purpose: 'receipt',
          channel: String(row.delivery_method ?? ''),
          status: String(row.status ?? ''),
          storeId: matchingOrder?.store_id ?? null,
          storeName: matchingOrder?.store_id ? (storeNameById[matchingOrder.store_id] ?? 'Unknown store') : 'No store',
          orderId: row.order_id ? String(row.order_id) : null,
          customerId: matchingOrder?.customer_id ? String(matchingOrder.customer_id) : null,
          recipient: row.recipient ? String(row.recipient) : null,
          provider: row.provider ? String(row.provider) : null,
          errorCode: row.error_code ? String(row.error_code) : null,
          errorMessage: row.error_message ? String(row.error_message) : null,
          createdAt: String(row.created_at ?? ''),
          updatedAt: String(row.created_at ?? ''),
        };
      }),
    ...notificationEvents.flatMap((row: any) => {
      const status = String(row.status ?? '').trim().toLowerCase();
      if (status === 'sent') {
        notificationSummary.sentNotificationEvents += 1;
        return [];
      }
      if (status === 'failed') {
        notificationSummary.failedNotificationEvents += 1;
      }
      if (status === 'not_delivered') {
        notificationSummary.notDeliveredNotificationEvents += 1;
      }
      const storeName = row.store_id ? (storeNameById[row.store_id] ?? 'Unknown store') : 'No store';
      return [{
        source: 'notification_event' as NotificationAnomalySource,
        eventId: String(row.id),
        purpose: String(row.purpose ?? ''),
        channel: String(row.channel ?? ''),
        status: String(row.status ?? ''),
        storeId: row.store_id ? String(row.store_id) : null,
        storeName,
        orderId: row.order_id ? String(row.order_id) : null,
        customerId: row.customer_id ? String(row.customer_id) : null,
        recipient: row.recipient ? String(row.recipient) : null,
        provider: row.provider ? String(row.provider) : null,
        errorCode: row.error_code ? String(row.error_code) : null,
        errorMessage: row.error_message ? String(row.error_message) : null,
        createdAt: String(row.created_at ?? ''),
        updatedAt: String(row.updated_at ?? row.created_at ?? ''),
      }];
    }),
  ]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 50);

  const totalRevenue = orders.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0);
  const totalTax = orders.reduce((sum: number, row: any) => sum + Number(row.tax_amount ?? 0), 0);

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
      rangeLabel: normalizedDateRange.label,
      rangeFrom: normalizedDateRange.from,
      rangeTo: normalizedDateRange.to,
      totalRevenue,
      todayRevenue: totalRevenue,
      totalOrders: orders.length,
      todayOrders: orders.length,
      averageTicket: orders.length > 0 ? totalRevenue / orders.length : 0,
      totalTax,
      todayTax: totalTax,
      ordersByChannel,
      paymentMethodSummary,
      itemSalesSummary,
      storeSalesSummary,
      reconciliation: {
        summary: reconciliationSummary,
        anomalies,
      },
      notifications: {
        summary: notificationSummary,
        anomalies: notificationAnomalies,
      },
    },
  });
});
