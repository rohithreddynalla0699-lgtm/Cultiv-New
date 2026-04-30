// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
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
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server is not configured for internal logout.' });
  }


  // Read session token from custom header
  const sessionToken = req.headers.get('x-internal-session-token')?.trim() || '';
  if (!sessionToken) {
    // Always return success for idempotency
    return json(200, { success: true });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });


  // Update unrevoked session by token, regardless of expiry
  const nowIso = new Date().toISOString();
  await db
    .from('internal_access_sessions')
    .update({
      revoked_at: nowIso,
      revoked_reason: 'logout',
    })
    .eq('session_token', sessionToken)
    .is('revoked_at', null);

  // Always return success, never expose session details
  return json(200, { success: true });
});
