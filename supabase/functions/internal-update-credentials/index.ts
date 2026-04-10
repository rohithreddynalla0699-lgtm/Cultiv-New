// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type CredentialAction = 'list_store_targets' | 'update_credential';
type CredentialTargetType = 'employee' | 'internal_user';

interface InternalUpdateCredentialsRequest {
  internalSessionToken?: string;
  action?: CredentialAction;
  targetType?: CredentialTargetType;
  roleFilter?: 'admin' | 'store';
  targetId?: string;
  newPin?: string;
  revokeExistingSessions?: boolean;
}

interface InternalAccessSessionRow {
  id: string;
  session_token: string;
  internal_user_id: string;
  role_key: RoleKey;
  scope_type: ScopeType;
  scope_store_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
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

const parsePin = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(normalized)) return null;
  return normalized;
};

const verifyAndLoadSession = async (
  db: ReturnType<typeof createClient>,
  token: string,
): Promise<{ valid: true; session: InternalAccessSessionRow } | { valid: false; error: string }> => {
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

  return { valid: true, session: data as InternalAccessSessionRow };
};

const loadPermissionKeys = async (db: ReturnType<typeof createClient>, internalUserId: string) => {
  const { data, error } = await db
    .from('internal_users')
    .select('roles!inner(role_permissions(is_allowed, permissions(permission_key)))')
    .eq('id', internalUserId)
    .single();

  if (error || !data) {
    return { error: 'Could not load internal user permissions.' };
  }

  const permissionKeys = ((data.roles?.role_permissions ?? []) as Array<{ is_allowed?: boolean; permissions?: { permission_key?: string | null } | null }>)
    .filter((entry) => entry.is_allowed)
    .map((entry) => entry.permissions?.permission_key?.trim())
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey));

  return { permissionKeys: Array.from(new Set(permissionKeys)) };
};

const enforcePermission = async (
  db: ReturnType<typeof createClient>,
  internalUserId: string,
  permissionKey: string,
  fallbackMessage: string,
) => {
  const result = await loadPermissionKeys(db, internalUserId);
  if (result.error) {
    return { allowed: false, status: 500, error: result.error };
  }

  if (!result.permissionKeys.includes(permissionKey)) {
    return { allowed: false, status: 403, error: fallbackMessage };
  }

  return { allowed: true };
};

const listInternalUserTargets = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  roleFilter: 'admin' | 'store',
) => {
  const permission = await enforcePermission(
    db,
    session.internal_user_id,
    'can_manage_stores',
    'You do not have permission to manage internal access credentials.',
  );

  if (!permission.allowed) {
    return json(permission.status ?? 403, { error: permission.error ?? 'Not allowed.' });
  }

  if (session.scope_type === 'store') {
    return json(403, { error: 'Store-scoped sessions cannot manage internal login credentials.' });
  }

  const { data, error } = await db
    .from('internal_users')
    .select('id, full_name, is_active, store_id, stores!inner(id, name, code, city, is_active), roles!inner(role_key, scope_type)')
    .eq('roles.role_key', roleFilter)
    .order('full_name', { ascending: true });

  if (error) {
    return json(500, { error: 'Could not load internal access targets.' });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    full_name: string;
    is_active: boolean;
    store_id: string | null;
    stores?: { id: string; name: string; code: string; city: string | null; is_active: boolean } | null;
    roles?: { role_key: string; scope_type: string } | null;
  }>;

  return json(200, {
    success: true,
    targets: rows
      .filter((row) => roleFilter === 'admin' || (row.store_id && row.stores?.id))
      .map((row) => ({
        internalUserId: row.id,
        fullName: row.full_name,
        isActive: Boolean(row.is_active),
        roleKey: row.roles?.role_key ?? roleFilter,
        storeId: row.stores?.id ?? row.store_id ?? null,
        storeName: row.stores?.name ?? null,
        storeCode: row.stores?.code ?? null,
        storeCity: row.stores?.city ?? null,
        storeIsActive: row.stores?.is_active == null ? null : Boolean(row.stores?.is_active),
      })),
  });
};

