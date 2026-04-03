import type { AdminOrderBoardStatus } from './admin';
import type { OrderStatus } from './platform';

export type OrdersBoardOrderTypeFilter = 'all' | 'online' | 'in_store';

export type OrdersBoardDateFilter = 'today' | 'yesterday' | 'custom';

export type OrdersBoardPrimaryAction = 'start_preparing' | 'mark_ready' | 'mark_picked_up';

export interface OrdersBoardFilters {
  storeId: string;
  orderType: OrdersBoardOrderTypeFilter;
  dateFilter: OrdersBoardDateFilter;
  customDate?: string;
  searchQuery: string;
}

export interface OrdersBoardOrder {
  id: string;
  displayId: string;
  boardStatus: AdminOrderBoardStatus;
  orderStatus: OrderStatus;
  orderType: Exclude<OrdersBoardOrderTypeFilter, 'all'>;
  customerName: string;
  customerPhone: string;
  itemsSummary: string[];
  totalAmount: number;
  storeId: string;
  sourceLabel: 'Online' | 'In Store';
  placedAt: string;
  waitingMinutes: number;
  note?: string;
}

export interface OrdersBoardState {
  byStatus: Record<AdminOrderBoardStatus, OrdersBoardOrder[]>;
  total: number;
  newOrdersCount: number;
  oldestNewOrderMinutes: number;
  shouldHighlightRush: boolean;
}

export interface OrdersBoardPermissions {
  canAdvanceOrderStatus: boolean;
  canCancelOrder: boolean;
}

export type OrdersBoardStatusMutation = 'preparing' | 'ready_for_pickup' | 'completed';
