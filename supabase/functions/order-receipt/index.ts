// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';

interface OrderReceiptRequest {
  orderId?: string;
  customerSessionToken?: string;
  internalSessionToken?: string;
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

const DEBUG_LOGS = Deno.env.get('RECEIPT_DEBUG_LOGS') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const redactToken = (token: string | undefined | null) => {
  const normalized = String(token ?? '').trim();
  if (!normalized) return null;
  if (normalized.length <= 10) return `${normalized.slice(0, 2)}***`;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
};

const log = (event: string, details?: Record<string, unknown>) => {
  if (!DEBUG_LOGS) {
    return;
  }
  console.log(`[order-receipt] ${event}`, details ?? {});
};

const logError = (event: string, details?: Record<string, unknown>) => {
  console.error(`[order-receipt] ${event}`, details ?? {});
};

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
};

const verifyCustomerSessionToken = async (token: string, signingSecret: string) => {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signatureBase64] = parts;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(payloadBase64),
    );

    const expectedSignature = new Uint8Array(signatureBuffer);
    const providedSignature = fromBase64Url(signatureBase64);

    if (!constantTimeEqual(expectedSignature, providedSignature)) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadBase64));
    const payload = JSON.parse(payloadJson) as { customer_id?: string; exp?: number; iss?: string };

    if (!payload.customer_id || payload.iss !== 'cultiv-customer-auth') {
      return null;
    }
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const verifyAndLoadInternalSession = async (
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
  return { valid: true, session: data as InternalAccessSessionRow };
};

