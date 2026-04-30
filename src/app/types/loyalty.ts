import type { LoyaltyProfile } from './platform';
import type { BackendRewardCatalogEntry } from '../config/rewardsCatalog';

export interface LoyaltyBatchSummary {
  id?: string;
  order_id: string | null;
  points: number;
  points_remaining: number;
  earned_at: string;
  expires_at: string;
  created_at: string;
}

export interface LoyaltyRecentActivityItem {
  entry_type: string;
  points: number;
  created_at: string;
}

export interface RewardProgramSettingsSummary {
  id: string;
  earnRateRupeesPerPoint: number;
  pointsExpiryDays: number;
  minOrderSubtotal: number;
  maxDiscountRatio: number;
  allowRewardRedemption: boolean;
  allowCheckoutRewardUse: boolean;
}

export interface CustomerRewardEntitlementSummary {
  entitlementId: string;
  rewardId: string;
  rewardCode: string;
  title: string;
  rewardType: string;
  pointCost: number;
  discountAmount: number | null;
  freeItemTitle: string | null;
  freeItemCategory: string | null;
  freeItemFoodValue: number | null;
  status: string;
  redeemedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  orderId: string | null;
}

export interface LoyaltySummary {
  availablePoints: number;
  expiringSoonPoints: number;
  activeBatches: LoyaltyBatchSummary[];
  recentActivity: LoyaltyRecentActivityItem[];
  activeRewardCatalog: BackendRewardCatalogEntry[];
  availableEntitlements: CustomerRewardEntitlementSummary[];
  availableRewardCodes: string[];
  programSettings: RewardProgramSettingsSummary | null;
}

export const createEmptyLoyaltyProfile = (userId: string): LoyaltyProfile => ({
  userId,
  pointsBatches: [],
  availablePoints: 0,
  expiringSoonPoints: 0,
  expiredPoints: 0,
  availableRewards: [],
  pointsActivity: [],
  totalOrders: 0,
  totalSpend: 0,
  currentTier: 'Founding Member',
});
