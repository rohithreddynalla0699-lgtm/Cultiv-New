// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type InventoryAction = 'dashboard' | 'adjust_item' | 'create_item' | 'archive_item';
type InventoryAdjustmentType =
  | 'set'
  | 'add'
  | 'reduce'
  | 'threshold_update'
  | 'receive'
  | 'manual_correction'
  | 'out_of_stock'
  | 'opening_balance';

interface InternalInventoryRequest {
  internalSessionToken?: string;
  action?: InventoryAction;
  storeId?: string | null;
  historyLimit?: number;
  inventoryItemId?: string;
  adjustmentType?: InventoryAdjustmentType;
  amount?: number;
  quantity?: number;
  threshold?: number;
  notes?: string;
  name?: string;
  category?: string;
  unit?: string;
  initialQuantity?: number;
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

const isUuid = (value?: string | null) =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const normalizeAction = (body: InternalInventoryRequest): { value?: InventoryAction; error?: string } => {
  if (
    body.action !== 'dashboard'
    && body.action !== 'adjust_item'
    && body.action !== 'create_item'
    && body.action !== 'archive_item'
  ) {
    return { error: 'action must be one of dashboard, adjust_item, create_item, or archive_item.' };
  }
  return { value: body.action };
};

const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const slugify = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
    return { allowed: false, status: 403, error: 'You do not have permission to access inventory.' };
  }

  return { allowed: true };
};

const resolveStoreIds = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  requestedStoreId?: string | null,
) => {
  const normalizedRequestedStoreId = typeof requestedStoreId === 'string' ? requestedStoreId.trim() : '';

  if (session.scope_type === 'store') {
    if (!session.scope_store_id) {
      return { error: 'Store-scoped session is missing a store scope.', status: 400 };
    }

    if (normalizedRequestedStoreId && normalizedRequestedStoreId !== session.scope_store_id) {
      return { error: 'Store-scoped session cannot access another store.', status: 403 };
    }

    return { storeIds: [session.scope_store_id] };
  }

  if (normalizedRequestedStoreId) {
    if (!isUuid(normalizedRequestedStoreId)) {
      return { error: 'storeId must be a valid UUID.', status: 400 };
    }
    return { storeIds: [normalizedRequestedStoreId] };
  }

  const { data, error } = await db
    .from('stores')
    .select('id')
    .eq('is_active', true);

  if (error) {
    return { error: 'Could not load stores for inventory access.', status: 500 };
  }

  return { storeIds: (data ?? []).map((row: { id: string }) => row.id) };
};

const ensureStoreInventoryRows = async (db: ReturnType<typeof createClient>, storeIds: string[]) => {
  const results = await Promise.all(
    storeIds.map((storeId) =>
      db.rpc('ensure_store_inventory', { p_store_id: storeId })),
  );

  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) {
    throw new Error(failedResult.error.message || 'Could not initialize store inventory.');
  }
};

const mapInventoryItemRow = (row: any) => ({
  storeInventoryId: row.id,
  storeId: row.store_id,
  storeName: row.stores?.name ?? '',
  storeCode: row.stores?.code ?? '',
  inventoryItemId: row.inventory_item_id,
  sku: row.inventory_items?.sku ?? '',
  name: row.inventory_items?.name ?? '',
  category: row.inventory_items?.category ?? '',
  unit: row.inventory_items?.unit ?? '',
  quantity: Number(row.quantity ?? 0),
  threshold: Number(row.threshold ?? 0),
  sortOrder: Number(row.inventory_items?.sort_order ?? 0),
  updatedAt: row.updated_at,
  updatedBy: row.updated_by ?? null,
});

