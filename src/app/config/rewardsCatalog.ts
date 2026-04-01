import type { Offer } from '../types/platform';

type FreeItemReward = {
  id: string;
  points: number;
  type: 'free_item';
  item: string;
  foodValue: number;
};

type DiscountReward = {
  id: string;
  points: number;
  type: 'discount';
  amount: number;
};

export type RewardCatalogEntry = FreeItemReward | DiscountReward;

export const REWARDS_CATALOG: RewardCatalogEntry[] = [
  { id: 'water', points: 50, type: 'free_item', item: 'Water Bottle', foodValue: 25 },
  { id: 'drink', points: 100, type: 'free_item', item: 'Drink', foodValue: 79 },
  { id: '30off', points: 150, type: 'discount', amount: 30 },
  { id: '50off', points: 220, type: 'discount', amount: 50 },
  { id: '100off', points: 320, type: 'discount', amount: 100 },
  { id: 'kids', points: 450, type: 'free_item', item: 'Kids Meal', foodValue: 129 },
  { id: 'family200', points: 650, type: 'discount', amount: 200 },
];

export const LEGACY_REWARD_ID_MAP: Record<string, string> = {
  'reward-water-bottle': 'water',
  'reward-free-drink': 'drink',
  'reward-nachos-addon': '30off',
  nachos: '30off',
  'reward-30-off': '30off',
  'reward-50-off': '50off',
  'reward-100-off': '100off',
  'reward-kids-meal': 'kids',
  'reward-family-200-off': 'family200',
};

export const normalizeRewardId = (rewardId: string) => LEGACY_REWARD_ID_MAP[rewardId] ?? rewardId;

const rewardTitle = (reward: RewardCatalogEntry) => {
  if (reward.type === 'free_item') {
    return `Free ${reward.item}`;
  }
  if (reward.id === 'family200') {
    return `₹${reward.amount} Off Family Order`;
  }
  return `₹${reward.amount} Off`;
};

const rewardDescription = (reward: RewardCatalogEntry) => {
  if (reward.type === 'free_item') {
    return `Redeem points for a complimentary ${reward.item.toLowerCase()}.`;
  }
  return `Redeem points for ₹${reward.amount} off your order.`;
};

const rewardValue = (reward: RewardCatalogEntry) => {
  if (reward.type === 'free_item') {
    return `Free ${reward.item.toLowerCase()}`;
  }
  return `₹${reward.amount} discount`;
};

export const OFFER_LIBRARY: Offer[] = REWARDS_CATALOG.map((reward) => ({
  id: reward.id,
  title: rewardTitle(reward),
  description: rewardDescription(reward),
  type: 'reward',
  value: rewardValue(reward),
  active: true,
  eligibilityRule: 'Redeem with points anytime before expiry.',
  pointCost: reward.points,
  badge: `${reward.points} pts`,
  unlockType: 'points',
  unlockValue: reward.points,
  autoApply: false,
}));

export const DISCOUNT_REWARD_VALUES: Record<string, number> = Object.fromEntries(
  REWARDS_CATALOG
    .filter((reward): reward is DiscountReward => reward.type === 'discount')
    .map((reward) => [reward.id, reward.amount]),
);

export const FREE_ITEM_REWARD_DETAILS: Record<string, { title: string; category: string; foodValue: number }> = Object.fromEntries(
  REWARDS_CATALOG
    .filter((reward): reward is FreeItemReward => reward.type === 'free_item')
    .map((reward) => [reward.id, { title: `Complimentary ${reward.item}`, category: 'Rewards', foodValue: reward.foodValue }]),
);

export const FREE_ITEM_REWARD_VALUES: Record<string, number> = Object.fromEntries(
  REWARDS_CATALOG
    .filter((reward): reward is FreeItemReward => reward.type === 'free_item')
    .map((reward) => [reward.id, reward.foodValue]),
);

export const REWARD_ID_SET = new Set(REWARDS_CATALOG.map((reward) => reward.id));
