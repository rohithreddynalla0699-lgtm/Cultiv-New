// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  enforceStoreScope,
  extractSessionToken,
  json,
  loadActiveOperatorSession,
  mapOperatorSessionResponse,
  verifyAndLoadSession,
} from '../_shared/store-operator-session.ts';

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
    return json(500, { error: 'Server is not configured for store operator sessions.' });
  }

  let body: { internalSessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyAndLoadSession(db, tokenResult.value);
  if (!verifyResult.valid) {
    return json(401, { error: verifyResult.error });
  }

  const scopeResult = enforceStoreScope(verifyResult.session);
  if (scopeResult.error) {
    return json(403, { error: scopeResult.error });
  }

  const sessionResult = await loadActiveOperatorSession(db, verifyResult.session.id);
  if (sessionResult.error) {
    return json(sessionResult.status ?? 500, { error: sessionResult.error });
  }

  if (sessionResult.session?.id && sessionResult.session.shift_id) {
    const { data: shift, error: shiftError } = await db
      .from('employee_shifts')
      .select('shift_id, clock_out_at')
      .eq('shift_id', sessionResult.session.shift_id)
      .maybeSingle();

    if (shiftError) {
      return json(500, { error: 'Could not validate the linked shift for this operator session.' });
    }

    if (!shift?.shift_id || shift.clock_out_at !== null) {
      const nowIso = new Date().toISOString();
      const { error: endError } = await db
        .from('store_operator_sessions')
        .update({
          ended_at: nowIso,
          ended_reason: 'clock_out',
          updated_at: nowIso,
        })
        .eq('id', sessionResult.session.id)
        .is('ended_at', null);

      if (endError) {
        return json(500, { error: 'Could not reconcile store operator session state.' });
      }

      return json(200, {
        success: true,
        session: null,
      });
    }
  }

  return json(200, {
    success: true,
    session: mapOperatorSessionResponse(sessionResult.session),
  });
});
