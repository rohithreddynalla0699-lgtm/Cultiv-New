import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import { getAdminOrderBoardStatus, getOrderItemsSummary, getOrderStoreId } from '../utils/adminOrders';
import type { AdminOrderBoardStatus } from '../types/admin';
import type { Order, OrderStatus } from '../types/platform';
import type {
  OrdersBoardFilters,
  OrdersBoardOrder,
  OrdersBoardPermissions,
  OrdersBoardState,
  OrdersBoardStatusMutation,
} from '../types/ordersBoard';

interface GetOrdersInput {
  orders: Order[];
  notesByOrderId: Record<string, string>;
  filters: OrdersBoardFilters;
}

interface UpdateStatusInput {
  orderId: string;
  status: OrdersBoardStatusMutation;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{ success: boolean; message: string }>;
}

interface CancelOrderInput {
  orderId: string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{ success: boolean; message: string }>;
}

const ALL_COLUMNS: AdminOrderBoardStatus[] = ['new', 'preparing', 'ready', 'picked_up'];

const startOfDay = (date: Date) => {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
};

const endOfDay = (date: Date) => {
  const cloned = new Date(date);
  cloned.setHours(23, 59, 59, 999);
  return cloned;
};

const isWithinSelectedDate = (createdAt: string, dateFilter: OrdersBoardFilters['dateFilter'], customDate?: string) => {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  if (dateFilter === 'today') {
    const now = new Date();
    return created >= startOfDay(now) && created <= endOfDay(now);
  }

  if (dateFilter === 'yesterday') {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return created >= startOfDay(yesterday) && created <= endOfDay(yesterday);
  }

  if (!customDate) return true;
  const selected = new Date(`${customDate}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return true;
  return created >= startOfDay(selected) && created <= endOfDay(selected);
};

const inferBoardOrderType = (order: Order): OrdersBoardOrder['orderType'] => {
  if (order.source === 'app') return 'online';
  return 'in_store';
};

const toSourceLabel = (orderType: OrdersBoardOrder['orderType']): OrdersBoardOrder['sourceLabel'] => {
  switch (orderType) {
    case 'online':
      return 'Online';
    case 'in_store':
    default:
      return 'In Store';
  }
};

const toDisplayId = (orderId: string) => {
  if (!orderId) return 'N/A';
  return orderId.length > 8 ? orderId.slice(-8).toUpperCase() : orderId.toUpperCase();
};

const getWaitingMinutes = (createdAt: string) => {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000));
};

const matchesSearch = (order: OrdersBoardOrder, query: string) => {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return (
    order.id.toLowerCase().includes(normalized)
    || order.displayId.toLowerCase().includes(normalized)
    || order.customerName.toLowerCase().includes(normalized)
    || order.customerPhone.toLowerCase().includes(normalized)
  );
};

const emptyBoardState = (): OrdersBoardState => ({
  byStatus: {
    new: [],
    preparing: [],
    ready: [],
    picked_up: [],
  },
  total: 0,
  newOrdersCount: 0,
  oldestNewOrderMinutes: 0,
  shouldHighlightRush: false,
});

const groupByStatus = (orders: OrdersBoardOrder[]) => {
  const state = emptyBoardState();
  const grouped: Record<AdminOrderBoardStatus, OrdersBoardOrder[]> = {
    new: [],
    preparing: [],
    ready: [],
    picked_up: [],
  };

  for (const order of orders) {
    grouped[order.boardStatus].push(order);
  }

  for (const status of ALL_COLUMNS) {
    grouped[status].sort((left, right) => (
      new Date(left.placedAt).getTime() - new Date(right.placedAt).getTime()
    ));
  }

  const newOrders = grouped.new;
  const oldestNewOrderMinutes = newOrders.reduce((max, order) => Math.max(max, order.waitingMinutes), 0);

  return {
    byStatus: grouped,
    total: orders.length,
    newOrdersCount: newOrders.length,
    oldestNewOrderMinutes,
    shouldHighlightRush: newOrders.length > 5 || oldestNewOrderMinutes > 15,
  };
};

const applyFilters = (orders: OrdersBoardOrder[], filters: OrdersBoardFilters) => {
  return orders
    .filter((order) => filters.storeId === 'all' || order.storeId === filters.storeId)
    .filter((order) => filters.orderType === 'all' || order.orderType === filters.orderType)
    .filter((order) => isWithinSelectedDate(order.placedAt, filters.dateFilter, filters.customDate))
    .filter((order) => matchesSearch(order, filters.searchQuery));
};

export const ordersService = {
  getOrders({ orders, notesByOrderId, filters }: GetOrdersInput): OrdersBoardState {
    const normalized: OrdersBoardOrder[] = orders.map((order) => {
      const orderType = inferBoardOrderType(order);
      return {
        id: order.id,
        displayId: toDisplayId(order.id),
        boardStatus: getAdminOrderBoardStatus(order),
        orderStatus: order.status,
        orderType,
        customerName: order.fullName,
        customerPhone: order.phone,
        itemsSummary: getOrderItemsSummary(order),
        totalAmount: order.total,
        storeId: getOrderStoreId(order) || DEFAULT_ORDER_STORE_ID,
        sourceLabel: toSourceLabel(orderType),
        placedAt: order.createdAt,
        waitingMinutes: getWaitingMinutes(order.createdAt),
        note: notesByOrderId[order.id],
      };
    });

    const filtered = applyFilters(normalized, filters);
    return groupByStatus(filtered);
  },

  getNextStatus(boardStatus: AdminOrderBoardStatus): OrdersBoardStatusMutation | null {
    if (boardStatus === 'new') return 'preparing';
    if (boardStatus === 'preparing') return 'ready_for_pickup';
    if (boardStatus === 'ready') return 'completed';
    return null;
  },

  getPrimaryActionLabel(boardStatus: AdminOrderBoardStatus) {
    if (boardStatus === 'new') return 'Start Preparing';
    if (boardStatus === 'preparing') return 'Mark Ready';
    if (boardStatus === 'ready') return 'Mark Picked Up';
    return null;
  },

  getPermissions(params: {
    hasPermission: (permissionKey: string) => boolean;
    hasAnyPermission: (permissionKeys: string[]) => boolean;
  }): OrdersBoardPermissions {
    const { hasPermission, hasAnyPermission } = params;

    // CULTIV assembly-line model: anyone with orders access can move status forward.
    const canAdvanceOrderStatus = hasPermission('can_access_orders');

    // Cancel follows orders-access for now until a dedicated cancel permission is introduced.
    const canCancelOrder = hasAnyPermission(['can_access_orders']);

    return {
      canAdvanceOrderStatus,
      canCancelOrder,
    };
  },

  async updateStatus({ orderId, status, updateOrderStatus }: UpdateStatusInput) {
    return updateOrderStatus(orderId, status);
  },

  async cancelOrder({ orderId, updateOrderStatus }: CancelOrderInput) {
    // Current domain model does not expose a separate "cancelled" status in frontend OrderStatus.
    // We close the order through the terminal state until cancelled is added end-to-end.
    return updateOrderStatus(orderId, 'completed');
  },
};
