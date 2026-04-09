// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type MenuAction = 'dashboard' | 'upsert_item' | 'set_availability' | 'delete_item';

interface InternalMenuRequest {
  internalSessionToken?: string;
  action?: MenuAction;
  menuItemId?: string;
  name?: string;
  description?: string | null;
  categorySlug?: string;
  subcategorySlug?: string | null;
  basePrice?: number;
  isAvailable?: boolean;
  sortOrder?: number;
  imageUrl?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  badge?: string | null;
  optionGroupIds?: string[];
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

const normalizeAction = (body: InternalMenuRequest): { value?: MenuAction; error?: string } => {
  if (
    body.action !== 'dashboard'
    && body.action !== 'upsert_item'
    && body.action !== 'set_availability'
    && body.action !== 'delete_item'
  ) {
    return { error: 'action must be one of dashboard, upsert_item, set_availability, or delete_item.' };
  }
  return { value: body.action };
};

const parseInteger = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
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
  session: InternalAccessSessionRow,
  permissionKey: string,
) => {
  const permissionResult = await loadPermissionKeys(db, session.internal_user_id);
  if (permissionResult.error) {
    return { allowed: false, status: 500, error: permissionResult.error };
  }

  if (!permissionResult.permissionKeys.includes(permissionKey)) {
    return { allowed: false, status: 403, error: 'You do not have permission to manage menu items.' };
  }

  return { allowed: true };
};

const slugify = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const toNullableTrimmed = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionGroupIds = (value: unknown) => (
  Array.from(new Set(
    Array.isArray(value)
      ? value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
      : [],
  ))
);

const loadOptionGroups = async (db: ReturnType<typeof createClient>) => {
  const { data, error } = await db
    .from('option_groups')
    .select('group_id, name, selection_type, is_required, min_select, max_select, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return { error: 'Could not load menu option groups.' };
  }

  return {
    optionGroups: (data ?? []).map((row: any) => ({
      id: row.group_id,
      name: row.name,
      selectionType: row.selection_type,
      isRequired: Boolean(row.is_required),
      minSelect: Number(row.min_select ?? 0),
      maxSelect: row.max_select == null ? null : Number(row.max_select),
      sortOrder: Number(row.sort_order ?? 0),
    })),
  };
};

