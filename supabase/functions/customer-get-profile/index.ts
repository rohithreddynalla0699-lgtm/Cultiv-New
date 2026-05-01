// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
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

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return json(401, { success: false, error: verifiedSession.error });
  }

  const { data: customer, error } = await db
    .from('customers')
    .select('id, full_name, email, phone, reward_points, phone_verified, email_verified, created_at, is_active')
    .eq('id', verifiedSession.session.customer_id)
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
