import {
  loadInternalRewardsDashboard,
  setInternalRewardActive,
  updateInternalRewardProgramSettings,
  upsertInternalReward,
  type InternalRewardCatalogRecord,
  type InternalRewardProgramSettingsRecord,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

export interface RewardsAdminDashboard {
  catalog: InternalRewardCatalogRecord[];
  programSettings: InternalRewardProgramSettingsRecord | null;
}

const sessionPayload = (session: InternalAccessSession) => ({
  internalSessionToken: session.internalSessionToken,
});

export const rewardsAdminService = {
  async loadDashboard(session: InternalAccessSession): Promise<RewardsAdminDashboard> {
    const { data, error } = await loadInternalRewardsDashboard(sessionPayload(session));

    if (error || !data) {
      throw new Error(error ?? 'Could not load rewards dashboard.');
    }

    return {
      catalog: data.catalog,
      programSettings: data.programSettings,
    };
  },

  async saveReward(session: InternalAccessSession, input: {
    rewardId?: string;
    rewardCode: string;
    title: string;
    description?: string | null;
    rewardType: 'discount' | 'free_item';
    pointCost: number;
    discountAmount?: number | null;
    freeItemTitle?: string | null;
    freeItemCategory?: string | null;
    freeItemFoodValue?: number | null;
    badge?: string | null;
    eligibilityRule?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const { data, error } = await upsertInternalReward({
      ...sessionPayload(session),
      ...input,
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not save reward.' };
    }

    return {
      success: true,
      message: data.mode === 'created' ? 'Reward created.' : 'Reward updated.',
    };
  },

  async setRewardAvailability(session: InternalAccessSession, rewardId: string, isActive: boolean) {
    const { data, error } = await setInternalRewardActive({
      ...sessionPayload(session),
      rewardId,
      isActive,
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not update reward.' };
    }

    return {
      success: true,
      message: isActive ? 'Reward enabled.' : 'Reward disabled.',
    };
  },

  async saveProgramSettings(session: InternalAccessSession, input: {
    earnRateRupeesPerPoint: number;
    pointsExpiryDays: number;
    minOrderSubtotal: number;
    maxDiscountRatio: number;
    allowRewardRedemption: boolean;
    allowCheckoutRewardUse: boolean;
  }) {
    const { data, error } = await updateInternalRewardProgramSettings({
      ...sessionPayload(session),
      ...input,
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not update reward program settings.' };
    }

    return {
      success: true,
      message: 'Reward program settings updated.',
    };
  },
};