const loadMenuDashboard = async (db: ReturnType<typeof createClient>) => {
  const [menuResult, mapResult, optionGroupResult] = await Promise.all([
    db
      .from('menu_items')
      .select('menu_item_id, category_slug, subcategory_slug, name, description, base_price, is_available, sort_order, image_url, calories, protein_grams, badge, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    db
      .from('item_option_group_map')
      .select('menu_item_id, group_id, sort_order')
      .order('sort_order', { ascending: true }),
    loadOptionGroups(db),
  ]);

  if (menuResult.error) {
    return { status: 500, payload: { error: 'Could not load menu items.' } };
  }

  if (mapResult.error) {
    return { status: 500, payload: { error: 'Could not load menu item option mappings.' } };
  }

  if (optionGroupResult.error) {
    return { status: 500, payload: { error: optionGroupResult.error } };
  }

  const optionGroupIdsByItemId = (mapResult.data ?? []).reduce((accumulator: Record<string, string[]>, row: any) => {
    accumulator[row.menu_item_id] = accumulator[row.menu_item_id] ?? [];
    accumulator[row.menu_item_id].push(row.group_id);
    return accumulator;
  }, {});

  const items = (menuResult.data ?? []).map((row: any) => {
    const optionGroupIds = optionGroupIdsByItemId[row.menu_item_id] ?? [];
    return {
      menuItemId: row.menu_item_id,
      categorySlug: row.category_slug,
      subcategorySlug: row.subcategory_slug ?? null,
      name: row.name,
      description: row.description ?? null,
      basePrice: Number(row.base_price ?? 0),
      isAvailable: Boolean(row.is_available),
      sortOrder: Number(row.sort_order ?? 0),
      imageUrl: row.image_url ?? null,
      calories: row.calories == null ? null : Number(row.calories),
      proteinGrams: row.protein_grams == null ? null : Number(row.protein_grams),
      badge: row.badge ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      optionGroupIds,
      optionGroupCount: optionGroupIds.length,
    };
  });

  return {
    status: 200,
    payload: {
      items,
      optionGroups: optionGroupResult.optionGroups,
    },
  };
};

const validateOptionGroupIds = async (
  db: ReturnType<typeof createClient>,
  optionGroupIds: string[],
) => {
  if (optionGroupIds.length === 0) {
    return { valid: true, optionGroupIds };
  }

  const { data, error } = await db
    .from('option_groups')
    .select('group_id')
    .in('group_id', optionGroupIds);

  if (error) {
    return { valid: false, status: 500, error: 'Could not validate option groups.' };
  }

  const found = new Set((data ?? []).map((row: { group_id: string }) => row.group_id));
  const missing = optionGroupIds.filter((groupId) => !found.has(groupId));
  if (missing.length > 0) {
    return { valid: false, status: 400, error: `Unknown option groups: ${missing.join(', ')}.` };
  }

  return { valid: true, optionGroupIds };
};

const buildMenuItemId = (name: string) => {
  const slug = slugify(name) || 'menu-item';
  return `menu-${slug}-${crypto.randomUUID().slice(0, 8)}`;
};

const getNextSortOrder = async (db: ReturnType<typeof createClient>) => {
  const { data, error } = await db
    .from('menu_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return 0;
  }

  return Number(data?.sort_order ?? 0) + 10;
};

const loadMenuItemById = async (db: ReturnType<typeof createClient>, menuItemId: string) => {
  const dashboard = await loadMenuDashboard(db);
  if (dashboard.status !== 200) {
    return null;
  }

  const items = dashboard.payload.items as Array<Record<string, unknown>>;
  return items.find((item) => item.menuItemId === menuItemId) ?? null;
};

const upsertMenuItem = async (
  db: ReturnType<typeof createClient>,
  body: InternalMenuRequest,
) => {
  const normalizedName = (body.name ?? '').trim();
  const normalizedCategorySlug = (body.categorySlug ?? '').trim();
  const normalizedSubcategorySlug = toNullableTrimmed(body.subcategorySlug);
  const normalizedDescription = toNullableTrimmed(body.description);
  const normalizedImageUrl = toNullableTrimmed(body.imageUrl);
  const normalizedBadge = toNullableTrimmed(body.badge);
  const normalizedOptionGroupIds = normalizeOptionGroupIds(body.optionGroupIds);
  const basePrice = parseInteger(body.basePrice);
  const calories = parseInteger(body.calories);
  const proteinGrams = parseInteger(body.proteinGrams);
  const sortOrder = parseInteger(body.sortOrder);
  const isAvailable = body.isAvailable === false ? false : true;

  if (!normalizedName) {
    return { status: 400, payload: { error: 'name is required.' } };
  }

  if (!normalizedCategorySlug) {
    return { status: 400, payload: { error: 'categorySlug is required.' } };
  }

  if (basePrice === null || basePrice < 0) {
    return { status: 400, payload: { error: 'basePrice must be a valid non-negative number.' } };
  }

  if (calories !== null && calories < 0) {
    return { status: 400, payload: { error: 'calories must be non-negative.' } };
  }

  if (proteinGrams !== null && proteinGrams < 0) {
    return { status: 400, payload: { error: 'proteinGrams must be non-negative.' } };
  }

  const optionGroupValidation = await validateOptionGroupIds(db, normalizedOptionGroupIds);
  if (!optionGroupValidation.valid) {
    return { status: optionGroupValidation.status ?? 400, payload: { error: optionGroupValidation.error ?? 'Invalid option groups.' } };
  }

  const nowIso = new Date().toISOString();
  const menuItemId = body.menuItemId?.trim() || buildMenuItemId(normalizedName);
  const nextSortOrder = sortOrder ?? await getNextSortOrder(db);
  const isUpdate = Boolean(body.menuItemId?.trim());

  if (isUpdate) {
    const { data: existingItem, error: existingError } = await db
      .from('menu_items')
      .select('menu_item_id')
      .eq('menu_item_id', menuItemId)
      .single();

    if (existingError || !existingItem) {
      return { status: 404, payload: { error: 'Menu item not found.' } };
    }
  }

  const query = isUpdate
    ? db
      .from('menu_items')
      .update({
        category_slug: normalizedCategorySlug,
        subcategory_slug: normalizedSubcategorySlug,
        name: normalizedName,
        description: normalizedDescription,
        base_price: basePrice,
        is_available: isAvailable,
        sort_order: nextSortOrder,
        image_url: normalizedImageUrl,
        calories,
        protein_grams: proteinGrams,
        badge: normalizedBadge,
        updated_at: nowIso,
      })
      .eq('menu_item_id', menuItemId)
    : db
      .from('menu_items')
      .insert({
        menu_item_id: menuItemId,
        category_slug: normalizedCategorySlug,
        subcategory_slug: normalizedSubcategorySlug,
        name: normalizedName,
        description: normalizedDescription,
        base_price: basePrice,
        is_available: isAvailable,
        sort_order: nextSortOrder,
        image_url: normalizedImageUrl,
        calories,
        protein_grams: proteinGrams,
        badge: normalizedBadge,
        created_at: nowIso,
        updated_at: nowIso,
      });

  const { error: upsertError } = await query;
  if (upsertError) {
    return { status: 500, payload: { error: upsertError.message || 'Could not save menu item.' } };
  }

  const { error: syncError } = await db.rpc('sync_item_option_group_map', {
    p_menu_item_id: menuItemId,
    p_group_ids: normalizedOptionGroupIds,
  });

  if (syncError) {
    return { status: 500, payload: { error: syncError.message || 'Menu item saved, but add-on group mapping failed.' } };
  }

  const item = await loadMenuItemById(db, menuItemId);
  if (!item) {
    return { status: 500, payload: { error: 'Menu item saved, but the updated record could not be reloaded.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: isUpdate ? 'updated' : 'created',
      item,
    },
  };
};

const setAvailability = async (db: ReturnType<typeof createClient>, body: InternalMenuRequest) => {
  const menuItemId = (body.menuItemId ?? '').trim();
  if (!menuItemId) {
    return { status: 400, payload: { error: 'menuItemId is required.' } };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('menu_items')
    .update({
      is_available: body.isAvailable === false ? false : true,
      updated_at: nowIso,
    })
    .eq('menu_item_id', menuItemId)
    .select('menu_item_id')
    .single();

  if (error || !data) {
    return { status: 404, payload: { error: 'Menu item not found.' } };
  }

  const item = await loadMenuItemById(db, menuItemId);
  if (!item) {
    return { status: 500, payload: { error: 'Menu item availability updated, but the latest record could not be reloaded.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'updated',
      item,
    },
  };
};

const deleteMenuItem = async (db: ReturnType<typeof createClient>, body: InternalMenuRequest) => {
  const menuItemId = (body.menuItemId ?? '').trim();
  if (!menuItemId) {
    return { status: 400, payload: { error: 'menuItemId is required.' } };
  }

  const { data: existingItem, error: existingError } = await db
    .from('menu_items')
    .select('menu_item_id')
    .eq('menu_item_id', menuItemId)
    .single();

  if (existingError || !existingItem) {
    return { status: 404, payload: { error: 'Menu item not found.' } };
  }

  const { data: orderReferences, error: orderReferenceError } = await db
    .from('order_items')
    .select('order_item_id')
    .eq('menu_item_id', menuItemId)
    .limit(1);

  if (orderReferenceError) {
    return { status: 500, payload: { error: 'Could not check historical order usage for this menu item.' } };
  }

  if ((orderReferences ?? []).length > 0) {
    const availabilityResult = await setAvailability(db, {
      menuItemId,
      isAvailable: false,
    });

    if (availabilityResult.status !== 200) {
      return availabilityResult;
    }

    return {
      status: 200,
      payload: {
        ...(availabilityResult.payload ?? {}),
        mode: 'soft_disabled',
      },
    };
  }

  const { error: deleteError } = await db
    .from('menu_items')
    .delete()
    .eq('menu_item_id', menuItemId);

  if (deleteError) {
    return { status: 500, payload: { error: 'Could not delete menu item.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'deleted',
      menuItemId,
    },
  };
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
    return json(500, { error: 'Server is not configured for internal menu access.' });
  }

  let body: InternalMenuRequest;
  try {
    body = (await req.json()) as InternalMenuRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const action = normalizeAction(body);
  if (!action.value) {
    return json(400, { error: action.error ?? 'Invalid action.' });
  }

  const token = (body.internalSessionToken ?? '').trim();
  if (!token) {
    return json(400, { error: 'internalSessionToken is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const sessionResult = await verifyAndLoadSession(db, token);
  if (!sessionResult.valid) {
    return json(401, { error: sessionResult.error });
  }

  const permissionResult = await enforcePermission(db, sessionResult.session, 'can_manage_menu');
  if (!permissionResult.allowed) {
    return json(permissionResult.status ?? 403, { error: permissionResult.error ?? 'Not allowed.' });
  }

  if (action.value === 'dashboard') {
    const dashboard = await loadMenuDashboard(db);
    return json(dashboard.status, dashboard.payload);
  }

  if (action.value === 'upsert_item') {
    const result = await upsertMenuItem(db, body);
    return json(result.status, result.payload);
  }

  if (action.value === 'set_availability') {
    const result = await setAvailability(db, body);
    return json(result.status, result.payload);
  }

  const result = await deleteMenuItem(db, body);
  return json(result.status, result.payload);
});
