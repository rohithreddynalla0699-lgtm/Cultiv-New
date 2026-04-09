// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fromBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const constantTimeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};

const verifyCustomerSessionToken = async (token, signingSecret) => {
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
    const payload = JSON.parse(payloadJson);

    if (!payload.customer_id) return null;
    if (payload.iss !== 'cultiv-customer-auth') return null;
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return null;

    return payload;
  } catch (error) {
    console.error('loyalty-summary token verification failed:', error);
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const customerSessionSigningSecret = Deno.env.get('CUSTOMER_SESSION_SIGNING_SECRET') || '';

  if (!supabaseUrl || !serviceRoleKey || !customerSessionSigningSecret) {
    return new Response(JSON.stringify({ error: 'Server is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  if (!customerSessionToken) {
    return new Response(JSON.stringify({ error: 'customerSessionToken is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const verifiedSession = await verifyCustomerSessionToken(
    customerSessionToken,
    customerSessionSigningSecret,
  );

  if (!verifiedSession) {
    return new Response(JSON.stringify({ error: 'Customer session token is invalid or expired.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: batches, error } = await db
    .from('loyalty_points_ledger')
    .select('order_id, points, points_remaining, earned_at, expires_at, created_at')
    .eq('user_id', verifiedSession.customer_id)
    .eq('entry_type', 'earn')
    .gt('points_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .order('earned_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loyalty-summary query failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to load loyalty summary' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const availablePoints = (batches ?? []).reduce(
    (sum, batch) => sum + Number(batch.points_remaining || 0),
    0,
  );

  const { data: recentActivity, error: activityError } = await db
    .from('loyalty_points_ledger')
    .select('order_id, entry_type, points, points_remaining, earned_at, expires_at, created_at, metadata')
    .eq('user_id', verifiedSession.customer_id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (activityError) {
    console.error('loyalty-summary recent activity query failed:', activityError);
    return new Response(JSON.stringify({ error: 'Failed to load loyalty summary' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    availablePoints,
    activeBatches: batches ?? [],
    recentActivity: recentActivity ?? [],
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
