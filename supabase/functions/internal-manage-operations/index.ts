// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type ManageAction =
  | 'list_internal_users'
  | 'upsert_internal_user'
  | 'deactivate_internal_user'
  | 'delete_internal_user'
  | 'upsert_store'
  | 'deactivate_store'
  | 'delete_store';

interface ManageOperationsRequest {
  internalSessionToken?: string;
  action?: ManageAction;

  roleFilter?: 'admin' | 'store';

  internalUserId?: string;
  roleKey?: 'admin' | 'store';
  fullName?: string;
  storeId?: string;
  storeCode?: string;
  pin?: string;
  isActive?: boolean;

  targetStoreId?: string;
  name?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  code?: string;
  storeLoginFullName?: string;
  storeLoginPin?: string;
  storeLoginIsActive?: boolean;
  storeLoginInternalUserId?: string;
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

const normalizeCode = (value?: string) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-');
const normalizeText = (value?: string) => String(value ?? '').trim();
const normalizeOptionalPhone = (value?: string) => {
  const normalized = String(value ?? '').replace(/\D/g, '').slice(-10);
  return normalized || null;
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

const enforceManageStoresPermission = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
) => {
  if (session.scope_type === 'store') {
    return { allowed: false, status: 403, error: 'Store-scoped sessions cannot manage global stores or internal access users.' };
  }

  const result = await loadPermissionKeys(db, session.internal_user_id);
  if (result.error) {
    return { allowed: false, status: 500, error: result.error };
  }

  if (!result.permissionKeys.includes('can_manage_stores')) {
    return { allowed: false, status: 403, error: 'You do not have permission to manage stores and internal access users.' };
  }

  return { allowed: true };
};

const loadRoleId = async (db: ReturnType<typeof createClient>, roleKey: 'admin' | 'store') => {
  const { data, error } = await db
    .from('roles')
    .select('id, role_key, scope_type')
    .eq('role_key', roleKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { error: `Could not load the ${roleKey} role.` };
  }

  return { roleId: data.id, scopeType: data.scope_type as string };
};

const loadInternalUsers = async (
  db: ReturnType<typeof createClient>,
  roleFilter: 'admin' | 'store',
) => {
  let query = db
    .from('internal_users')
    .select('id, full_name, is_active, store_id, created_at, roles!inner(role_key, role_name, scope_type), stores(id, name, code, city, is_active)')
    .eq('roles.role_key', roleFilter)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return { error: 'Could not load internal users.' };
  }

  return {
    users: (data ?? []).map((row: any) => ({
      internalUserId: row.id,
      fullName: row.full_name,
      roleKey: row.roles?.role_key ?? roleFilter,
      roleName: row.roles?.role_name ?? roleFilter,
      scopeType: row.roles?.scope_type ?? (roleFilter === 'store' ? 'store' : 'global'),
      isActive: Boolean(row.is_active),
      storeId: row.store_id ?? null,
      storeName: row.stores?.name ?? null,
      storeCode: row.stores?.code ?? null,
      storeCity: row.stores?.city ?? null,
      storeIsActive: row.stores?.is_active == null ? null : Boolean(row.stores?.is_active),
      createdAt: row.created_at,
    })),
  };
};

const hasLinkedRows = async (
  db: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string,
) => {
  const { data, error } = await db
    .from(table)
    .select(column)
    .eq(column, value)
    .limit(1);

  if (error) {
    return { error: `Could not inspect ${table} dependencies.` };
  }

  return { exists: (data ?? []).length > 0 };
};

const getInternalUserDeleteBlocker = async (
  db: ReturnType<typeof createClient>,
  internalUserId: string,
) => {
  const dependencyChecks = [
    { table: 'internal_access_sessions', column: 'internal_user_id', label: 'login session history' },
    { table: 'order_payments', column: 'recorded_by_internal_user_id', label: 'payment history' },
    { table: 'inventory_adjustments', column: 'actor_internal_user_id', label: 'inventory history' },
    { table: 'store_inventory', column: 'updated_by', label: 'inventory ownership history' },
  ] as const;

  for (const check of dependencyChecks) {
    const result = await hasLinkedRows(db, check.table, check.column, internalUserId);
    if (result.error) {
      return { error: result.error };
    }
    if (result.exists) {
      return { blocker: check.label };
    }
  }

  return { blocker: null };
};

