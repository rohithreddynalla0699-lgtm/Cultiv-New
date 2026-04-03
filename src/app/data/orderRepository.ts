import type { Order, OrderItem, OrderItemSelection, OrderStatus } from '../types/platform';
import { listInternalOrders, updateInternalOrderStatus, type InternalOrdersListFilters, type InternalOrdersListOrderRow } from '../lib/internalOpsApi';

interface InternalOrdersSessionPayload {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
  filters?: InternalOrdersListFilters;
}

function toUiStatus(status: InternalOrdersListOrderRow['order_status']): OrderStatus {
  if (status === 'preparing') return 'preparing';
  if (status === 'ready_for_pickup') return 'ready_for_pickup';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'completed';
  return 'placed';
}

function buildStatusTimeline(createdAt: string) {
  const steps: OrderStatus[] = ['placed', 'preparing', 'ready_for_pickup', 'completed'];
  const createdAtMs = new Date(createdAt).getTime();
  return steps.map((status, index) => ({
    status,
    label: status === 'placed'
      ? 'Order Placed'
      : status === 'preparing'
        ? 'Preparing'
        : status === 'ready_for_pickup'
          ? 'Ready for Pickup'
          : 'Completed',
    description: status === 'placed'
      ? 'Your order is in the CULTIV queue.'
      : status === 'preparing'
        ? 'Fresh ingredients are being assembled.'
        : status === 'ready_for_pickup'
          ? 'Your order is ready at the counter.'
          : 'Your order has been fulfilled.',
    at: new Date(createdAtMs + index * 12 * 60_000).toISOString(),
  }));
}

function toUiOrderType(orderType: InternalOrdersListOrderRow['order_type']): 'pickup' | 'walk-in' {
  return orderType === 'walk_in' ? 'walk-in' : 'pickup';
}

export async function fetchOperationalOrdersFromSupabase(sessionPayload: InternalOrdersSessionPayload): Promise<Order[]> {
  const { data, error } = await listInternalOrders(sessionPayload);

  if (error || !data) {
    throw new Error(error ?? 'Failed to fetch orders.');
  }

  const orders = data.orders ?? [];

  return orders.map((row) => {
    const orderItems = (row.order_items ?? []).map((itemRow) => {
      const groupedSelections = (itemRow.order_item_selections ?? []).reduce((sectionAcc, selectionRow) => {
        const section = selectionRow.group_name_snapshot || 'Selections';
        const list = sectionAcc.get(section) ?? [];
        list.push(selectionRow.option_name);
        sectionAcc.set(section, list);
        return sectionAcc;
      }, new Map<string, string[]>());

      const uiSelections: OrderItemSelection[] = Array.from(groupedSelections.entries()).map(([section, choices]) => ({
        section,
        choices,
      }));

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
      total: row.total_amount,
      status: toUiStatus(row.order_status),
      createdAt: row.created_at,
      phone: row.customer_phone,
      fullName: row.customer_name,
      email: row.customer_email ?? '',
      source: row.source_channel,
      paymentMethod: row.payment_method ?? undefined,
      fulfillmentWindow: '20-30 min',
      statusTimeline: buildStatusTimeline(row.created_at),
    } satisfies Order;
  });
}

export async function updateSupabaseOrderStatus(orderId: string, status: OrderStatus, sessionPayload: InternalOrdersSessionPayload): Promise<void> {
  if (status !== 'preparing' && status !== 'ready_for_pickup' && status !== 'completed') {
    throw new Error('Unsupported status transition target.');
  }

  const { data, error } = await updateInternalOrderStatus({
    internalSessionToken: sessionPayload.internalSessionToken,
    roleKey: sessionPayload.roleKey,
    scopeType: sessionPayload.scopeType,
    scopeStoreId: sessionPayload.scopeStoreId,
    orderId,
    nextStatus: status,
  });

  if (error || !data?.success) {
    throw new Error(error ?? 'Failed to update order status.');
  }
}