const mapAdjustmentRow = (row: any) => ({
  adjustmentId: row.id,
  storeId: row.store_id,
  storeName: row.stores?.name ?? '',
  storeCode: row.stores?.code ?? '',
  inventoryItemId: row.inventory_item_id,
  sku: row.inventory_items?.sku ?? '',
  itemName: row.inventory_items?.name ?? '',
  adjustmentType: row.adjustment_type,
  quantityDelta: Number(row.quantity_delta ?? 0),
  quantityBefore: Number(row.quantity_before ?? 0),
  quantityAfter: Number(row.quantity_after ?? 0),
  thresholdBefore: row.threshold_before == null ? null : Number(row.threshold_before),
  thresholdAfter: row.threshold_after == null ? null : Number(row.threshold_after),
  notes: row.notes ?? null,
  actorInternalUserId: row.actor_internal_user_id ?? null,
  actorName: row.internal_users?.full_name ?? null,
  createdAt: row.created_at,
});

const buildDashboard = async (
  db: ReturnType<typeof createClient>,
  storeIds: string[],
  historyLimit: number,
) => {
  try {
    await ensureStoreInventoryRows(db, storeIds);
  } catch (error) {
    return {
      status: 500,
      payload: {
        error: error instanceof Error ? error.message : 'Could not initialize store inventory.',
      },
    };
  }

  const [inventoryResult, historyResult] = await Promise.all([
    db
      .from('store_inventory')
      .select('id, store_id, inventory_item_id, quantity, threshold, updated_at, updated_by, stores(name, code), inventory_items!inner(sku, name, category, unit, sort_order, is_active)')
      .in('store_id', storeIds)
      .eq('inventory_items.is_active', true),
    db
      .from('inventory_adjustments')
      .select('id, store_id, inventory_item_id, adjustment_type, quantity_delta, quantity_before, quantity_after, threshold_before, threshold_after, notes, actor_internal_user_id, created_at, stores(name, code), inventory_items!inner(sku, name), internal_users(full_name)')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(historyLimit),
  ]);

  if (inventoryResult.error) {
    return { status: 500, payload: { error: 'Could not load store inventory.' } };
  }

  if (historyResult.error) {
    return { status: 500, payload: { error: 'Could not load inventory history.' } };
  }

  const items = (inventoryResult.data ?? [])
    .map(mapInventoryItemRow)
    .sort((left, right) => {
      if (left.storeName !== right.storeName) {
        return left.storeName.localeCompare(right.storeName);
      }
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.name.localeCompare(right.name);
    });

  const adjustments = (historyResult.data ?? []).map(mapAdjustmentRow);

  return {
    status: 200,
    payload: {
      items,
      adjustments,
    },
  };
};

