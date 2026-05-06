// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Server is not configured.' });
  }

  let body: { customerSessionToken?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  const fullName = (body.fullName ?? '').trim();

  if (!customerSessionToken) {
    return jsonResponse(400, { success: false, error: 'Customer session token is required.' });
  }

  if (!fullName) {
    return jsonResponse(400, { success: false, error: 'Full name is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return jsonResponse(401, { success: false, error: verifiedSession.error });
  }

  const { data: customer, error } = await db
    .from('customers')
    .update({ full_name: fullName })
    .eq('id', verifiedSession.session.customer_id)
    .select('id, full_name, email, phone')
    .maybeSingle();

  if (error) {
    console.error('[customer-update-profile] update failed', error);
    return jsonResponse(500, { success: false, error: 'Could not update profile.' });
  }

  if (!customer) {
    return jsonResponse(404, { success: false, error: 'Customer not found.' });
  }

  return jsonResponse(200, {
    success: true,
    message: 'Profile updated successfully.',
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
    },
  });
});
