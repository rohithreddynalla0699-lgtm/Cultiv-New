import type { LoyaltyProfile } from './platform';

export interface LoyaltyBatchSummary {
  id: string;
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

export interface LoyaltySummary {
  availablePoints: number;
  activeBatches: LoyaltyBatchSummary[];
  recentActivity: LoyaltyRecentActivityItem[];
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