const loadInventoryItemByStoreInventoryId = async (
  db: ReturnType<typeof createClient>,
  storeInventoryId: string,
) => {
  const { data, error } = await db
    .from('store_inventory')
    .select('id, store_id, inventory_item_id, quantity, threshold, updated_at, updated_by, stores(name, code), inventory_items!inner(sku, name, category, unit, sort_order, is_active)')
    .eq('id', storeInventoryId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapInventoryItemRow(data);
};

const loadInventoryItemByStoreAndInventoryItemId = async (
  db: ReturnType<typeof createClient>,
  storeId: string,
  inventoryItemId: string,
) => {
  const { data, error } = await db
    .from('store_inventory')
    .select('id, store_id, inventory_item_id, quantity, threshold, updated_at, updated_by, stores(name, code), inventory_items!inner(sku, name, category, unit, sort_order, is_active)')
    .eq('store_id', storeId)
    .eq('inventory_item_id', inventoryItemId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapInventoryItemRow(data);
};

const loadAdjustmentById = async (
  db: ReturnType<typeof createClient>,
  adjustmentId: string,
) => {
  const { data, error } = await db
    .from('inventory_adjustments')
    .select('id, store_id, inventory_item_id, adjustment_type, quantity_delta, quantity_before, quantity_after, threshold_before, threshold_after, notes, actor_internal_user_id, created_at, stores(name, code), inventory_items!inner(sku, name), internal_users(full_name)')
    .eq('id', adjustmentId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapAdjustmentRow(data);
};

const adjustInventory = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  body: InternalInventoryRequest,
) => {
  if (!body.inventoryItemId || !isUuid(body.inventoryItemId)) {
    return { status: 400, payload: { error: 'inventoryItemId is required and must be a valid UUID.' } };
  }

  if (
    body.adjustmentType !== 'set'
    && body.adjustmentType !== 'add'
    && body.adjustmentType !== 'reduce'
    && body.adjustmentType !== 'threshold_update'
    && body.adjustmentType !== 'receive'
    && body.adjustmentType !== 'manual_correction'
    && body.adjustmentType !== 'out_of_stock'
    && body.adjustmentType !== 'opening_balance'
  ) {
    return { status: 400, payload: { error: 'adjustmentType is invalid.' } };
  }

  const storeResult = await resolveStoreIds(db, session, body.storeId);
  if (storeResult.error || !storeResult.storeIds?.length) {
    return { status: storeResult.status ?? 400, payload: { error: storeResult.error ?? 'No store scope available.' } };
  }

  const storeId = storeResult.storeIds[0];
  const amount = parseNumeric(body.amount);
  const quantity = parseNumeric(body.quantity);
  const threshold = parseNumeric(body.threshold);

  const { data: mutationRow, error: mutationError } = await db
    .rpc('apply_inventory_adjustment', {
      p_store_id: storeId,
      p_inventory_item_id: body.inventoryItemId,
      p_adjustment_type: body.adjustmentType,
      p_quantity_delta: amount ?? 0,
      p_next_quantity: quantity,
      p_next_threshold: threshold,
      p_notes: typeof body.notes === 'string' ? body.notes : null,
      p_actor_internal_user_id: session.internal_user_id,
    })
    .single();

  if (mutationError || !mutationRow) {
    return {
      status: 500,
      payload: {
        error: mutationError?.message ?? 'Could not update inventory.',
      },
    };
  }

  const [item, adjustment] = await Promise.all([
    loadInventoryItemByStoreInventoryId(db, mutationRow.store_inventory_id),
    loadAdjustmentById(db, mutationRow.adjustment_id),
  ]);

  if (!item || !adjustment) {
    return {
      status: 500,
      payload: {
        error: 'Inventory was updated but the latest dashboard data could not be loaded.',
      },
    };
  }

  return {
    status: 200,
    payload: {
      success: true,
      item,
      adjustment,
    },
  };
};

const createInventoryItem = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
  body: InternalInventoryRequest,
) => {
  const normalizedName = normalizeText(body.name);
  const normalizedCategory = normalizeText(body.category).toLowerCase();
  const normalizedUnit = normalizeText(body.unit);
  const threshold = parseNumeric(body.threshold);
  const initialQuantity = parseNumeric(body.initialQuantity) ?? 0;

  if (!normalizedName) {
    return { status: 400, payload: { error: 'name is required.' } };
  }

  if (!normalizedCategory) {
    return { status: 400, payload: { error: 'category is required.' } };
  }

  if (!normalizedUnit) {
    return { status: 400, payload: { error: 'unit is required.' } };
  }

  if (threshold === null || threshold < 0) {
    return { status: 400, payload: { error: 'threshold must be a non-negative number.' } };
  }

  if (initialQuantity < 0) {
    return { status: 400, payload: { error: 'initialQuantity must be a non-negative number.' } };
  }

  const storeResult = await resolveStoreIds(db, session, body.storeId);
  if (storeResult.error || !storeResult.storeIds?.length) {
    return { status: storeResult.status ?? 400, payload: { error: storeResult.error ?? 'No store scope available.' } };
  }

  const storeId = storeResult.storeIds[0];
  const skuBase = slugify(normalizedName) || 'inventory_item';
  const sku = `${skuBase}_${crypto.randomUUID().slice(0, 8)}`;

  const { data: inventoryItemRow, error: inventoryItemError } = await db
    .from('inventory_items')
    .insert({
      sku,
      name: normalizedName,
      category: normalizedCategory,
      unit: normalizedUnit,
      default_threshold: threshold,
      sort_order: 9999,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (inventoryItemError || !inventoryItemRow) {
    return { status: 500, payload: { error: inventoryItemError?.message ?? 'Could not create inventory item.' } };
  }

  const { error: storeInventoryError } = await db
    .from('store_inventory')
    .insert({
      store_id: storeId,
      inventory_item_id: inventoryItemRow.id,
      quantity: 0,
      threshold,
      updated_by: session.internal_user_id,
      updated_at: new Date().toISOString(),
    });

  if (storeInventoryError) {
    return { status: 500, payload: { error: storeInventoryError.message || 'Could not create store inventory row.' } };
  }

  const { data: mutationRow, error: mutationError } = await db
    .rpc('apply_inventory_adjustment', {
      p_store_id: storeId,
      p_inventory_item_id: inventoryItemRow.id,
      p_adjustment_type: 'set',
      p_quantity_delta: 0,
      p_next_quantity: initialQuantity,
      p_next_threshold: threshold,
      p_notes: 'Created from inventory tab',
      p_actor_internal_user_id: session.internal_user_id,
    })
    .single();

  if (mutationError || !mutationRow) {
    return { status: 500, payload: { error: mutationError?.message ?? 'Inventory item was created, but the opening quantity could not be recorded.' } };
  }

  const [item, adjustment] = await Promise.all([
    loadInventoryItemByStoreAndInventoryItemId(db, storeId, inventoryItemRow.id),
    loadAdjustmentById(db, mutationRow.adjustment_id),
  ]);

  if (!item) {
    return { status: 500, payload: { error: 'Inventory item was created, but the dashboard row could not be reloaded.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'created',
      item,
      adjustment,
    },
  };
};

const archiveInventoryItem = async (
  db: ReturnType<typeof createClient>,
  body: InternalInventoryRequest,
) => {
  if (!body.inventoryItemId || !isUuid(body.inventoryItemId)) {
    return { status: 400, payload: { error: 'inventoryItemId is required and must be a valid UUID.' } };
  }

  const { data, error } = await db
    .from('inventory_items')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.inventoryItemId)
    .eq('is_active', true)
    .select('id')
    .single();

  if (error || !data) {
    return { status: 404, payload: { error: 'Inventory item not found.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'archived',
      inventoryItemId: data.id,
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
    return json(500, { error: 'Server is not configured for internal inventory access.' });
  }

  let body: InternalInventoryRequest;
  try {
    body = (await req.json()) as InternalInventoryRequest;
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

  const permissionResult = await enforcePermission(db, sessionResult.session, 'can_access_inventory');
  if (!permissionResult.allowed) {
    return json(permissionResult.status ?? 403, { error: permissionResult.error ?? 'Not allowed.' });
  }

  if (action.value === 'dashboard') {
    const storeResult = await resolveStoreIds(db, sessionResult.session, body.storeId);
    if (storeResult.error || !storeResult.storeIds) {
      return json(storeResult.status ?? 400, { error: storeResult.error ?? 'No accessible store found.' });
    }

    const historyLimit = Math.max(5, Math.min(100, Math.round(parseNumeric(body.historyLimit) ?? 20)));
    const dashboard = await buildDashboard(db, storeResult.storeIds, historyLimit);
    return json(dashboard.status, dashboard.payload);
  }

  if (action.value === 'create_item') {
    const creation = await createInventoryItem(db, sessionResult.session, body);
    return json(creation.status, creation.payload);
  }

  if (action.value === 'archive_item') {
    const archive = await archiveInventoryItem(db, body);
    return json(archive.status, archive.payload);
  }

  const mutation = await adjustInventory(db, sessionResult.session, body);
  return json(mutation.status, mutation.payload);
});
