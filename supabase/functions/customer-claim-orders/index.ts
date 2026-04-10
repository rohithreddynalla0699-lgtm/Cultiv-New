// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const normalizePhone = (value: string | null | undefined) => String(value ?? '').replace(/\D/g, '').slice(-10);
const normalizeEmail = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

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
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
};

const verifyCustomerSessionToken = async (token: string, signingSecret: string) => {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

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
    const payload = JSON.parse(payloadJson) as {
      customer_id?: string;
      exp?: number;
      iss?: string;
      email?: string;
      phone?: string;
    };

    if (!payload.customer_id || payload.iss !== 'cultiv-customer-auth') {
      return null;
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[customer-claim-orders] token verification failed', error);
    return null;
  }
};

const loadEligibleGuestOrders = async (
  db: ReturnType<typeof createClient>,
  input: { phone: string; email: string },
) => {
  const matches = new Map<string, Record<string, unknown>>();

  if (input.phone) {
    const { data, error } = await db
      .from('orders')
      .select('order_id, created_at, total_amount, customer_name, customer_phone, customer_email, source_channel, order_status')
      .is('customer_id', null)
      .eq('source_channel', 'app')
      .eq('customer_phone', input.phone)
      .order('created_at', { ascending: false });

    if (error) {
      return { error: `Phone-based guest-order lookup failed: ${error.message}` };
    }

    (data ?? []).forEach((row) => {
      matches.set(String(row.order_id), row as Record<string, unknown>);
    });
  }

  if (input.email) {
    const { data, error } = await db
      .from('orders')
      .select('order_id, created_at, total_amount, customer_name, customer_phone, customer_email, source_channel, order_status')
      .is('customer_id', null)
      .eq('source_channel', 'app')
      .eq('customer_email', input.email)
      .order('created_at', { ascending: false });

    if (error) {
      return { error: `Email-based guest-order lookup failed: ${error.message}` };
    }

    (data ?? []).forEach((row) => {
      matches.set(String(row.order_id), row as Record<string, unknown>);
    });
  }

  return {
    orders: Array.from(matches.values()).sort((left, right) => (
      new Date(String(right.created_at ?? '')).getTime() - new Date(String(left.created_at ?? '')).getTime()
    )),
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const customerSessionSigningSecret = Deno.env.get('CUSTOMER_SESSION_SIGNING_SECRET') || '';

  if (!supabaseUrl || !serviceRoleKey || !customerSessionSigningSecret) {
    return json(500, { success: false, error: 'Server is not configured.' });
  }

  let body: { customerSessionToken?: string; mode?: 'preview' | 'claim' };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  const mode = body.mode === 'claim' ? 'claim' : 'preview';

  if (!customerSessionToken) {
    return json(400, { success: false, error: 'customerSessionToken is required.' });
  }

  const verifiedSession = await verifyCustomerSessionToken(customerSessionToken, customerSessionSigningSecret);
  if (!verifiedSession?.customer_id) {
    return json(401, { success: false, error: 'Customer session token is invalid or expired.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, full_name, email, phone, is_active')
    .eq('id', verifiedSession.customer_id)
    .maybeSingle();

  if (customerError) {
    console.error('[customer-claim-orders] customer lookup failed', customerError);
    return json(500, { success: false, error: 'Could not verify customer profile.' });
  }

  if (!customer || customer.is_active === false) {
    return json(401, { success: false, error: 'Customer account is unavailable.' });
  }

  const normalizedPhone = normalizePhone(customer.phone ?? verifiedSession.phone);
  const normalizedEmail = normalizeEmail(customer.email ?? verifiedSession.email);

  if (!normalizedPhone && !normalizedEmail) {
    return json(400, { success: false, error: 'Customer account does not have a verified claimable contact value.' });
  }

  const eligibleResult = await loadEligibleGuestOrders(db, {
    phone: normalizedPhone,
    email: normalizedEmail,
  });

  if (eligibleResult.error) {
    console.error('[customer-claim-orders] eligible order lookup failed', {
      customerId: customer.id,
      error: eligibleResult.error,
    });
    return json(500, { success: false, error: 'Could not load claimable guest orders.' });
  }

  const eligibleOrders = eligibleResult.orders ?? [];

  if (mode === 'preview') {
    return json(200, {
      success: true,
      mode,
      eligibleCount: eligibleOrders.length,
      orders: eligibleOrders.map((row) => ({
        orderId: row.order_id,
        createdAt: row.created_at,
        total: Number(row.total_amount ?? 0),
        customerName: row.customer_name ?? null,
        customerPhone: row.customer_phone ?? null,
        customerEmail: row.customer_email ?? null,
        orderStatus: row.order_status ?? null,
      })),
    });
  }

  if (eligibleOrders.length === 0) {
    return json(200, {
      success: true,
      mode,
      claimedCount: 0,
      orders: [],
    });
  }

  const eligibleOrderIds = eligibleOrders.map((row) => String(row.order_id));
  const { data: claimedRows, error: claimError } = await db
    .from('orders')
    .update({
      customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .in('order_id', eligibleOrderIds)
    .is('customer_id', null)
    .select('order_id, created_at, total_amount, customer_name, customer_phone, customer_email, order_status');

  if (claimError) {
    console.error('[customer-claim-orders] claim update failed', {
      customerId: customer.id,
      eligibleOrderIds,
      error: claimError,
    });
    return json(500, { success: false, error: 'Could not claim guest orders.' });
  }

  return json(200, {
    success: true,
    mode,
    claimedCount: (claimedRows ?? []).length,
    orders: (claimedRows ?? []).map((row) => ({
      orderId: row.order_id,
      createdAt: row.created_at,
      total: Number(row.total_amount ?? 0),
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      customerEmail: row.customer_email ?? null,
      orderStatus: row.order_status ?? null,
    })),
  });
});
