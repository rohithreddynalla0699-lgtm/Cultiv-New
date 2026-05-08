// @ts-nocheck
import { createCorsHeaders } from './cors.ts';

export const STORE_OPERATOR_SESSION_EXPIRY_MS = 12 * 60 * 60 * 1000;

export const buildStoreOperatorCorsHeaders = (req: Request) => createCorsHeaders(req, {
  allowedHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-internal-session-token'],
});

export const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const isValidIpv4 = (value: string) => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

const isLikelyIpv6 = (value: string) => value.includes(':') && /^[0-9a-fA-F:]+$/.test(value);

const normalizeIpCandidate = (value: string): string => {
  let normalized = value.trim();

  if (normalized.toLowerCase().startsWith('for=')) {
    normalized = normalized.slice(4).trim();
  }

  normalized = normalized.replace(/^"|"$/g, '');

  if (normalized.includes(',')) {
    normalized = normalized.split(',')[0].trim();
  }

  if (normalized.startsWith('[') && normalized.includes(']')) {
    normalized = normalized.slice(1, normalized.indexOf(']'));
  }

  const ipv4WithPortMatch = normalized.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPortMatch) {
    normalized = ipv4WithPortMatch[1];
  }

  return normalized;
};

export const extractClientIp = (req: Request): string | null => {
  const candidates = [
    req.headers.get('x-forwarded-for'),
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('forwarded'),
  ];

  for (const rawValue of candidates) {
    if (!rawValue) continue;
    const candidate = normalizeIpCandidate(rawValue);
    if (isValidIpv4(candidate) || isLikelyIpv6(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const extractUserAgent = (req: Request): string | null => {
  const userAgent = req.headers.get('user-agent')?.trim() ?? '';
  if (!userAgent) return null;
  return userAgent.slice(0, 1024);
};

export const extractSessionToken = (body: { internalSessionToken?: string }) => {
  const token = (body.internalSessionToken ?? '').trim();
  if (!token) {
    return { error: 'internalSessionToken is required.' };
  }
  return { value: token };
};

export const verifyAndLoadSession = async (db: any, token: string) => {
  const { data, error } = await db
    .from('internal_access_sessions')
    .select('id, session_token, internal_user_id, role_key, scope_type, scope_store_id, expires_at, revoked_at, last_seen_at')
    .eq('session_token', token)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Internal session not found.' };
  }

  if (data.revoked_at !== null) {
    return { valid: false, error: 'Internal session has been revoked.' };
  }

  if (new Date(data.expires_at) <= new Date()) {
    return { valid: false, error: 'Internal session has expired.' };
  }

  db
    .from('internal_access_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('session_token', token)
    .then(() => {})
    .catch(() => {});

  return { valid: true, session: data };
};

export const enforceStoreScope = (session: { scope_type: string; scope_store_id: string | null }) => {
  if (session.scope_type !== 'store' || !session.scope_store_id) {
    return { error: 'Store operator sessions require a store-scoped internal session.' };
  }

  return { storeId: session.scope_store_id };
};

export const loadEmployeeForStore = async (db: any, employeeId: string, storeId: string) => {
  const { data, error } = await db
    .from('employees')
    .select('id, full_name, employee_role, store_id, is_active, is_deleted')
    .eq('id', employeeId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) {
    return { error: 'Could not validate selected employee.', status: 500 };
  }

  if (!data?.id) {
    return { error: 'Employee is not active in this store.', status: 403 };
  }

  return { employee: data };
};

export const loadOpenShiftForEmployee = async (db: any, employeeId: string, storeId: string) => {
  const { data, error } = await db
    .from('employee_shifts')
    .select('shift_id, employee_id, store_id, shift_date, clock_in_at, clock_out_at, total_hours')
    .eq('employee_id', employeeId)
    .eq('store_id', storeId)
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: 'Could not inspect the current shift state.', status: 500 };
  }

  if (!data?.shift_id) {
    return { error: 'Employee must have an open shift in this store before starting an operator session.', status: 409 };
  }

  return { shift: data };
};

const activeSessionSelect =
  'id, session_token, internal_access_session_id, internal_user_id, employee_id, shift_id, store_id, device_id, device_name, started_at, last_activity_at, expires_at, ended_at, ended_reason, is_locked, employees!inner(full_name, employee_role)';

export const loadActiveOperatorSession = async (db: any, internalAccessSessionId: string) => {
  const { data, error } = await db
    .from('store_operator_sessions')
    .select(activeSessionSelect)
    .eq('internal_access_session_id', internalAccessSessionId)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: 'Could not load store operator session.', status: 500 };
  }

  return { session: data ?? null };
};

export const endActiveOperatorSessions = async (
  db: any,
  internalAccessSessionId: string,
  reason: string,
) => {
  const nowIso = new Date().toISOString();

  const { error } = await db
    .from('store_operator_sessions')
    .update({
      ended_at: nowIso,
      ended_reason: reason,
      updated_at: nowIso,
    })
    .eq('internal_access_session_id', internalAccessSessionId)
    .is('ended_at', null);

  if (error) {
    return { error: 'Could not end existing active store operator session.', status: 500 };
  }

  return { endedAt: nowIso };
};

export const mapOperatorSessionResponse = (row: any) => {
  if (!row) return null;

  return {
    id: row.id,
    sessionToken: row.session_token,
    internalAccessSessionId: row.internal_access_session_id,
    internalUserId: row.internal_user_id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? null,
    employeeRole: row.employees?.employee_role ?? null,
    shiftId: row.shift_id,
    storeId: row.store_id,
    deviceId: row.device_id ?? null,
    deviceName: row.device_name ?? null,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    isLocked: Boolean(row.is_locked),
  };
};
