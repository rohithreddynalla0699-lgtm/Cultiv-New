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

    if (!payload.customer_id) {
      return null;
    }

    if (payload.iss !== 'cultiv-customer-auth') {
      return null;
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('customer-list-orders token verification failed:', error);
    return null;
  }
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

  let body: { customerSessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  if (!customerSessionToken) {
    return json(400, { success: false, error: 'customerSessionToken is required.' });
  }

  const verifiedSession = await verifyCustomerSessionToken(
    customerSessionToken,
    customerSessionSigningSecret,
  );

  if (!verifiedSession) {
    return json(401, { success: false, error: 'Customer session token is invalid or expired.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: orders, error: ordersError } = await db
    .from('orders')
    .select(`
      order_id,
      customer_id,
      order_type,
      source_channel,
      order_status,
      store_id,
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
      updated_at,
      cancellation_reason,
      order_items (
        order_item_id,
        order_id,
        item_name,
        item_category,
        unit_price,
        quantity,
        order_item_selections (
          order_item_selection_id,
          order_item_id,
          group_name_snapshot,
          option_name
        )
      )
    `)
    .eq('customer_id', verifiedSession.customer_id)
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('customer-list-orders query failed:', ordersError);
    return json(500, { success: false, error: 'Could not load customer orders.' });
  }

  return json(200, {
    success: true,
    orders: orders ?? [],
  });
});