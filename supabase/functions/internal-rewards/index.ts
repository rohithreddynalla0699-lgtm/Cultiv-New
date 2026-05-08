// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCorsHeaders } from '../_shared/cors.ts';
import { expireAvailableRewardEntitlements } from '../_shared/reward-entitlement-reconciliation.ts';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type RewardsAction =
  | 'dashboard'
  | 'upsert_reward'
  | 'set_reward_active'
  | 'update_program_settings'
  | 'lookup_customer_rewards'
  | 'adjust_customer_points';

interface InternalRewardsRequest {
  internalSessionToken?: string;
  action?: RewardsAction;
  rewardId?: string;
  rewardCode?: string;
  title?: string;
  description?: string | null;
  rewardType?: 'discount' | 'free_item';
  pointCost?: number;
  discountAmount?: number | null;
  freeItemTitle?: string | null;
  freeItemCategory?: string | null;
  freeItemFoodValue?: number | null;
  badge?: string | null;
  eligibilityRule?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  earnRateRupeesPerPoint?: number;
  pointsExpiryDays?: number;
  minOrderSubtotal?: number;
  maxDiscountRatio?: number;
  allowRewardRedemption?: boolean;
  allowCheckoutRewardUse?: boolean;
  search?: string;
  customerId?: string;
  pointsDelta?: number;
  reason?: string;
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

const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const normalizeText = (value?: string | null) => String(value ?? '').trim();
const normalizeRewardCode = (value?: string | null) => normalizeText(value).toLowerCase().replace(/\s+/g, '-');
const normalizePhoneSearch = (value?: string | null) => String(value ?? '').replace(/\D/g, '').slice(-10);
const parseInteger = (value: unknown) => Number.parseInt(String(value ?? ''), 10);
const parseNumber = (value: unknown) => Number(String(value ?? ''));
const unwrapJoinedReward = (value: any) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

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

const enforceManageRewardsPermission = async (
  db: ReturnType<typeof createClient>,
  session: InternalAccessSessionRow,
) => {
  if (session.scope_type === 'store') {
    return { allowed: false, status: 403, error: 'Store-scoped sessions cannot manage rewards.' };
  }

  const result = await loadPermissionKeys(db, session.internal_user_id);
  if (result.error) {
    return { allowed: false, status: 500, error: result.error };
  }

  if (!result.permissionKeys.includes('can_manage_rewards')) {
    return { allowed: false, status: 403, error: 'You do not have permission to manage rewards.' };
  }

  return { allowed: true };
};

const mapRewardRow = (row: any) => ({
  id: row.id,
  rewardCode: row.reward_code,
  title: row.title,
  description: row.description ?? '',
  rewardType: row.reward_type,
  pointCost: Number(row.point_cost ?? 0),
  discountAmount: row.discount_amount == null ? null : Number(row.discount_amount),
  freeItemTitle: row.free_item_title ?? null,
  freeItemCategory: row.free_item_category ?? null,
  freeItemFoodValue: row.free_item_food_value == null ? null : Number(row.free_item_food_value),
  badge: row.badge ?? null,
  eligibilityRule: row.eligibility_rule ?? 'Redeem with points anytime before expiry.',
  isActive: Boolean(row.is_active),
  sortOrder: Number(row.sort_order ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSettingsRow = (row: any) => ({
  id: row.id,
  earnRateRupeesPerPoint: Number(row.earn_rate_rupees_per_point ?? 10),
  pointsExpiryDays: Number(row.points_expiry_days ?? 90),
  minOrderSubtotal: Number(row.min_order_subtotal ?? 99),
  maxDiscountRatio: Number(row.max_discount_ratio ?? 0.3),
  allowRewardRedemption: Boolean(row.allow_reward_redemption),
  allowCheckoutRewardUse: Boolean(row.allow_checkout_reward_use),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCustomerRow = (row: any) => ({
  customerId: row.id,
  fullName: row.full_name,
  phone: row.phone,
  email: row.email ?? null,
  rewardPoints: Number(row.reward_points ?? 0),
  phoneVerified: Boolean(row.phone_verified),
  emailVerified: Boolean(row.email_verified),
});

const mapActivityRow = (row: any) => ({
  loyaltyEntryId: row.id,
  orderId: row.order_id ?? null,
  entryType: row.entry_type,
  points: Number(row.points ?? 0),
  pointsRemaining: Number(row.points_remaining ?? 0),
  earnedAt: row.earned_at,
  expiresAt: row.expires_at ?? null,
  createdAt: row.created_at,
  metadata: row.metadata ?? {},
});

const mapEntitlementRow = (row: any) => {
  const reward = unwrapJoinedReward(row.reward_catalog);
  return {
    entitlementId: row.id,
    rewardId: reward?.id ?? row.reward_id,
    rewardCode: reward?.reward_code ?? null,
    title: reward?.title ?? '',
    rewardType: reward?.reward_type ?? '',
    pointCost: Number(reward?.point_cost ?? 0),
    discountAmount: reward?.discount_amount == null ? null : Number(reward?.discount_amount),
    freeItemTitle: reward?.free_item_title ?? null,
    freeItemCategory: reward?.free_item_category ?? null,
    freeItemFoodValue: reward?.free_item_food_value == null ? null : Number(reward?.free_item_food_value),
    status: row.status,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at ?? null,
    usedAt: row.used_at ?? null,
    orderId: row.order_id ?? null,
  };
};

const loadDashboard = async (db: ReturnType<typeof createClient>) => {
  const [catalogResult, settingsResult] = await Promise.all([
    db
      .from('reward_catalog')
      .select('id, reward_code, title, description, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value, badge, eligibility_rule, is_active, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('reward_program_settings')
      .select('id, earn_rate_rupees_per_point, points_expiry_days, min_order_subtotal, max_discount_ratio, allow_reward_redemption, allow_checkout_reward_use, created_at, updated_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (catalogResult.error) {
    return { status: 500, payload: { error: 'Could not load reward catalog.' } };
  }

  if (settingsResult.error) {
    return { status: 500, payload: { error: 'Could not load reward program settings.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      catalog: (catalogResult.data ?? []).map(mapRewardRow),
      programSettings: settingsResult.data ? mapSettingsRow(settingsResult.data) : null,
    },
  };
};

const upsertReward = async (db: ReturnType<typeof createClient>, body: InternalRewardsRequest) => {
  const rewardCode = normalizeRewardCode(body.rewardCode);
  const title = normalizeText(body.title);
  const description = normalizeText(body.description);
  const rewardType = body.rewardType;
  const pointCost = parseInteger(body.pointCost);
  const sortOrder = Number.isFinite(parseInteger(body.sortOrder)) ? Math.max(0, parseInteger(body.sortOrder)) : 0;
  const badge = normalizeText(body.badge) || null;
  const eligibilityRule = normalizeText(body.eligibilityRule) || 'Redeem with points anytime before expiry.';
  const isActive = body.isActive !== false;

  if (!rewardCode) {
    return { status: 400, payload: { error: 'rewardCode is required.' } };
  }

  if (!title) {
    return { status: 400, payload: { error: 'title is required.' } };
  }

  if (rewardType !== 'discount' && rewardType !== 'free_item') {
    return { status: 400, payload: { error: 'rewardType must be discount or free_item.' } };
  }

  if (!Number.isInteger(pointCost) || pointCost <= 0) {
    return { status: 400, payload: { error: 'pointCost must be a whole number greater than zero.' } };
  }

  const payload: Record<string, unknown> = {
    reward_code: rewardCode,
    title,
    description,
    reward_type: rewardType,
    point_cost: pointCost,
    badge,
    eligibility_rule: eligibilityRule,
    is_active: isActive,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };

  if (rewardType === 'discount') {
    const discountAmount = parseNumber(body.discountAmount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return { status: 400, payload: { error: 'discountAmount must be zero or greater for discount rewards.' } };
    }

    payload.discount_amount = discountAmount;
    payload.free_item_title = null;
    payload.free_item_category = null;
    payload.free_item_food_value = null;
  } else {
    const freeItemTitle = normalizeText(body.freeItemTitle);
    const freeItemCategory = normalizeText(body.freeItemCategory);
    const freeItemFoodValue = parseNumber(body.freeItemFoodValue);

    if (!freeItemTitle || !freeItemCategory) {
      return { status: 400, payload: { error: 'freeItemTitle and freeItemCategory are required for free item rewards.' } };
    }

    if (!Number.isFinite(freeItemFoodValue) || freeItemFoodValue < 0) {
      return { status: 400, payload: { error: 'freeItemFoodValue must be zero or greater for free item rewards.' } };
    }

    payload.discount_amount = null;
    payload.free_item_title = freeItemTitle;
    payload.free_item_category = freeItemCategory;
    payload.free_item_food_value = freeItemFoodValue;
  }

  if (body.rewardId) {
    const { data, error } = await db
      .from('reward_catalog')
      .update(payload)
      .eq('id', body.rewardId)
      .select('id, reward_code, title, description, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value, badge, eligibility_rule, is_active, sort_order, created_at, updated_at')
      .single();

    if (error || !data) {
      return { status: 500, payload: { error: error?.message ?? 'Could not update reward.' } };
    }

    return {
      status: 200,
      payload: {
        success: true,
        mode: 'updated',
        reward: mapRewardRow(data),
      },
    };
  }

  const { data, error } = await db
    .from('reward_catalog')
    .insert(payload)
    .select('id, reward_code, title, description, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value, badge, eligibility_rule, is_active, sort_order, created_at, updated_at')
    .single();

  if (error || !data) {
    return { status: 500, payload: { error: error?.message ?? 'Could not create reward.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      mode: 'created',
      reward: mapRewardRow(data),
    },
  };
};

const setRewardActive = async (db: ReturnType<typeof createClient>, body: InternalRewardsRequest) => {
  const rewardId = normalizeText(body.rewardId);
  if (!rewardId) {
    return { status: 400, payload: { error: 'rewardId is required.' } };
  }

  if (typeof body.isActive !== 'boolean') {
    return { status: 400, payload: { error: 'isActive must be a boolean.' } };
  }

  const { data, error } = await db
    .from('reward_catalog')
    .update({
      is_active: body.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rewardId)
    .select('id, reward_code, title, description, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value, badge, eligibility_rule, is_active, sort_order, created_at, updated_at')
    .single();

  if (error || !data) {
    return { status: 500, payload: { error: error?.message ?? 'Could not update reward.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      reward: mapRewardRow(data),
    },
  };
};

const updateProgramSettings = async (db: ReturnType<typeof createClient>, body: InternalRewardsRequest) => {
  const earnRateRupeesPerPoint = parseInteger(body.earnRateRupeesPerPoint);
  const pointsExpiryDays = parseInteger(body.pointsExpiryDays);
  const minOrderSubtotal = parseNumber(body.minOrderSubtotal);
  const maxDiscountRatio = parseNumber(body.maxDiscountRatio);

  if (!Number.isInteger(earnRateRupeesPerPoint) || earnRateRupeesPerPoint <= 0) {
    return { status: 400, payload: { error: 'earnRateRupeesPerPoint must be a whole number greater than zero.' } };
  }
  if (!Number.isInteger(pointsExpiryDays) || pointsExpiryDays <= 0) {
    return { status: 400, payload: { error: 'pointsExpiryDays must be a whole number greater than zero.' } };
  }
  if (!Number.isFinite(minOrderSubtotal) || minOrderSubtotal < 0) {
    return { status: 400, payload: { error: 'minOrderSubtotal must be zero or greater.' } };
  }
  if (!Number.isFinite(maxDiscountRatio) || maxDiscountRatio < 0 || maxDiscountRatio > 1) {
    return { status: 400, payload: { error: 'maxDiscountRatio must be between 0 and 1.' } };
  }

  const payload = {
    earn_rate_rupees_per_point: earnRateRupeesPerPoint,
    points_expiry_days: pointsExpiryDays,
    min_order_subtotal: minOrderSubtotal,
    max_discount_ratio: maxDiscountRatio,
    allow_reward_redemption: body.allowRewardRedemption !== false,
    allow_checkout_reward_use: body.allowCheckoutRewardUse !== false,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSettings, error: existingSettingsError } = await db
    .from('reward_program_settings')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingSettingsError) {
    return { status: 500, payload: { error: 'Could not load reward program settings.' } };
  }

  if (existingSettings?.id) {
    const { data, error } = await db
      .from('reward_program_settings')
      .update(payload)
      .eq('id', existingSettings.id)
      .select('id, earn_rate_rupees_per_point, points_expiry_days, min_order_subtotal, max_discount_ratio, allow_reward_redemption, allow_checkout_reward_use, created_at, updated_at')
      .single();

    if (error || !data) {
      return { status: 500, payload: { error: error?.message ?? 'Could not update reward program settings.' } };
    }

    return {
      status: 200,
      payload: {
        success: true,
        programSettings: mapSettingsRow(data),
      },
    };
  }

  const { data, error } = await db
    .from('reward_program_settings')
    .insert(payload)
    .select('id, earn_rate_rupees_per_point, points_expiry_days, min_order_subtotal, max_discount_ratio, allow_reward_redemption, allow_checkout_reward_use, created_at, updated_at')
    .single();

  if (error || !data) {
    return { status: 500, payload: { error: error?.message ?? 'Could not create reward program settings.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      programSettings: mapSettingsRow(data),
    },
  };
};

const loadCustomerRewardDetail = async (db: ReturnType<typeof createClient>, customerId: string) => {
  try {
    await expireAvailableRewardEntitlements(db, customerId);
  } catch {
    return { status: 500, payload: { error: 'Could not reconcile expired reward entitlements.' } };
  }

  const { data: syncedRewardPoints, error: syncError } = await db.rpc('sync_customer_reward_points', {
    p_customer_id: customerId,
  });

  if (syncError) {
    return { status: 500, payload: { error: 'Could not sync customer reward points.' } };
  }

  const [customerResult, activityResult, entitlementsResult] = await Promise.all([
    db
      .from('customers')
      .select('id, full_name, phone, email, reward_points, phone_verified, email_verified, is_active')
      .eq('id', customerId)
      .eq('is_active', true)
      .maybeSingle(),
    db
      .from('loyalty_points_ledger')
      .select('id, order_id, entry_type, points, points_remaining, earned_at, expires_at, created_at, metadata')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('customer_reward_entitlements')
      .select('id, reward_id, status, redeemed_at, used_at, expires_at, order_id, reward_catalog(id, reward_code, title, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value)')
      .eq('customer_id', customerId)
      .in('status', ['available', 'used'])
      .order('redeemed_at', { ascending: false }),
  ]);

  if (customerResult.error) {
    return { status: 500, payload: { error: 'Could not load customer.' } };
  }
  if (!customerResult.data) {
    return { status: 404, payload: { error: 'Customer not found.' } };
  }
  if (activityResult.error) {
    return { status: 500, payload: { error: 'Could not load loyalty activity.' } };
  }
  if (entitlementsResult.error) {
    return { status: 500, payload: { error: 'Could not load reward entitlements.' } };
  }

  const customer = mapCustomerRow({
    ...customerResult.data,
    reward_points: syncedRewardPoints,
  });
  const entitlements = (entitlementsResult.data ?? []).map(mapEntitlementRow);

  return {
    status: 200,
    payload: {
      customer,
      recentActivity: (activityResult.data ?? []).map(mapActivityRow),
      availableEntitlements: entitlements.filter((entry: any) => entry.status === 'available'),
      usedEntitlements: entitlements.filter((entry: any) => entry.status === 'used'),
    },
  };
};

const lookupCustomerRewards = async (db: ReturnType<typeof createClient>, body: InternalRewardsRequest) => {
  const customerId = normalizeText(body.customerId);
  const search = normalizeText(body.search);
  const phoneSearch = normalizePhoneSearch(body.search);

  let results: any[] = [];

  if (search) {
    const searchPattern = `%${search}%`;
    let customerQuery = db
      .from('customers')
      .select('id, full_name, phone, email, reward_points, phone_verified, email_verified, is_active')
      .eq('is_active', true)
      .limit(12)
      .order('updated_at', { ascending: false });

    if (phoneSearch.length > 0) {
      customerQuery = customerQuery.or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.%${phoneSearch}%`);
    } else {
      customerQuery = customerQuery.or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`);
    }

    const { data, error } = await customerQuery;
    if (error) {
      return { status: 500, payload: { error: 'Could not search customers.' } };
    }

    results = (data ?? []).map(mapCustomerRow);
  }

  let customer = null;
  if (customerId) {
    const detailResult = await loadCustomerRewardDetail(db, customerId);
    if (detailResult.status !== 200) {
      return detailResult;
    }
    customer = detailResult.payload;
  }

  return {
    status: 200,
    payload: {
      success: true,
      results,
      customer,
    },
  };
};

const adjustCustomerPoints = async (
  db: ReturnType<typeof createClient>,
  body: InternalRewardsRequest,
  session: InternalAccessSessionRow,
) => {
  const customerId = normalizeText(body.customerId);
  const reason = normalizeText(body.reason);
  const pointsDelta = parseInteger(body.pointsDelta);

  if (!customerId) {
    return { status: 400, payload: { error: 'customerId is required.' } };
  }

  if (!Number.isInteger(pointsDelta) || pointsDelta === 0) {
    return { status: 400, payload: { error: 'pointsDelta must be a non-zero integer.' } };
  }

  if (!reason) {
    return { status: 400, payload: { error: 'A reason is required for manual point adjustments.' } };
  }

  const { data, error } = await db.rpc('admin_adjust_customer_reward_points', {
    p_customer_id: customerId,
    p_points_delta: pointsDelta,
    p_reason: reason,
    p_actor_internal_user_id: session.internal_user_id,
    p_actor_role_key: session.role_key,
  });

  if (error || !data) {
    return { status: 400, payload: { error: error?.message ?? 'Could not adjust customer reward points.' } };
  }

  const detailResult = await loadCustomerRewardDetail(db, customerId);
  if (detailResult.status !== 200) {
    return detailResult;
  }

  return {
    status: 200,
    payload: {
      success: true,
      adjustmentEntryId: data.adjustmentEntryId,
      availablePoints: data.availablePoints,
      customer: detailResult.payload,
    },
  };
};

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, {
    allowedHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-internal-session-token'],
  });
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(corsHeaders, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(corsHeaders, 500, { error: 'Server is not configured for rewards management.' });
  }

  let body: InternalRewardsRequest;
  try {
    body = await req.json();
  } catch {
    return json(corsHeaders, 400, { error: 'Invalid JSON body.' });
  }

  const internalSessionToken = normalizeText(body.internalSessionToken);
  if (!internalSessionToken) {
    return json(corsHeaders, 400, { error: 'internalSessionToken is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadSession(db, internalSessionToken);
  if (!verifiedSession.valid) {
    return json(corsHeaders, 401, { error: verifiedSession.error });
  }

  const permission = await enforceManageRewardsPermission(db, verifiedSession.session);
  if (!permission.allowed) {
    return json(corsHeaders, permission.status ?? 403, { error: permission.error ?? 'Not allowed.' });
  }

  switch (body.action) {
    case 'dashboard': {
      const result = await loadDashboard(db);
      return json(corsHeaders, result.status, result.payload);
    }
    case 'upsert_reward': {
      const result = await upsertReward(db, body);
      return json(corsHeaders, result.status, result.payload);
    }
    case 'set_reward_active': {
      const result = await setRewardActive(db, body);
      return json(corsHeaders, result.status, result.payload);
    }
    case 'update_program_settings': {
      const result = await updateProgramSettings(db, body);
      return json(corsHeaders, result.status, result.payload);
    }
    case 'lookup_customer_rewards': {
      const result = await lookupCustomerRewards(db, body);
      return json(corsHeaders, result.status, result.payload);
    }
    case 'adjust_customer_points': {
      const result = await adjustCustomerPoints(db, body, verifiedSession.session);
      return json(corsHeaders, result.status, result.payload);
    }
    default:
      return json(corsHeaders, 400, { error: 'Unsupported rewards action.' });
  }
});
