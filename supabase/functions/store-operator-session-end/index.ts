// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  enforceStoreScope,
  extractSessionToken,
  json,
  loadActiveOperatorSession,
  verifyAndLoadSession,
} from '../_shared/store-operator-session.ts';

const ALLOWED_REASONS = new Set(['clock_out', 'logout', 'expired', 'manual', 'replaced']);

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

  let body: { internalSessionToken?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const reason = (body.reason ?? 'manual').trim();
  if (!ALLOWED_REASONS.has(reason)) {
    return json(400, { error: 'reason must be one of clock_out, logout, expired, manual, or replaced.' });
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

  if (!sessionResult.session?.id) {
    return json(200, { success: true, ended: false });
  }

  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('store_operator_sessions')
    .update({
      ended_at: nowIso,
      ended_reason: reason,
      updated_at: nowIso,
    })
    .eq('id', sessionResult.session.id)
    .is('ended_at', null);

  if (error) {
    return json(500, { error: 'Could not end store operator session.' });
  }

  return json(200, { success: true, ended: true });
});
