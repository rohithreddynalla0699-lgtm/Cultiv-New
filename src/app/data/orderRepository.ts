import type { Order, OrderItem, OrderItemSelection, OrderStatus } from '../types/platform';
import {
  listInternalOrders,
  updateInternalOrderStatus,
  type InternalOrdersListFilters,
  type InternalOrdersListOrderRow,
} from '../lib/internalOpsApi';

interface InternalOrdersSessionPayload {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  filters?: InternalOrdersListFilters;
}

function isInternalOrdersRoute(pathname: string) {
  return pathname.includes('/store/') || pathname.includes('/operations/');
}

function toUiStatus(status: InternalOrdersListOrderRow['order_status']): OrderStatus {
  if (status === 'preparing') return 'preparing';
  if (status === 'ready_for_pickup') return 'ready_for_pickup';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'placed';
}

function normalizeSourceChannel(sourceChannel: InternalOrdersListOrderRow['source_channel']): Order['source'] {
  return sourceChannel === 'walk-in' ? 'walk_in' : sourceChannel;
}

function buildStatusTimeline(createdAt: string) {
  const steps: OrderStatus[] = ['placed', 'preparing', 'ready_for_pickup', 'completed', 'cancelled'];
  const createdAtMs = new Date(createdAt).getTime();

  return steps.map((status, index) => ({
    status,
    label:
      status === 'placed'
        ? 'Order Placed'
        : status === 'preparing'
          ? 'Preparing'
          : status === 'ready_for_pickup'
            ? 'Ready for Pickup'
            : status === 'completed'
              ? 'Completed'
              : 'Cancelled',
    description:
      status === 'placed'
        ? 'Your order is in the CULTIV queue.'
        : status === 'preparing'
          ? 'Fresh ingredients are being assembled.'
          : status === 'ready_for_pickup'
            ? 'Your order is ready at the counter.'
            : status === 'completed'
              ? 'Your order has been fulfilled.'
              : 'This order was cancelled.',
    at: new Date(createdAtMs + index * 12 * 60_000).toISOString(),
  }));
}

function toUiOrderType(orderType: InternalOrdersListOrderRow['order_type']): Order['orderType'] {
  return orderType === 'walk_in' ? 'walk_in' : 'pickup';
}

function mapOrderRow(row: InternalOrdersListOrderRow): Order {
  const orderItems = (row.order_items ?? []).map((itemRow) => {
    const groupedSelections = (itemRow.order_item_selections ?? []).reduce((sectionAcc, selectionRow) => {
      const section = selectionRow.group_name_snapshot || 'Selections';
      const list = sectionAcc.get(section) ?? [];
      list.push(selectionRow.option_name);
      sectionAcc.set(section, list);
      return sectionAcc;
    }, new Map<string, string[]>());

    const uiSelections: OrderItemSelection[] = Array.from(groupedSelections.entries()).map(
      ([section, choices]) => ({
        section,
        choices,
      }),
    );

    return {
      id: itemRow.order_item_id,
      orderId: itemRow.order_id,
      category: itemRow.item_category,
      title: itemRow.item_name,
      selections: uiSelections,
      quantity: itemRow.quantity,
      price: itemRow.unit_price,
    } satisfies OrderItem;
  });

  return {
    id: row.order_id,
    storeId: row.store_id,
    category: orderItems[0]?.category ?? 'Central Ordering',
    items: orderItems,
    orderType: toUiOrderType(row.order_type),
    subtotal: row.subtotal_amount,
    rewardDiscount: row.discount_amount,
    taxAmount: row.tax_amount,
    total: row.total_amount,
    status: toUiStatus(row.order_status),
    createdAt: row.created_at,
    phone: row.customer_phone ?? '',
    fullName: row.customer_name || 'Walk-in Guest',
    email: row.customer_email ?? '',
    source: normalizeSourceChannel(row.source_channel),
    paymentMethod: row.payment_method ?? undefined,
    tipAmount: row.tip_amount,
    fulfillmentWindow: '20-30 min',
    statusTimeline: buildStatusTimeline(row.created_at),
    cancellation_reason: row.cancellation_reason ?? undefined,
  } satisfies Order;
}

export async function getOrderById(
  orderId: string,
  sessionPayload: InternalOrdersSessionPayload,
): Promise<Order | undefined> {
  if (!isInternalOrdersRoute(window.location.pathname)) {
    return undefined;
  }

  const { data, error } = await listInternalOrders({
    ...sessionPayload,
    filters: { ...sessionPayload.filters, search: orderId },
  });

  if (error || !data || !data.orders) return undefined;
  const row = data.orders.find((entry) => entry.order_id === orderId);
  return row ? mapOrderRow(row) : undefined;
}

export async function fetchOperationalOrdersFromSupabase(
  sessionPayload: InternalOrdersSessionPayload,
): Promise<Order[]> {
  if (!isInternalOrdersRoute(window.location.pathname)) {
    return [];
  }

  const { data, error } = await listInternalOrders(sessionPayload);

  if (error || !data) {
    throw new Error(error ?? 'Failed to fetch orders.');
  }

  return (data.orders ?? []).map(mapOrderRow);
}

export async function updateSupabaseOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason: string | undefined,
  sessionPayload: InternalOrdersSessionPayload,
): Promise<void> {
  if (
    status !== 'preparing' &&
    status !== 'ready_for_pickup' &&
    status !== 'completed' &&
    status !== 'cancelled'
  ) {
    throw new Error('Unsupported status transition target.');
  }

  const { data, error } = await updateInternalOrderStatus({
    internalSessionToken: sessionPayload.internalSessionToken,
    roleKey: sessionPayload.roleKey,
    scopeType: sessionPayload.scopeType,
    scopeStoreId: sessionPayload.scopeStoreId,
    orderId,
    nextStatus: status,
    cancellationReason: status === 'cancelled' ? reason?.trim() || 'Cancelled by staff.' : undefined,
  });

  if (error || !data?.success) {
    throw new Error(error ?? 'Could not update order status.');
  }
}
