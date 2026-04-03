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
    scope_type: 'global' | 'store';
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

const getPermissionKeys = (row: InternalUserAccessRow): string[] => {
  const permissionKeys = (row.roles.role_permissions ?? [])
    .filter((entry) => entry.is_allowed)
    .map((entry) => entry.permissions?.permission_key?.trim())
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey));

  return Array.from(new Set(permissionKeys));
};

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

const verifyPin = async (rawPin: string, storedPinHash: string): Promise<boolean> => {
  if (!storedPinHash) return false;

  if (isBcryptHash(storedPinHash)) {
    try {
      return await bcrypt.compare(rawPin, storedPinHash);
    } catch {
      return false;
    }
  }

  // Legacy fallback: supports existing plain PIN rows during migration.
  return timingSafeEqual(rawPin, storedPinHash);
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

  // Read candidate users by scope/role, then verify PIN securely in function code.
  let query = db
    .from('internal_users')
    .select(
      'id, role_id, full_name, pin_hash, store_id, is_active, roles!inner(role_key, role_name, scope_type, role_permissions(is_allowed, permissions(permission_key)))'
    )
    .eq('is_active', true)
    .eq('roles.role_key', mode)
    .limit(20);

  if (mode === 'store') {
    query = query
      .select(
        'id, role_id, full_name, pin_hash, store_id, is_active, roles!inner(role_key, role_name, scope_type, role_permissions(is_allowed, permissions(permission_key))), stores!inner(id, code, is_active)'
      )
      .eq('stores.code', storeCode)
      .eq('stores.is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    return json(500, { error: 'Could not validate internal credentials.' });
  }

  const users = (data ?? []) as InternalUserAccessRow[];
  if (users.length === 0) {
    return json(401, { error: 'Invalid internal credentials.' });
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
    return json(401, { error: 'Invalid internal credentials.' });
  }

  // Extra scope guards for defense in depth.
  if (mode === 'store') {
    if (user.roles.scope_type !== 'store') {
      return json(403, { error: 'Role scope mismatch for store mode.' });
    }
    if (!user.store_id) {
      return json(403, { error: 'Store user is missing store scope.' });
    }
  } else if (user.roles.scope_type !== 'global') {
    return json(403, { error: 'Role scope mismatch for global mode.' });
  }

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const permissionKeys = getPermissionKeys(user);

  return json(200, {
    userId: user.id,
    roleKey: user.roles.role_key,
    permissionKeys,
    scopeType: mode,
    scopeStoreId: mode === 'store' ? user.store_id : null,
    expiresAt,
    internalSessionToken: crypto.randomUUID(),
  });
});
