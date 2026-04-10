// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

type LoginMode = 'owner' | 'admin' | 'store';

interface InternalLoginRequest {
  mode?: LoginMode;
  pin?: string;
  storeCode?: string;
}

interface InternalUserAccessRow {
  id: string;
  role_id: string;
  full_name: string;
  pin_hash: string;
  store_id: string | null;
  is_active: boolean;
  roles: {
    role_key: LoginMode;
    role_name: string;
    scope_type: 'global' | 'owner' | 'admin' | 'store';
    role_permissions: Array<{
      is_allowed: boolean;
      permissions: {
        permission_key: string;
      } | null;
    }>;
  };
}

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

const isSixDigitPin = (value: string) => /^\d{6}$/.test(value.trim());

const normalizeStoreCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

const isValidIpv4 = (value: string) => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return false;
  }

  return true;
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

  const ipv4WithPortMatch = normalized.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  if (ipv4WithPortMatch) {
    normalized = ipv4WithPortMatch[1];
  }

  return normalized;
};

const extractClientIp = (req: Request): string | null => {
  const candidates = [
    req.headers.get('x-forwarded-for'),
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('forwarded'),
  ];

  for (const rawValue of candidates) {
    if (!rawValue) continue;
    const candidate = normalizeIpCandidate(rawValue);
    if (!candidate) continue;

    if (isValidIpv4(candidate) || isLikelyIpv6(candidate)) {
      return candidate;
    }
  }

  return null;
};

const extractUserAgent = (req: Request): string | null => {
  const userAgent = req.headers.get('user-agent')?.trim() ?? '';
  if (!userAgent) return null;
  return userAgent.slice(0, 1024);
};

const getPermissionKeys = (row: InternalUserAccessRow): string[] => {
  const permissionKeys = (row.roles.role_permissions ?? [])
    .filter((entry) => entry.is_allowed)
    .map((entry) => entry.permissions?.permission_key?.trim())
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey));

  return Array.from(new Set(permissionKeys));
};

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const verifyPin = async (rawPin: string, storedPinHash: string): Promise<boolean> => {
  if (!storedPinHash) return false;
  if (!isBcryptHash(storedPinHash)) {
    return false;
  }

  try {
    return await bcrypt.compare(rawPin, storedPinHash);
  } catch {
    return false;
  }
};

const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MINUTES = 15;

const loadAttemptState = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const { data } = await db
    .from('internal_auth_attempts')
    .select('failure_count, locked_until')
    .eq('attempt_key', attemptKey)
    .maybeSingle();

  return data ?? null;
};

const registerFailedAttempt = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const existing = await loadAttemptState(db, attemptKey);
  const nextFailureCount = Number(existing?.failure_count ?? 0) + 1;
  const lockedUntil = nextFailureCount >= LOCK_THRESHOLD
    ? new Date(Date.now() + LOCK_WINDOW_MINUTES * 60 * 1000).toISOString()
    : null;

  await db
    .from('internal_auth_attempts')
    .upsert({
      attempt_key: attemptKey,
      attempt_scope: 'internal_login',
      failure_count: nextFailureCount,
      first_failed_at: existing ? undefined : new Date().toISOString(),
      last_failed_at: new Date().toISOString(),
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });

  return { nextFailureCount, lockedUntil };
};

