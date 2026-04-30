// @ts-nocheck

const roundMoney = (value: unknown) => Number((Number(value ?? 0) + Number.EPSILON).toFixed(2));

const unwrapJoinedReward = (value: any) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export interface ResolvedCheckoutReward {
  entitlementId: string;
  rewardId: string;
  rewardCode: string;
  rewardType: 'discount' | 'free_item';
  title: string;
  pointCost: number;
  discountAmount: number | null;
  freeItemTitle: string | null;
  freeItemCategory: string | null;
  freeItemFoodValue: number | null;
}

export const resolveCheckoutRewards = async (
  db: any,
  customerId: string,
  selectedRewardEntitlements: Array<{ entitlementId?: unknown; rewardCode?: unknown }>,
  foodSubtotal: number,
) => {
  const normalizedSelections = Array.from(new Map(
    (Array.isArray(selectedRewardEntitlements) ? selectedRewardEntitlements : [])
      .map((entry) => ({
        entitlementId: String(entry?.entitlementId ?? '').trim(),
        rewardCode: String(entry?.rewardCode ?? '').trim(),
      }))
      .filter((entry) => entry.entitlementId && entry.rewardCode)
      .map((entry) => [entry.entitlementId, entry]),
  ).values());

  const { data: settings, error: settingsError } = await db
    .from('reward_program_settings')
    .select('id, min_order_subtotal, max_discount_ratio, allow_checkout_reward_use')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`Failed to load reward settings: ${settingsError.message}`);
  }

  if (normalizedSelections.length === 0) {
    return {
      resolvedRewards: [] as ResolvedCheckoutReward[],
      canonicalRewardLines: [] as Array<Record<string, unknown>>,
      discountAmount: 0,
      settings,
    };
  }

  if (!settings?.allow_checkout_reward_use) {
    throw new Error('Reward use at checkout is not available right now.');
  }

  if (!Number.isFinite(foodSubtotal) || foodSubtotal <= 0) {
    throw new Error('Rewards can only be applied to food items.');
  }

  if (foodSubtotal < Number(settings.min_order_subtotal ?? 0)) {
    throw new Error(`Minimum order of ₹${Number(settings.min_order_subtotal ?? 0)} is required to use rewards.`);
  }

  const entitlementIds = normalizedSelections.map((entry) => entry.entitlementId);
  const { data: entitlements, error: entitlementsError } = await db
    .from('customer_reward_entitlements')
    .select(`
      id,
      customer_id,
      status,
      expires_at,
      reward_catalog (
        id,
        reward_code,
        title,
        reward_type,
        point_cost,
        discount_amount,
        free_item_title,
        free_item_category,
        free_item_food_value,
        is_active
      )
    `)
    .eq('customer_id', customerId)
    .in('id', entitlementIds);

  if (entitlementsError) {
    throw new Error(`Failed to load selected rewards: ${entitlementsError.message}`);
  }

  const entitlementById = new Map((entitlements ?? []).map((entry: any) => [entry.id, entry]));
  const now = Date.now();
  const resolvedRewards = normalizedSelections.map((selection) => {
    const entitlement = entitlementById.get(selection.entitlementId);
    const reward = unwrapJoinedReward(entitlement?.reward_catalog);
    if (!entitlement || !reward) {
      throw new Error('One or more selected rewards are no longer available.');
    }
    if (entitlement.status !== 'available') {
      throw new Error('One or more selected rewards are no longer available.');
    }
    if (entitlement.expires_at) {
      const expiresAt = Date.parse(entitlement.expires_at);
      if (!Number.isNaN(expiresAt) && expiresAt <= now) {
        throw new Error('One or more selected rewards are no longer available.');
      }
    }

    if (!reward.is_active) {
      throw new Error('One or more selected rewards are no longer available.');
    }
    if (String(reward.reward_code).trim() !== selection.rewardCode) {
      throw new Error('One or more selected rewards are no longer available.');
    }

    return {
      entitlementId: entitlement.id,
      rewardId: reward.id,
      rewardCode: reward.reward_code,
      rewardType: reward.reward_type,
      title: reward.title,
      pointCost: Number(reward.point_cost ?? 0),
      discountAmount: reward.discount_amount === null ? null : roundMoney(reward.discount_amount),
      freeItemTitle: reward.free_item_title ?? null,
      freeItemCategory: reward.free_item_category ?? null,
      freeItemFoodValue: reward.free_item_food_value === null ? null : roundMoney(reward.free_item_food_value),
    } satisfies ResolvedCheckoutReward;
  });

  const discountRewards = resolvedRewards.filter((reward) => reward.rewardType === 'discount');
  if (discountRewards.length > 1) {
    throw new Error('Only one discount reward can be used per order.');
  }

  const discountAmount = discountRewards.length > 0 ? roundMoney(discountRewards[0].discountAmount ?? 0) : 0;
  if (discountAmount > foodSubtotal) {
    throw new Error('Reward discount cannot exceed items total.');
  }

  const maxDiscountRatio = Number(settings.max_discount_ratio ?? 0);
  if (discountAmount > roundMoney(foodSubtotal * maxDiscountRatio)) {
    throw new Error(`Discount reward cannot exceed ${Math.round(maxDiscountRatio * 100)}% of order total.`);
  }

  const freeItemValue = roundMoney(
    resolvedRewards
      .filter((reward) => reward.rewardType === 'free_item')
      .reduce((sum, reward) => sum + Number(reward.freeItemFoodValue ?? 0), 0),
  );
  if (freeItemValue > foodSubtotal) {
    throw new Error('Free item rewards cannot exceed items total.');
  }

  const canonicalRewardLines = resolvedRewards
    .filter((reward) => reward.rewardType === 'free_item')
    .map((reward) => ({
      item_name: reward.freeItemTitle,
      item_category: reward.freeItemCategory ?? 'Rewards',
      unit_price: 0,
      quantity: 1,
      line_total: 0,
      selections: [],
    }));

  return {
    resolvedRewards,
    canonicalRewardLines,
    discountAmount,
    settings,
  };
};
