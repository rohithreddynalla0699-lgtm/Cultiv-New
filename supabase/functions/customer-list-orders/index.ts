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
    .eq('customer_id', verifiedSession.session.customer_id)
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