const clearFailedAttempts = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  await db
    .from('internal_auth_attempts')
    .delete()
    .eq('attempt_key', attemptKey);
};

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
    return json(500, { error: 'Server is not configured for internal login.' });
  }

  let body: InternalLoginRequest;
  try {
    body = (await req.json()) as InternalLoginRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const mode = body.mode;
  const pin = (body.pin ?? '').trim();
  const storeCode = body.storeCode ? normalizeStoreCode(body.storeCode) : '';

  if (mode !== 'owner' && mode !== 'admin' && mode !== 'store') {
    return json(400, { error: 'mode must be one of owner, admin, or store.' });
  }

  if (!isSixDigitPin(pin)) {
    return json(400, { error: 'pin must be a valid 6-digit string.' });
  }

  if (mode === 'store' && !storeCode) {
    return json(400, { error: 'storeCode is required for store mode.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const clientIp = extractClientIp(req) ?? 'unknown';
  const attemptKey = `${mode}:${storeCode || 'global'}:${clientIp}`;
  const attemptState = await loadAttemptState(db, attemptKey);
  if (attemptState?.locked_until && new Date(attemptState.locked_until) > new Date()) {
    return json(429, { error: 'Too many failed login attempts. Try again later.' });
  }

  // Read candidate users by scope/role, then verify PIN securely in function code.
  let query = db
    .from('internal_users')
    .select(
      'id, role_id, full_name, pin_hash, store_id, is_active, roles!inner(role_key, role_name, scope_type, role_permissions(is_allowed, permissions(permission_key)))'
    )
    .eq('roles.role_key', mode)
    .limit(20);

  if (mode === 'store') {
    query = query
      .select(
        'id, role_id, full_name, pin_hash, store_id, is_active, roles!inner(role_key, role_name, scope_type, role_permissions(is_allowed, permissions(permission_key))), stores!inner(id, code, is_active)'
      )
      .eq('stores.code', storeCode);
  }

  const { data, error } = await query;

  if (error) {
    return json(500, { error: 'Could not validate internal credentials.' });
  }

  const users = (data ?? []) as InternalUserAccessRow[];
  if (users.length === 0) {
    await registerFailedAttempt(db, attemptKey);
    return json(401, { error: 'Invalid PIN.' });
  }

  let user: InternalUserAccessRow | null = null;
  for (const candidate of users) {
    const matched = await verifyPin(pin, candidate.pin_hash);
    if (matched) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    await registerFailedAttempt(db, attemptKey);
    return json(401, { error: 'Invalid PIN.' });
  }

  if (!user.is_active || (mode === 'store' && user.stores && user.stores.is_active === false)) {
    return json(403, { error: 'This login is inactive. Contact the owner.' });
  }

  await clearFailedAttempts(db, attemptKey);

  // Extra scope guards for defense in depth.
  if (mode === 'store') {
    if (user.roles.scope_type !== 'store') {
      return json(403, { error: 'Permission denied for this access mode.' });
    }
    if (!user.store_id) {
      return json(403, { error: 'Permission denied for this access mode.' });
    }
  } else {
    const allowedGlobalScopes = new Set(['global', 'owner', 'admin']);
    if (!allowedGlobalScopes.has(user.roles.scope_type)) {
      return json(403, { error: 'Permission denied for this access mode.' });
    }
  }

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const permissionKeys = getPermissionKeys(user);
  const roleKey = user.roles.role_key;
  const scopeType = user.roles.scope_type;
  const scopeStoreId = scopeType === 'store' ? user.store_id : null;

  const sessionToken = crypto.randomUUID();
  const createdByIp = extractClientIp(req);
  const createdUserAgent = extractUserAgent(req);

  const { data: insertedSession, error: sessionInsertError } = await db
    .from('internal_access_sessions')
    .insert({
      session_token: sessionToken,
      internal_user_id: user.id,
      role_key: roleKey,
      scope_type: scopeType,
      scope_store_id: scopeStoreId,
      expires_at: expiresAt,
      last_seen_at: nowIso,
      created_by_ip: createdByIp,
      created_user_agent: createdUserAgent,
    })
    .select('id, session_token, internal_user_id, role_key, scope_type, scope_store_id, expires_at, last_seen_at, created_at')
    .single();

  if (sessionInsertError || !insertedSession) {
    return json(500, { error: 'Could not create internal access session.' });
  }

  return json(200, {
    userId: user.id,
    roleKey,
    permissionKeys,
    scopeType,
    scopeStoreId,
    expiresAt,
    internalSessionToken: insertedSession.session_token,
    session_token: insertedSession.session_token,
    session: {
      id: insertedSession.id,
      sessionToken: insertedSession.session_token,
      internalUserId: insertedSession.internal_user_id,
      roleKey: insertedSession.role_key,
      scopeType: insertedSession.scope_type,
      scopeStoreId: insertedSession.scope_store_id,
      expiresAt: insertedSession.expires_at,
      lastSeenAt: insertedSession.last_seen_at,
      createdAt: insertedSession.created_at,
    },
  });
});