const createStoreWithLogin = async (
  db: ReturnType<typeof createClient>,
  body: ManageOperationsRequest,
) => {
  const name = String(body.name ?? '').trim();
  const addressLine1 = normalizeText(body.addressLine1);
  const city = String(body.city ?? '').trim();
  const state = normalizeText(body.state);
  const postalCode = normalizeText(body.postalCode);
  const phone = normalizeOptionalPhone(body.phone);
  const code = normalizeCode(body.code);
  const loginName = String(body.storeLoginFullName ?? '').trim();
  const loginPin = parsePin(body.storeLoginPin);
  const isActive = body.isActive !== false;

  if (!name) return { status: 400, payload: { error: 'Store name is required.' } };
  if (!addressLine1) return { status: 400, payload: { error: 'Store address is required.' } };
  if (!city) return { status: 400, payload: { error: 'Store city is required.' } };
  if (!state) return { status: 400, payload: { error: 'Store state is required.' } };
  if (!postalCode) return { status: 400, payload: { error: 'Store postal code is required.' } };
  if (!code) return { status: 400, payload: { error: 'Store code is required.' } };
  if (!loginName) return { status: 400, payload: { error: 'Store login full name is required.' } };
  if (!loginPin) return { status: 400, payload: { error: 'A valid 6-digit initial store login PIN is required.' } };

  const { data: duplicateStore } = await db
    .from('stores')
    .select('id')
    .eq('code', code)
    .limit(1);

  if ((duplicateStore ?? []).length > 0) {
    return { status: 409, payload: { error: 'A store with this code already exists.' } };
  }

  const roleResult = await loadRoleId(db, 'store');
  if (roleResult.error) {
    return { status: 500, payload: { error: roleResult.error } };
  }

  const nowIso = new Date().toISOString();
  const { data: createdStore, error: storeError } = await db
    .from('stores')
    .insert({
      name,
      address_line_1: addressLine1,
      city,
      state,
      postal_code: postalCode,
      phone,
      code,
      is_active: isActive,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, name, city, code, address_line_1, state, postal_code, phone, is_active')
    .single();

  if (storeError || !createdStore) {
    return { status: 500, payload: { error: 'Could not create store.' } };
  }

  const pinHash = await bcrypt.hash(loginPin, 10);
  const { data: createdUser, error: userError } = await db
    .from('internal_users')
    .insert({
      role_id: roleResult.roleId,
      full_name: loginName,
      pin_hash: pinHash,
      store_id: createdStore.id,
      is_active: isActive,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, full_name, is_active')
    .single();

  if (userError || !createdUser) {
    await db.from('stores').delete().eq('id', createdStore.id);
    return { status: 500, payload: { error: 'Store was created, but the required store login user could not be created.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'created',
      store: {
        id: createdStore.id,
        name: createdStore.name,
        city: createdStore.city,
        code: createdStore.code,
        addressLine1: createdStore.address_line_1,
        state: createdStore.state,
        postalCode: createdStore.postal_code,
        phone: createdStore.phone,
        isActive: createdStore.is_active,
      },
      storeLoginUser: {
        internalUserId: createdUser.id,
        fullName: createdUser.full_name,
        isActive: createdUser.is_active,
      },
      message: `${createdStore.name} created with a working store login user.`,
    },
  };
};

const updateStoreAndLogin = async (
  db: ReturnType<typeof createClient>,
  body: ManageOperationsRequest,
) => {
  const storeId = String(body.targetStoreId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const addressLine1 = normalizeText(body.addressLine1);
  const city = String(body.city ?? '').trim();
  const state = normalizeText(body.state);
  const postalCode = normalizeText(body.postalCode);
  const phone = normalizeOptionalPhone(body.phone);
  const code = normalizeCode(body.code);
  const isActive = body.isActive !== false;
  const storeLoginUserId = String(body.storeLoginInternalUserId ?? '').trim() || null;
  const storeLoginFullName = String(body.storeLoginFullName ?? '').trim();
  const storeLoginPin = parsePin(body.storeLoginPin);
  const storeLoginIsActive = body.storeLoginIsActive !== false;

  if (!storeId) return { status: 400, payload: { error: 'targetStoreId is required.' } };
  if (!name) return { status: 400, payload: { error: 'Store name is required.' } };
  if (!addressLine1) return { status: 400, payload: { error: 'Store address is required.' } };
  if (!city) return { status: 400, payload: { error: 'Store city is required.' } };
  if (!state) return { status: 400, payload: { error: 'Store state is required.' } };
  if (!postalCode) return { status: 400, payload: { error: 'Store postal code is required.' } };
  if (!code) return { status: 400, payload: { error: 'Store code is required.' } };

  const { data: existingStore, error: existingStoreError } = await db
    .from('stores')
    .select('id, name, city, code, address_line_1, state, postal_code, phone, is_active')
    .eq('id', storeId)
    .single();

  if (existingStoreError || !existingStore) {
    return { status: 404, payload: { error: 'Store not found.' } };
  }

  const { data: duplicateStore } = await db
    .from('stores')
    .select('id')
    .eq('code', code)
    .neq('id', storeId)
    .limit(1);

  if ((duplicateStore ?? []).length > 0) {
    return { status: 409, payload: { error: 'Store code must be unique.' } };
  }

  const nowIso = new Date().toISOString();
  const { error: updateStoreError } = await db
    .from('stores')
    .update({
      name,
      address_line_1: addressLine1,
      city,
      state,
      postal_code: postalCode,
      phone,
      code,
      is_active: isActive,
      updated_at: nowIso,
    })
    .eq('id', storeId);

  if (updateStoreError) {
    return { status: 500, payload: { error: 'Could not update store.' } };
  }

  if (!isActive) {
    await db
      .from('internal_users')
      .update({ is_active: false, updated_at: nowIso })
      .eq('store_id', storeId);

    await db
      .from('internal_access_sessions')
      .update({ revoked_at: nowIso })
      .eq('scope_store_id', storeId)
      .is('revoked_at', null);
  }

  if (storeLoginUserId) {
    const updatePayload: Record<string, unknown> = {
      is_active: storeLoginIsActive && isActive,
      updated_at: nowIso,
    };

    if (storeLoginFullName) {
      updatePayload.full_name = storeLoginFullName;
    }

    if (storeLoginPin) {
      updatePayload.pin_hash = await bcrypt.hash(storeLoginPin, 10);
    }

    const { error: updateUserError } = await db
      .from('internal_users')
      .update(updatePayload)
      .eq('id', storeLoginUserId)
      .eq('store_id', storeId);

    if (updateUserError) {
      return { status: 500, payload: { error: 'Store updated, but the store login user could not be updated.' } };
    }

    if (storeLoginPin) {
      await db
        .from('internal_access_sessions')
        .update({ revoked_at: nowIso })
        .eq('internal_user_id', storeLoginUserId)
        .is('revoked_at', null);
    }
  } else if (storeLoginFullName && storeLoginPin) {
    const roleResult = await loadRoleId(db, 'store');
    if (roleResult.error) {
      return { status: 500, payload: { error: roleResult.error } };
    }

    const pinHash = await bcrypt.hash(storeLoginPin, 10);
    const { error: createUserError } = await db
      .from('internal_users')
      .insert({
        role_id: roleResult.roleId,
        full_name: storeLoginFullName,
        pin_hash: pinHash,
        store_id: storeId,
        is_active: storeLoginIsActive && isActive,
        created_at: nowIso,
        updated_at: nowIso,
      });

    if (createUserError) {
      return { status: 500, payload: { error: 'Store updated, but a missing store login user could not be created.' } };
    }
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'updated',
      message: `${name} updated.`,
    },
  };
};

const upsertStore = async (db: ReturnType<typeof createClient>, body: ManageOperationsRequest) => {
  const targetStoreId = String(body.targetStoreId ?? '').trim();
  if (!targetStoreId) {
    return createStoreWithLogin(db, body);
  }
  return updateStoreAndLogin(db, body);
};

const deactivateStore = async (db: ReturnType<typeof createClient>, storeId: string) => {
  if (!storeId) {
    return { status: 400, payload: { error: 'targetStoreId is required.' } };
  }

  const nowIso = new Date().toISOString();
  const { data: store, error: storeError } = await db
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    return { status: 404, payload: { error: 'Store not found.' } };
  }

  const { error: updateError } = await db
    .from('stores')
    .update({ is_active: false, updated_at: nowIso })
    .eq('id', storeId);

  if (updateError) {
    return { status: 500, payload: { error: 'Could not deactivate store.' } };
  }

  await db
    .from('internal_users')
    .update({ is_active: false, updated_at: nowIso })
    .eq('store_id', storeId);

  await db
    .from('internal_access_sessions')
    .update({ revoked_at: nowIso })
    .eq('scope_store_id', storeId)
    .is('revoked_at', null);

  return {
    status: 200,
    payload: {
      success: true,
      message: `${store.name} was deactivated and store login sessions were revoked.`,
    },
  };
};

const deleteStore = async (db: ReturnType<typeof createClient>, storeId: string) => {
  if (!storeId) {
    return { status: 400, payload: { error: 'targetStoreId is required.' } };
  }

  const { data: store, error: storeError } = await db
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    return { status: 404, payload: { error: 'Store not found.' } };
  }

  const dependencyChecks = [
    { table: 'orders', column: 'store_id', label: 'orders' },
    { table: 'employees', column: 'store_id', label: 'employees' },
    { table: 'store_inventory', column: 'store_id', label: 'inventory records' },
    { table: 'inventory_adjustments', column: 'store_id', label: 'inventory history' },
    { table: 'employee_shifts', column: 'store_id', label: 'shift history' },
    { table: 'internal_access_sessions', column: 'scope_store_id', label: 'login session history' },
  ] as const;

  for (const check of dependencyChecks) {
    const result = await hasLinkedRows(db, check.table, check.column, storeId);
    if (result.error) {
      return { status: 500, payload: { error: result.error } };
    }
    if (result.exists) {
      return {
        status: 409,
        payload: {
          error: `${store.name} cannot be deleted because it still has linked ${check.label}. Deactivate this store instead.`,
        },
      };
    }
  }

  const { data: linkedStoreUsers, error: linkedStoreUsersError } = await db
    .from('internal_users')
    .select('id, full_name')
    .eq('store_id', storeId);

  if (linkedStoreUsersError) {
    return { status: 500, payload: { error: 'Could not inspect linked internal users for this store.' } };
  }

  for (const linkedUser of linkedStoreUsers ?? []) {
    const blockerResult = await getInternalUserDeleteBlocker(db, linkedUser.id);
    if (blockerResult.error) {
      return { status: 500, payload: { error: blockerResult.error } };
    }

    if (blockerResult.blocker) {
      return {
        status: 409,
        payload: {
          error: `${store.name} cannot be deleted because linked store login users have ${blockerResult.blocker}. Deactivate this store instead.`,
        },
      };
    }
  }

  if ((linkedStoreUsers ?? []).length > 0) {
    const { error: deleteLinkedUsersError } = await db
      .from('internal_users')
      .delete()
      .eq('store_id', storeId);

    if (deleteLinkedUsersError) {
      return { status: 500, payload: { error: 'Could not remove linked store login users before deleting this store.' } };
    }
  }

  const { error: deleteError } = await db
    .from('stores')
    .delete()
    .eq('id', storeId);

  if (deleteError) {
    return { status: 500, payload: { error: 'Could not delete store.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      message: `${store.name} was permanently deleted.`,
    },
  };
};

const upsertInternalUser = async (db: ReturnType<typeof createClient>, body: ManageOperationsRequest) => {
  const internalUserId = String(body.internalUserId ?? '').trim() || null;
  const roleKey = body.roleKey;
  const fullName = String(body.fullName ?? '').trim();
  const isActive = body.isActive !== false;
  const storeId = String(body.storeId ?? '').trim() || null;
  const pin = parsePin(body.pin);

  if (roleKey !== 'admin' && roleKey !== 'store') {
    return { status: 400, payload: { error: 'roleKey must be admin or store.' } };
  }

  if (!fullName) {
    return { status: 400, payload: { error: 'fullName is required.' } };
  }

  if (roleKey === 'store' && !storeId) {
    return { status: 400, payload: { error: 'storeId is required for store access users.' } };
  }

  if (roleKey === 'admin' && storeId) {
    return { status: 400, payload: { error: 'Admin users cannot be scoped to a store.' } };
  }

  const roleResult = await loadRoleId(db, roleKey);
  if (roleResult.error) {
    return { status: 500, payload: { error: roleResult.error } };
  }

  if (roleKey === 'store') {
    const { data: store, error: storeError } = await db
      .from('stores')
      .select('id, is_active')
      .eq('id', storeId)
      .single();

    if (storeError || !store || !store.is_active) {
      return { status: 400, payload: { error: 'Selected store is not active.' } };
    }
  }

  const nowIso = new Date().toISOString();

  if (internalUserId) {
    const { data: existingUser, error: existingUserError } = await db
      .from('internal_users')
      .select('id, role_id, store_id, roles!inner(role_key)')
      .eq('id', internalUserId)
      .single();

    if (existingUserError || !existingUser) {
      return { status: 404, payload: { error: 'Internal user not found.' } };
    }

    if (existingUser.roles?.role_key === 'owner') {
      return { status: 403, payload: { error: 'Owner credentials cannot be edited from this screen.' } };
    }

    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      role_id: roleResult.roleId,
      store_id: roleKey === 'store' ? storeId : null,
      is_active: isActive,
      updated_at: nowIso,
    };

    if (pin) {
      updatePayload.pin_hash = await bcrypt.hash(pin, 10);
    }

    const { error: updateError } = await db
      .from('internal_users')
      .update(updatePayload)
      .eq('id', internalUserId);

    if (updateError) {
      return { status: 500, payload: { error: 'Could not update internal user.' } };
    }

    if (pin || !isActive) {
      await db
        .from('internal_access_sessions')
        .update({ revoked_at: nowIso })
        .eq('internal_user_id', internalUserId)
        .is('revoked_at', null);
    }

    return {
      status: 200,
      payload: {
        success: true,
        mode: 'updated',
        message: `${fullName} updated.`,
      },
    };
  }

  if (!pin) {
    return { status: 400, payload: { error: 'A valid 6-digit PIN is required for new internal users.' } };
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const { data: createdUser, error: createError } = await db
    .from('internal_users')
    .insert({
      role_id: roleResult.roleId,
      full_name: fullName,
      pin_hash: pinHash,
      store_id: roleKey === 'store' ? storeId : null,
      is_active: isActive,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (createError || !createdUser) {
    return { status: 500, payload: { error: `Could not create ${roleKey} user.` } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'created',
      internalUserId: createdUser.id,
      message: `${fullName} created.`,
    },
  };
};

const deactivateInternalUser = async (db: ReturnType<typeof createClient>, internalUserId: string, actingUserId: string) => {
  if (!internalUserId) {
    return { status: 400, payload: { error: 'internalUserId is required.' } };
  }

  if (internalUserId === actingUserId) {
    return { status: 403, payload: { error: 'You cannot deactivate your own active management account from this screen.' } };
  }

  const { data: existingUser, error: existingUserError } = await db
    .from('internal_users')
    .select('id, full_name, roles!inner(role_key)')
    .eq('id', internalUserId)
    .single();

  if (existingUserError || !existingUser) {
    return { status: 404, payload: { error: 'Internal user not found.' } };
  }

  if (existingUser.roles?.role_key === 'owner') {
    return { status: 403, payload: { error: 'Owner cannot be deactivated from this screen.' } };
  }

  const nowIso = new Date().toISOString();
  const { error: deactivateError } = await db
    .from('internal_users')
    .update({
      is_active: false,
      updated_at: nowIso,
    })
    .eq('id', internalUserId);

  if (deactivateError) {
    return { status: 500, payload: { error: 'Could not deactivate internal user.' } };
  }

  await db
    .from('internal_access_sessions')
    .update({ revoked_at: nowIso })
    .eq('internal_user_id', internalUserId)
    .is('revoked_at', null);

  return {
    status: 200,
    payload: {
      success: true,
      message: `${existingUser.full_name} was deactivated and active sessions were revoked.`,
    },
  };
};

const deleteInternalUser = async (db: ReturnType<typeof createClient>, internalUserId: string, actingUserId: string) => {
  if (!internalUserId) {
    return { status: 400, payload: { error: 'internalUserId is required.' } };
  }

  if (internalUserId === actingUserId) {
    return { status: 403, payload: { error: 'You cannot delete your own active management account from this screen.' } };
  }

  const { data: existingUser, error: existingUserError } = await db
    .from('internal_users')
    .select('id, full_name, roles!inner(role_key)')
    .eq('id', internalUserId)
    .single();

  if (existingUserError || !existingUser) {
    return { status: 404, payload: { error: 'Internal user not found.' } };
  }

  if (existingUser.roles?.role_key === 'owner') {
    return { status: 403, payload: { error: 'Owner cannot be deleted from this screen.' } };
  }

  const blockerResult = await getInternalUserDeleteBlocker(db, internalUserId);
  if (blockerResult.error) {
    return { status: 500, payload: { error: blockerResult.error } };
  }
  if (blockerResult.blocker) {
    return {
      status: 409,
      payload: {
        error: `${existingUser.full_name} cannot be deleted because this account has linked ${blockerResult.blocker}. Deactivate this user instead.`,
      },
    };
  }

  const { error: deleteError } = await db
    .from('internal_users')
    .delete()
    .eq('id', internalUserId);

  if (deleteError) {
    return { status: 500, payload: { error: 'Could not delete internal user.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      message: `${existingUser.full_name} was permanently deleted.`,
    },
  };
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
    return json(500, { error: 'Server is not configured for operations management.' });
  }

  let body: ManageOperationsRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const token = String(body.internalSessionToken ?? '').trim();
  if (!token) {
    return json(400, { error: 'internalSessionToken is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sessionResult = await verifyAndLoadSession(db, token);
  if (!sessionResult.valid) {
    return json(401, { error: sessionResult.error });
  }

  const permission = await enforceManageStoresPermission(db, sessionResult.session);
  if (!permission.allowed) {
    return json(permission.status ?? 403, { error: permission.error ?? 'Not allowed.' });
  }

  if (body.action === 'list_internal_users') {
    if (body.roleFilter !== 'admin' && body.roleFilter !== 'store') {
      return json(400, { error: 'roleFilter must be admin or store.' });
    }

    const result = await loadInternalUsers(db, body.roleFilter);
    if (result.error) {
      return json(500, { error: result.error });
    }

    return json(200, {
      success: true,
      users: result.users,
    });
  }

  if (body.action === 'upsert_store') {
    const result = await upsertStore(db, body);
    return json(result.status, result.payload);
  }

  if (body.action === 'deactivate_store') {
    const result = await deactivateStore(db, String(body.targetStoreId ?? '').trim());
    return json(result.status, result.payload);
  }

  if (body.action === 'delete_store') {
    const result = await deleteStore(db, String(body.targetStoreId ?? '').trim());
    return json(result.status, result.payload);
  }

  if (body.action === 'upsert_internal_user') {
    const result = await upsertInternalUser(db, body);
    return json(result.status, result.payload);
  }

  if (body.action === 'deactivate_internal_user') {
    const result = await deactivateInternalUser(db, String(body.internalUserId ?? '').trim(), sessionResult.session.internal_user_id);
    return json(result.status, result.payload);
  }

  if (body.action === 'delete_internal_user') {
    const result = await deleteInternalUser(db, String(body.internalUserId ?? '').trim(), sessionResult.session.internal_user_id);
    return json(result.status, result.payload);
  }

  return json(400, { error: 'Unsupported action.' });
});
