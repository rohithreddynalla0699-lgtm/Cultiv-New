// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { revokeCustomerSessionByToken, verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';

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
    return json(200, { success: true });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken, { touch: false });
  if (verifiedSession.valid) {
    await revokeCustomerSessionByToken(db, customerSessionToken);
  }

  return json(200, { success: true });
});
