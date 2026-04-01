import type { Order } from '../types/platform';
import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import type { AdminOrderBoardStatus } from '../types/admin';

export function getOrderStoreId(order: Order) {
  return order.storeId ?? DEFAULT_ORDER_STORE_ID;
}

export function getAdminOrderBoardStatus(order: Order): AdminOrderBoardStatus {
  switch (order.status) {
    case 'placed':
      return 'new';
    case 'preparing':
      return 'preparing';
    case 'ready_for_pickup':
      return 'ready';
    case 'completed':
    default:
      return 'picked_up';
  }
}

export function getRewardSummary(order: Order): string | null {
  const rewardItems = order.items.filter((item) => item.category === 'Rewards').map((item) => item.title);
  if (rewardItems.length > 0) {
    return rewardItems.join(', ');
  }
  if (order.rewardDiscount > 0) {
    return `Reward discount ₹${order.rewardDiscount}`;
  }
  return null;
}

export function getOrderItemsSummary(order: Order): string[] {
  return order.items
    .filter((item) => item.category !== 'Rewards')
    .map((item) => `${item.quantity} x ${item.title}`);
}

export function isOrderActive(order: Order) {
  return order.status !== 'completed';
}

export function isOrderToday(order: Order) {
  const date = new Date(order.createdAt);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}