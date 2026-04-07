import type { LoyaltyRecentActivityItem } from '../types/loyalty';

export const formatLoyaltyActivityLabel = (activity: LoyaltyRecentActivityItem) => {
  if (activity.entry_type === 'earn') {
    return `Earned ${activity.points} points`;
  }

  if (activity.entry_type === 'redeem') {
    return `Redeemed ${activity.points} points`;
  }

  return `${activity.points} points`;
};

export const formatLoyaltyActivityDate = (createdAt: string) => (
  new Date(createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
);

export const formatLoyaltyActivityPoints = (activity: LoyaltyRecentActivityItem) => (
  `${activity.entry_type === 'earn' ? '+' : '-'}${activity.points}`
);

export const getLoyaltyActivityPointsClassName = (activity: LoyaltyRecentActivityItem) => (
  activity.entry_type === 'earn' ? 'text-primary' : 'text-foreground/68'
);
