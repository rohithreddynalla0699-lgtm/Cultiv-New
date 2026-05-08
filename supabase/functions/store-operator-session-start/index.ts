// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildStoreOperatorCorsHeaders,
  endActiveOperatorSessions,
  enforceStoreScope,
  extractClientIp,
  extractSessionToken,
  extractUserAgent,
  json,
  loadEmployeeForStore,
  loadOpenShiftForEmployee,
  mapOperatorSessionResponse,
  STORE_OPERATOR_SESSION_EXPIRY_MS,
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

  let body: {
    internalSessionToken?: string;
    employeeId?: string;
    deviceId?: string;
    deviceName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(corsHeaders, 400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(corsHeaders, 400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const employeeId = (body.employeeId ?? '').trim();
  if (!employeeId) {
    return json(corsHeaders, 400, { error: 'employeeId is required.' });
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
  if (scopeResult.error || !scopeResult.storeId) {
    return json(corsHeaders, 403, { error: scopeResult.error ?? 'Store scope is required.' });
  }

  const employeeResult = await loadEmployeeForStore(db, employeeId, scopeResult.storeId);
  if (employeeResult.error || !employeeResult.employee) {
    return json(corsHeaders, employeeResult.status ?? 500, { error: employeeResult.error ?? 'Could not validate selected employee.' });
  }

  const shiftResult = await loadOpenShiftForEmployee(db, employeeId, scopeResult.storeId);
  if (shiftResult.error || !shiftResult.shift) {
    return json(corsHeaders, shiftResult.status ?? 500, { error: shiftResult.error ?? 'Could not inspect the current shift state.' });
  }

  const endResult = await endActiveOperatorSessions(db, verifyResult.session.id, 'replaced');
  if (endResult.error) {
    return json(corsHeaders, endResult.status ?? 500, { error: endResult.error });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + STORE_OPERATOR_SESSION_EXPIRY_MS).toISOString();
  const deviceId = typeof body.deviceId === 'string' && body.deviceId.trim() ? body.deviceId.trim().slice(0, 255) : null;
  const deviceName = typeof body.deviceName === 'string' && body.deviceName.trim() ? body.deviceName.trim().slice(0, 255) : null;

  const { data, error } = await db
    .from('store_operator_sessions')
    .insert({
      session_token: crypto.randomUUID(),
      internal_access_session_id: verifyResult.session.id,
      internal_user_id: verifyResult.session.internal_user_id,
      employee_id: employeeResult.employee.id,
      shift_id: shiftResult.shift.shift_id,
      store_id: scopeResult.storeId,
      device_id: deviceId,
      device_name: deviceName,
      started_at: nowIso,
      last_activity_at: nowIso,
      expires_at: expiresAt,
      is_locked: false,
      created_by_ip: extractClientIp(req),
      created_user_agent: extractUserAgent(req),
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, session_token, internal_access_session_id, internal_user_id, employee_id, shift_id, store_id, device_id, device_name, started_at, last_activity_at, expires_at, ended_at, ended_reason, is_locked, employees!inner(full_name, employee_role)')
    .single();

  if (error || !data) {
    return json(corsHeaders, 500, { error: 'Could not create store operator session.' });
  }

  return json(corsHeaders, 200, {
    success: true,
    session: mapOperatorSessionResponse(data),
  });
});
