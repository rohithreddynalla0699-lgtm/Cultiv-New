// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (!supabaseUrl || !serviceRoleKey) {
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

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return new Response(JSON.stringify({ error: verifiedSession.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: batches, error } = await db
    .from('loyalty_points_ledger')
    .select('order_id, points, points_remaining, earned_at, expires_at, created_at')
    .eq('user_id', verifiedSession.session.customer_id)
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
    .eq('user_id', verifiedSession.session.customer_id)
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
