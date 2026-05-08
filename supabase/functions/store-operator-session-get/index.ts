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
  mapOperatorSessionResponse,
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

  if (sessionResult.session?.id && isOperatorSessionExpired(sessionResult.session)) {
    const endResult = await endOperatorSessionById(db, sessionResult.session.id, 'expired');
    if (endResult.error) {
      return json(corsHeaders, endResult.status ?? 500, { error: endResult.error });
    }

    return json(corsHeaders, 200, {
      success: true,
      session: null,
    });
  }

  if (sessionResult.session?.id && sessionResult.session.shift_id) {
    const { data: shift, error: shiftError } = await db
      .from('employee_shifts')
      .select('shift_id, clock_out_at')
      .eq('shift_id', sessionResult.session.shift_id)
      .maybeSingle();

    if (shiftError) {
      return json(corsHeaders, 500, { error: 'Could not validate the linked shift for this operator session.' });
    }

    if (!shift?.shift_id || shift.clock_out_at !== null) {
      const endResult = await endOperatorSessionById(db, sessionResult.session.id, 'clock_out');
      if (endResult.error) {
        return json(corsHeaders, endResult.status ?? 500, { error: endResult.error });
      }

      return json(corsHeaders, 200, {
        success: true,
        session: null,
      });
    }
  }

  return json(corsHeaders, 200, {
    success: true,
    session: mapOperatorSessionResponse(sessionResult.session),
  });
});
