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
    };

    if (!payload.customer_id || payload.iss !== 'cultiv-customer-auth') {
      return null;
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[customer-get-profile] token verification failed', error);
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

  const verifiedSession = await verifyCustomerSessionToken(customerSessionToken, customerSessionSigningSecret);
  if (!verifiedSession?.customer_id) {
    return json(401, { success: false, error: 'Customer session token is invalid or expired.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error } = await db
    .from('customers')
    .select('id, full_name, email, phone, reward_points, phone_verified, email_verified, created_at, is_active')
    .eq('id', verifiedSession.customer_id)
    .maybeSingle();

  if (error) {
    console.error('[customer-get-profile] customer lookup failed', error);
    return json(500, { success: false, error: 'Could not load customer profile.' });
  }

  if (!customer || customer.is_active === false) {
    return json(404, { success: false, error: 'Customer account is unavailable.' });
  }

  return json(200, {
    success: true,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email ?? '',
      phone: customer.phone,
      reward_points: Number(customer.reward_points ?? 0),
      phone_verified: Boolean(customer.phone_verified),
      email_verified: Boolean(customer.email_verified),
      created_at: customer.created_at,
    },
  });
});
