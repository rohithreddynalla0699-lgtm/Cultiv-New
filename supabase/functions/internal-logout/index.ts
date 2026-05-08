// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCorsHeaders } from '../_shared/cors.ts';

const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, {
    allowedHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-internal-session-token'],
  });
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(corsHeaders, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(corsHeaders, 500, { error: 'Server is not configured for internal logout.' });
  }


  // Read session token from custom header
  const sessionToken = req.headers.get('x-internal-session-token')?.trim() || '';
  if (!sessionToken) {
    // Always return success for idempotency
    return json(corsHeaders, 200, { success: true });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });


  const nowIso = new Date().toISOString();
  const { data: sessionRow } = await db
    .from('internal_access_sessions')
    .select('id')
    .eq('session_token', sessionToken)
    .maybeSingle();

  await db
    .from('internal_access_sessions')
    .update({
      revoked_at: nowIso,
      revoked_reason: 'logout',
    })
    .eq('session_token', sessionToken)
    .is('revoked_at', null);

  if (sessionRow?.id) {
    await db
      .from('store_operator_sessions')
      .update({
        ended_at: nowIso,
        ended_reason: 'logout',
        updated_at: nowIso,
      })
      .eq('internal_access_session_id', sessionRow.id)
      .is('ended_at', null);
  }

  // Always return success, never expose session details
  return json(corsHeaders, 200, { success: true });
});
