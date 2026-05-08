// @ts-nocheck

export const expireAvailableRewardEntitlements = async (db: any, customerId: string) => {
  const normalizedCustomerId = String(customerId ?? '').trim();
  if (!normalizedCustomerId) {
    return { updatedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('customer_reward_entitlements')
    .update({
      status: 'expired',
      updated_at: nowIso,
    })
    .eq('customer_id', normalizedCustomerId)
    .eq('status', 'available')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso)
    .select('id');

  if (error) {
    throw new Error(`Failed to reconcile expired reward entitlements: ${error.message}`);
  }

  return { updatedCount: Array.isArray(data) ? data.length : 0 };
};