const updateEmployeeCredential = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  targetId: string,
  newPin: string,
) => {
  const permission = await enforcePermission(
    db,
    session.internal_user_id,
    'can_manage_employees',
    'You do not have permission to update employee shift PINs.',
  );

  if (!permission.allowed) {
    return json(permission.status ?? 403, { error: permission.error ?? 'Not allowed.' });
  }

  const { data: employee, error: employeeError } = await db
    .from('employees')
    .select('id, full_name, employee_role, store_id, is_active')
    .eq('id', targetId)
    .maybeSingle();

  if (employeeError) {
    return json(500, { error: 'Could not load employee credentials target.' });
  }

  if (!employee) {
    return json(404, { error: 'Employee not found.' });
  }

  if (session.scope_type === 'store' && session.scope_store_id !== employee.store_id) {
    return json(403, { error: 'Store scope does not allow updating this employee PIN.' });
  }

  const pinHash = await bcrypt.hash(newPin, 10);
  const { error: updateError } = await db
    .from('employees')
    .update({
      pin_hash: pinHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employee.id);

  if (updateError) {
    return json(500, { error: 'Could not update employee PIN.' });
  }

  return json(200, {
    success: true,
    targetType: 'employee',
    targetId: employee.id,
    message: `Updated shift PIN for ${employee.full_name}.`,
    revokedSessions: false,
  });
};

const updateInternalUserCredential = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  targetId: string,
  newPin: string,
  revokeExistingSessions: boolean,
) => {
  const permission = await enforcePermission(
    db,
    session.internal_user_id,
    'can_manage_stores',
    'You do not have permission to update store login credentials.',
  );

  if (!permission.allowed) {
    return json(permission.status ?? 403, { error: permission.error ?? 'Not allowed.' });
  }

  const { data: targetUser, error: targetError } = await db
    .from('internal_users')
    .select('id, full_name, store_id, is_active, roles!inner(role_key, scope_type), stores(id, name, code, is_active)')
    .eq('id', targetId)
    .maybeSingle();

  if (targetError) {
    return json(500, { error: 'Could not load internal credential target.' });
  }

  if (!targetUser) {
    return json(404, { error: 'Internal user not found.' });
  }

  if (targetUser.roles?.role_key === 'owner') {
    return json(403, { error: 'Owner credentials cannot be reset from this screen.' });
  }

  if (targetUser.roles?.role_key === 'store' && (!targetUser.roles?.scope_type || !targetUser.store_id)) {
    return json(400, { error: 'Store login target is missing store scope.' });
  }

  const pinHash = await bcrypt.hash(newPin, 10);
  const nowIso = new Date().toISOString();

  const { error: updateError } = await db
    .from('internal_users')
    .update({
      pin_hash: pinHash,
      updated_at: nowIso,
    })
    .eq('id', targetUser.id);

  if (updateError) {
    return json(500, { error: 'Could not update store login PIN.' });
  }

  if (revokeExistingSessions) {
    const { error: revokeError } = await db
      .from('internal_access_sessions')
      .update({ revoked_at: nowIso })
      .eq('internal_user_id', targetUser.id)
      .is('revoked_at', null);

    if (revokeError) {
      return json(500, { error: 'PIN updated, but existing sessions could not be revoked.' });
    }
  }

  return json(200, {
    success: true,
    targetType: 'internal_user',
    targetId: targetUser.id,
    message: `Updated login PIN for ${targetUser.full_name}.`,
    revokedSessions: revokeExistingSessions,
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server is not configured for credential updates.' });
  }

  let body: InternalUpdateCredentialsRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const internalSessionToken = (body.internalSessionToken ?? '').trim();
  if (!internalSessionToken) {
    return json(400, { error: 'internalSessionToken is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadSession(db, internalSessionToken);
  if (!verifiedSession.valid) {
    return json(401, { error: verifiedSession.error });
  }

  if (body.action === 'list_store_targets') {
    const roleFilter = body.roleFilter === 'admin' ? 'admin' : 'store';
    return listInternalUserTargets(db, verifiedSession.session, roleFilter);
  }

  if (body.action !== 'update_credential') {
    return json(400, { error: 'action must be list_store_targets or update_credential.' });
  }

  const targetId = (body.targetId ?? '').trim();
  const newPin = parsePin(body.newPin);
  const revokeExistingSessions = body.revokeExistingSessions !== false;

  if (!targetId) {
    return json(400, { error: 'targetId is required.' });
  }

  if (!newPin) {
    return json(400, { error: 'newPin must be a valid 6-digit PIN.' });
  }

  if (body.targetType === 'employee') {
    return updateEmployeeCredential(db, verifiedSession.session, targetId, newPin);
  }

  if (body.targetType === 'internal_user') {
    return updateInternalUserCredential(db, verifiedSession.session, targetId, newPin, revokeExistingSessions);
  }

  return json(400, { error: 'targetType must be employee or internal_user.' });
});
