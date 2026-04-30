// @ts-nocheck

const EXPIRING_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const toOfferValue = (reward: any) => {
  if (reward.reward_type === 'free_item') {
    return `Free ${String(reward.free_item_title ?? '').replace(/^Complimentary\s+/i, '').toLowerCase()}`;
  }
  return `₹${Number(reward.discount_amount ?? 0)} discount`;
};

const toOfferBadge = (reward: any) => {
  if (typeof reward.badge === 'string' && reward.badge.trim()) {
    return reward.badge.trim();
  }
  return `${Number(reward.point_cost ?? 0)} pts`;
};

const toOfferDescription = (reward: any) => {
  const description = String(reward.description ?? '').trim();
  return description || 'Redeem points for a CULTIV reward.';
};

const toOfferEligibilityRule = (reward: any) => {
  const rule = String(reward.eligibility_rule ?? '').trim();
  return rule || 'Redeem with points anytime before expiry.';
};

const mapRewardCatalogRow = (reward: any) => ({
  id: reward.id,
  rewardCode: reward.reward_code,
  title: reward.title,
  description: toOfferDescription(reward),
  rewardType: reward.reward_type,
  pointCost: Number(reward.point_cost ?? 0),
  discountAmount: reward.discount_amount === null ? null : Number(reward.discount_amount),
  freeItemTitle: reward.free_item_title ?? null,
  freeItemCategory: reward.free_item_category ?? null,
  freeItemFoodValue: reward.free_item_food_value === null ? null : Number(reward.free_item_food_value),
  badge: toOfferBadge(reward),
  eligibilityRule: toOfferEligibilityRule(reward),
  isActive: Boolean(reward.is_active),
  sortOrder: Number(reward.sort_order ?? 0),
  value: toOfferValue(reward),
});

const mapEntitlementRow = (entitlement: any) => ({
  entitlementId: entitlement.id,
  rewardId: entitlement.reward_catalog?.id ?? entitlement.reward_id,
  rewardCode: entitlement.reward_catalog?.reward_code ?? null,
  title: entitlement.reward_catalog?.title ?? '',
  rewardType: entitlement.reward_catalog?.reward_type ?? '',
  pointCost: Number(entitlement.reward_catalog?.point_cost ?? 0),
  discountAmount: entitlement.reward_catalog?.discount_amount === null ? null : Number(entitlement.reward_catalog?.discount_amount),
  freeItemTitle: entitlement.reward_catalog?.free_item_title ?? null,
  freeItemCategory: entitlement.reward_catalog?.free_item_category ?? null,
  freeItemFoodValue: entitlement.reward_catalog?.free_item_food_value === null ? null : Number(entitlement.reward_catalog?.free_item_food_value),
  status: entitlement.status,
  redeemedAt: entitlement.redeemed_at,
  expiresAt: entitlement.expires_at,
  usedAt: entitlement.used_at,
  orderId: entitlement.order_id,
});

const mapSettingsRow = (settings: any) => ({
  id: settings.id,
  earnRateRupeesPerPoint: Number(settings.earn_rate_rupees_per_point ?? 10),
  pointsExpiryDays: Number(settings.points_expiry_days ?? 90),
  minOrderSubtotal: Number(settings.min_order_subtotal ?? 99),
  maxDiscountRatio: Number(settings.max_discount_ratio ?? 0.3),
  allowRewardRedemption: Boolean(settings.allow_reward_redemption),
  allowCheckoutRewardUse: Boolean(settings.allow_checkout_reward_use),
});

export const buildRewardSummary = async (db: any, customerId: string) => {
  const nowIso = new Date().toISOString();

  const { data: syncedRewardPoints, error: syncError } = await db.rpc('sync_customer_reward_points', {
    p_customer_id: customerId,
  });

  if (syncError) {
    throw new Error(`Failed to sync reward points cache: ${syncError.message}`);
  }

  const [
    batchesResult,
    activityResult,
    rewardCatalogResult,
    entitlementsResult,
    settingsResult,
  ] = await Promise.all([
    db
      .from('loyalty_points_ledger')
      .select('loyalty_entry_id, order_id, points, points_remaining, earned_at, expires_at, created_at')
      .eq('user_id', customerId)
      .eq('entry_type', 'earn')
      .gt('points_remaining', 0)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('earned_at', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('loyalty_points_ledger')
      .select('order_id, entry_type, points, points_remaining, earned_at, expires_at, created_at, metadata')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('reward_catalog')
      .select('id, reward_code, title, description, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value, badge, eligibility_rule, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('customer_reward_entitlements')
      .select('id, reward_id, status, redeemed_at, used_at, expires_at, order_id, reward_catalog(id, reward_code, title, reward_type, point_cost, discount_amount, free_item_title, free_item_category, free_item_food_value)')
      .eq('customer_id', customerId)
      .eq('status', 'available')
      .order('redeemed_at', { ascending: true }),
    db
      .from('reward_program_settings')
      .select('id, earn_rate_rupees_per_point, points_expiry_days, min_order_subtotal, max_discount_ratio, allow_reward_redemption, allow_checkout_reward_use')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (batchesResult.error) throw new Error(`Failed to load loyalty batches: ${batchesResult.error.message}`);
  if (activityResult.error) throw new Error(`Failed to load loyalty activity: ${activityResult.error.message}`);
  if (rewardCatalogResult.error) throw new Error(`Failed to load reward catalog: ${rewardCatalogResult.error.message}`);
  if (entitlementsResult.error) throw new Error(`Failed to load reward entitlements: ${entitlementsResult.error.message}`);
  if (settingsResult.error) throw new Error(`Failed to load reward program settings: ${settingsResult.error.message}`);

  const activeBatches = Array.isArray(batchesResult.data) ? batchesResult.data : [];
  const availablePoints = Number(syncedRewardPoints ?? 0);
  const expiringSoonCutoff = Date.now() + EXPIRING_SOON_WINDOW_MS;

  const expiringSoonPoints = activeBatches.reduce((sum: number, batch: any) => {
    if (!batch.expires_at) return sum;
    const expiresAt = Date.parse(batch.expires_at);
    if (Number.isNaN(expiresAt) || expiresAt > expiringSoonCutoff) return sum;
    return sum + Number(batch.points_remaining ?? 0);
  }, 0);

  const activeRewardCatalog = (rewardCatalogResult.data ?? []).map(mapRewardCatalogRow);
  const availableEntitlements = (entitlementsResult.data ?? []).map(mapEntitlementRow);

  return {
    availablePoints,
    expiringSoonPoints,
    activeBatches,
    recentActivity: activityResult.data ?? [],
    activeRewardCatalog,
    availableEntitlements,
    availableRewardCodes: Array.from(new Set(availableEntitlements.map((entry: any) => entry.rewardCode).filter(Boolean))),
    programSettings: settingsResult.data ? mapSettingsRow(settingsResult.data) : null,
  };
};
