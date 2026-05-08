// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { canonicalizeOrderPricing } from '../_shared/canonical-pricing.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

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
  tipPercentage?: number;
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

const DEV_LOGS = Deno.env.get('APP_ENV') !== 'production';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const errorResponse = (corsHeaders: Record<string, string>, status: number, code: string, error: string, debug?: Record<string, unknown>) => {
  if (DEV_LOGS && debug) {
    console.error('[internal-create-pos-order]', { status, code, error, ...debug });
  }

  return json(corsHeaders, status, { success: false, code, error });
};

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

const awardPosLoyaltyFallback = async (
  db: ReturnType<typeof createClient>,
  input: {
    orderId: string;
    customerId: string | null;
  },
) => {
  if (!input.customerId) {
    return { awarded: false, reason: 'no_customer' } as const;
  }

  const { data: existingEarn, error: existingEarnError } = await db
    .from('loyalty_points_ledger')
    .select('order_id')
    .eq('order_id', input.orderId)
    .eq('entry_type', 'earn')
    .limit(1);

  if (existingEarnError) {
    throw new Error('Could not verify existing POS loyalty award.');
  }

  if (Array.isArray(existingEarn) && existingEarn.length > 0) {
    await db.rpc('sync_customer_reward_points', {
      p_customer_id: input.customerId,
    });
    return { awarded: false, reason: 'already_awarded' } as const;
  }

  const { data: orderRow, error: orderError } = await db
    .from('orders')
    .select('order_id, customer_id, total_amount, order_status')
    .eq('order_id', input.orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    throw new Error('Could not load completed POS order for loyalty award.');
  }

  if (orderRow.customer_id !== input.customerId || orderRow.order_status !== 'completed') {
    return { awarded: false, reason: 'not_eligible' } as const;
  }

  const { data: rewardSettings } = await db
    .from('reward_program_settings')
    .select('earn_rate_rupees_per_point, points_expiry_days')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const earnRate = Math.max(Number(rewardSettings?.earn_rate_rupees_per_point ?? 10), 1);
  const expiryDays = Math.max(Number(rewardSettings?.points_expiry_days ?? 90), 1);
  const points = Math.floor(Number(orderRow.total_amount ?? 0) / earnRate);

  if (points <= 0) {
    await db.rpc('sync_customer_reward_points', {
      p_customer_id: input.customerId,
    });
    return { awarded: false, reason: 'below_threshold' } as const;
  }

  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await db
    .from('loyalty_points_ledger')
    .insert({
      user_id: input.customerId,
      order_id: input.orderId,
      entry_type: 'earn',
      points,
      points_remaining: points,
      earned_at: nowIso,
      expires_at: expiresAtIso,
      metadata: {
        source: 'pos_counter_completion_fallback',
        earn_rate_rupees_per_point: earnRate,
        points_expiry_days: expiryDays,
        total_amount: Number(orderRow.total_amount ?? 0),
      },
      created_at: nowIso,
      updated_at: nowIso,
    });

  if (insertError && insertError.code !== '23505') {
    throw new Error(insertError.message || 'Could not insert POS loyalty award.');
  }

  await db.rpc('sync_customer_reward_points', {
    p_customer_id: input.customerId,
  });

  return { awarded: !insertError, reason: insertError ? 'already_awarded' : 'awarded' } as const;
};

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, {
    allowedHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-internal-session-token'],
  });
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return errorResponse(corsHeaders, 405, 'INVALID_PAYLOAD', 'Method not allowed.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse(corsHeaders, 500, 'UNKNOWN_ERROR', 'Server is not configured for POS checkout.');
    }

    let body: InternalCreatePosOrderRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'Invalid JSON body.');
    }

    const internalSessionToken = (body.internalSessionToken ?? '').trim();
    const storeId = (body.storeId ?? '').trim();
    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : null;
    const paymentMethod = body.paymentMethod;
    const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
    const subtotal = roundMoney(body.subtotal);
    const taxAmount = roundMoney(body.taxAmount);
    const tipAmount = roundMoney(body.tipAmount);
    const tipPercentage = roundMoney(body.tipPercentage);
    const total = roundMoney(body.total);

    if (!internalSessionToken) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'internalSessionToken is required.');
    }
    if (!isValidUuid(storeId)) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'storeId must be a valid store UUID.');
    }
    if (customerId && !isValidUuid(customerId)) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'customerId must be a valid customer UUID.');
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'upi' && paymentMethod !== 'card') {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'paymentMethod must be cash, upi, or card.');
    }
    if (![subtotal, taxAmount, tipAmount, tipPercentage, total].every((amount) => Number.isFinite(amount) && amount >= 0)) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'subtotal, taxAmount, tipAmount, and total must be non-negative numbers.');
    }
    if (total <= 0) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'total must be greater than zero.');
    }
    if (!validateItems(body.items)) {
      return errorResponse(corsHeaders, 400, 'INVALID_PAYLOAD', 'POS order must include valid items.');
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const verifiedSession = await verifyAndLoadSession(db, internalSessionToken);
    if (!verifiedSession.valid) {
      return errorResponse(corsHeaders, 401, 'INVALID_SESSION', verifiedSession.error);
    }

    const permissionsResult = await loadPermissionKeys(db, verifiedSession.session.internal_user_id);
    if (permissionsResult.error) {
      return errorResponse(corsHeaders, 500, 'UNKNOWN_ERROR', permissionsResult.error);
    }

    if (!permissionsResult.permissionKeys.includes('can_access_pos')) {
      return errorResponse(corsHeaders, 403, 'MISSING_PERMISSION', 'You do not have permission to create POS orders.');
    }

    if (verifiedSession.session.scope_type === 'store' && verifiedSession.session.scope_store_id !== storeId) {
      return errorResponse(corsHeaders, 403, 'STORE_SCOPE_DENIED', 'Store scope does not allow checkout for this store.');
    }

    let canonicalPricing;
    try {
      canonicalPricing = await canonicalizeOrderPricing(db, {
        items: body.items.map((item) => ({
          itemId: item.itemId,
          title: item.title,
          category: item.category,
          quantity: item.quantity,
          price: item.price,
          selections: item.selections,
        })),
        requestedSubtotal: subtotal,
        requestedTaxAmount: taxAmount,
        requestedTipAmount: tipAmount,
        requestedTipPercentage: tipPercentage,
        requestedTotal: total,
        requestedDiscount: 0,
      });
    } catch (error) {
      return errorResponse(
        corsHeaders,
        400,
        'PRICING_MISMATCH',
        error instanceof Error ? error.message : 'Invalid POS pricing payload.',
      );
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
      p_subtotal_amount: canonicalPricing.subtotal,
      p_tax_amount: canonicalPricing.taxAmount,
      p_tip_amount: canonicalPricing.tipAmount,
      p_total_amount: canonicalPricing.total,
      p_items: canonicalPricing.items.map((item) => ({
        itemId: item.menu_item_id,
        title: item.item_name,
        category: item.item_category,
        quantity: item.quantity,
        price: item.unit_price,
        selections: item.selections,
      })),
    });

    if (rpcError || !rpcResult) {
      const safeMessage = rpcError?.message ?? 'Could not complete POS checkout.';
      const lowerMessage = safeMessage.toLowerCase();
      const code = lowerMessage.includes('payment')
        ? 'PAYMENT_RECORD_FAILED'
        : 'ORDER_CREATION_FAILED';

      return errorResponse(corsHeaders, 500, code, safeMessage, { rpcError, storeId, customerId });
    }

    if (customerId && rpcResult.orderId) {
      const { error: loyaltyAwardError } = await db.rpc('award_loyalty_for_completed_order', {
        p_order_id: rpcResult.orderId,
        p_award_source: 'pos_counter_completion_edge',
      });

      if (loyaltyAwardError) {
        if (DEV_LOGS) {
          console.error('[internal-create-pos-order] award_loyalty_for_completed_order failed, attempting fallback', {
            orderId: rpcResult.orderId,
            customerId,
            loyaltyAwardError,
          });
        }

        await awardPosLoyaltyFallback(db, {
          orderId: rpcResult.orderId,
          customerId,
        });
      }
    }

    return json(corsHeaders, 200, {
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
  } catch (error) {
    return errorResponse(corsHeaders, 500, 'UNKNOWN_ERROR', 'Could not complete POS checkout.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