Deno.serve(async (req) => {
  try {
    log('invoked', {
      method: req.method,
      url: req.url,
    });

    if (req.method === 'OPTIONS') {
      log('cors_preflight');
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      log('method_not_allowed', { method: req.method });
      return json(405, { error: 'Method not allowed.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const customerSessionSigningSecret = Deno.env.get('CUSTOMER_SESSION_SIGNING_SECRET') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      logError('server_misconfigured', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return json(500, { error: 'Server is not configured for receipts.' });
    }

    let body: OrderReceiptRequest;
    try {
      body = await req.json();
    } catch (error) {
      log('invalid_json_body', { error: serializeError(error) });
      return json(400, { error: 'Invalid JSON body.' });
    }

    const orderId = (body.orderId ?? '').trim();
    const customerSessionToken = (body.customerSessionToken ?? '').trim();
    const internalSessionToken = (body.internalSessionToken ?? '').trim();

    log('request_body_received', {
      body: {
        orderId,
        hasCustomerSessionToken: Boolean(customerSessionToken),
        hasInternalSessionToken: Boolean(internalSessionToken),
        customerSessionTokenPreview: redactToken(customerSessionToken),
        internalSessionTokenPreview: redactToken(internalSessionToken),
      },
    });

    if (!orderId) {
      log('bad_request_missing_order_id');
      return json(400, { error: 'orderId is required.' });
    }
    if (!customerSessionToken && !internalSessionToken) {
      log('bad_request_missing_session_token', { orderId });
      return json(400, { error: 'A customer or internal session token is required.' });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let allowedCustomerId: string | null = null;
    let internalScopeStoreId: string | null = null;
    let authContext: 'customer' | 'internal' = internalSessionToken ? 'internal' : 'customer';

    if (internalSessionToken) {
      const verifiedInternalSession = await verifyAndLoadInternalSession(db, internalSessionToken);
      if (!verifiedInternalSession.valid) {
        log('internal_auth_failed', {
          orderId,
          internalSessionTokenPreview: redactToken(internalSessionToken),
          error: verifiedInternalSession.error,
        });
        return json(401, { error: verifiedInternalSession.error });
      }
      internalScopeStoreId = verifiedInternalSession.session.scope_type === 'store'
        ? verifiedInternalSession.session.scope_store_id
        : null;
      authContext = 'internal';
      log('internal_auth_succeeded', {
        orderId,
        internalUserId: verifiedInternalSession.session.internal_user_id,
        roleKey: verifiedInternalSession.session.role_key,
        scopeType: verifiedInternalSession.session.scope_type,
        scopeStoreId: internalScopeStoreId,
      });
    } else {
      if (!customerSessionSigningSecret) {
        log('server_misconfigured_missing_customer_secret', { orderId });
      return json(500, { error: 'Server is not configured for customer receipt access.' });
    }

      const customerSession = await verifyCustomerSessionToken(customerSessionToken, customerSessionSigningSecret);
      if (!customerSession) {
        log('customer_auth_failed', {
          orderId,
          customerSessionTokenPreview: redactToken(customerSessionToken),
        });
        return json(401, { error: 'Customer session token is invalid or expired.' });
      }
      allowedCustomerId = customerSession.customer_id ?? null;
      authContext = 'customer';
      log('customer_auth_succeeded', { orderId, allowedCustomerId });
    }

    const { data: orderRow, error: orderError } = await db
      .from('orders')
      .select(`
        order_id,
        order_number,
        order_status,
        store_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        payment_method,
        subtotal_amount,
        discount_amount,
        tax_amount,
        tip_amount,
        total_amount,
        created_at,
        order_items (
          order_item_id,
          item_name,
          unit_price,
          quantity,
          order_item_selections (
            group_name_snapshot,
            option_name
          )
        )
      `)
      .eq('order_id', orderId)
      .maybeSingle();

    if (orderError) {
      logError('order_query_failed', { orderId, authContext, error: serializeError(orderError) });
      return json(500, { error: 'Could not load order receipt.' });
    }
    if (!orderRow) {
      log('order_not_found', { orderId, authContext });
      return json(404, { error: 'Order not found.' });
    }
    if (allowedCustomerId && orderRow.customer_id !== allowedCustomerId) {
      log('customer_forbidden_for_order', {
        orderId,
        allowedCustomerId,
        orderCustomerId: orderRow.customer_id,
      });
      return json(403, { error: 'This order does not belong to the signed-in customer.' });
    }
    if (internalScopeStoreId && orderRow.store_id !== internalScopeStoreId) {
      log('internal_scope_forbidden_for_order', {
        orderId,
        internalScopeStoreId,
        orderStoreId: orderRow.store_id,
      });
      return json(403, { error: 'Store scope does not allow viewing this receipt.' });
    }

    const { data: storeRow, error: storeError } = await db
      .from('stores')
      .select(`
        id,
        name,
        code,
        phone,
        email,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        legal_name,
        gstin
      `)
      .eq('id', orderRow.store_id)
      .maybeSingle();

    if (storeError) {
      logError('store_query_failed', {
        orderId,
        orderStoreId: orderRow.store_id,
        error: serializeError(storeError),
      });
      return json(500, { error: 'Could not load receipt store details.' });
    }

    const { data: paymentRow, error: paymentError } = await db
      .from('order_payments')
      .select('payment_method, status, reference, recorded_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (paymentError) {
      logError('payment_query_failed', { orderId, error: serializeError(paymentError) });
      return json(500, { error: 'Could not load receipt payment details.' });
    }

    const receiptData = {
      meta: {
        orderNumber: orderRow.order_number || orderRow.order_id,
        orderId: orderRow.order_id,
        createdAt: orderRow.created_at,
        paymentMethod: paymentRow?.payment_method ?? orderRow.payment_method ?? undefined,
        paymentStatus: paymentRow?.status ?? null,
        customerName: orderRow.customer_name ?? undefined,
        customerPhone: orderRow.customer_phone ?? undefined,
        customerEmail: orderRow.customer_email ?? undefined,
        paymentReference: paymentRow?.reference ?? undefined,
      },
      items: (orderRow.order_items ?? []).map((item: any) => {
        const groupedSelections = (item.order_item_selections ?? []).reduce((acc: Record<string, string[]>, selection: any) => {
          const section = selection.group_name_snapshot || 'Selections';
          acc[section] = acc[section] ?? [];
          acc[section].push(selection.option_name);
          return acc;
        }, {});

        return {
          id: item.order_item_id,
          title: item.item_name,
          quantity: Number(item.quantity ?? 0),
          price: Number(item.unit_price ?? 0),
          selections: Object.entries(groupedSelections).map(([section, choices]) => ({
            section,
            choices,
          })),
        };
      }),
      totals: {
        subtotal: Number(orderRow.subtotal_amount ?? 0),
        discount: Number(orderRow.discount_amount ?? 0),
        tax: Number(orderRow.tax_amount ?? 0),
        tip: Number(orderRow.tip_amount ?? 0),
        total: Number(orderRow.total_amount ?? 0),
      },
      business: {
        brandName: 'CULTIV',
        storeName: storeRow?.name ?? 'CULTIV',
        legalName: storeRow?.legal_name ?? '',
        addressLine1: storeRow?.address_line_1 ?? '',
        addressLine2: storeRow?.address_line_2 ?? '',
        city: storeRow?.city ?? '',
        state: storeRow?.state ?? '',
        postalCode: storeRow?.postal_code ?? '',
        country: storeRow?.country ?? 'India',
        phone: storeRow?.phone ?? '',
        email: storeRow?.email ?? '',
        gstin: storeRow?.gstin ?? '',
        code: storeRow?.code ?? '',
      },
    };

    log('receipt_loaded_successfully', {
      orderId,
      authContext,
      storeId: orderRow.store_id,
      customerId: orderRow.customer_id,
      hasPayment: Boolean(paymentRow),
      itemCount: receiptData.items.length,
    });

    return json(200, {
      success: true,
      receipt: receiptData,
    });
  } catch (error) {
    logError('unhandled_error', { error: serializeError(error) });
    return json(500, { error: 'Unexpected error while loading receipt.' });
  }
});
