// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildStoreOperatorCorsHeaders,
  endOperatorSessionById,
  enforceStoreScope,
  extractSessionToken,
  isOperatorSessionExpired,
  json,
  loadLatestOpenOperatorSession,
  STORE_OPERATOR_SESSION_INACTIVITY_TIMEOUT_MS,
  verifyAndLoadSession,
} from '../_shared/store-operator-session.ts';

Deno.serve(async (req) => {
  const corsHeaders = buildStoreOperatorCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(corsHeaders, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(corsHeaders, 500, { error: 'Server is not configured for store operator sessions.' });
  }

  let body: { internalSessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(corsHeaders, 400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(corsHeaders, 400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyAndLoadSession(db, tokenResult.value);
  if (!verifyResult.valid) {
    return json(corsHeaders, 401, { error: verifyResult.error });
  }

  const scopeResult = enforceStoreScope(verifyResult.session);
  if (scopeResult.error) {
    return json(corsHeaders, 403, { error: scopeResult.error });
  }

  const sessionResult = await loadLatestOpenOperatorSession(db, verifyResult.session.id);
  if (sessionResult.error) {
    return json(corsHeaders, sessionResult.status ?? 500, { error: sessionResult.error });
  }

  if (!sessionResult.session?.id) {
    return json(corsHeaders, 404, { error: 'No active store operator session was found.' });
  }

  if (isOperatorSessionExpired(sessionResult.session)) {
    const endResult = await endOperatorSessionById(db, sessionResult.session.id, 'expired');
    if (endResult.error) {
      return json(corsHeaders, endResult.status ?? 500, { error: endResult.error });
    }

    return json(corsHeaders, 404, { error: 'Store operator session expired due to inactivity.' });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + STORE_OPERATOR_SESSION_INACTIVITY_TIMEOUT_MS).toISOString();
  const { data, error } = await db
    .from('store_operator_sessions')
    .update({
      last_activity_at: nowIso,
      expires_at: expiresAt,
      updated_at: nowIso,
    })
    .eq('id', sessionResult.session.id)
    .select('expires_at')
    .single();

  if (error || !data) {
    return json(corsHeaders, 500, { error: 'Could not update store operator session activity.' });
  }

  return json(corsHeaders, 200, {
    success: true,
    lastActivityAt: nowIso,
    expiresAt: data.expires_at,
  });
});
