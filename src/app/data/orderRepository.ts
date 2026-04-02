import type { Order, OrderItem, OrderItemSelection, OrderStatus } from '../types/platform';

// @ts-ignore - Supabase client is defined in JS module.
import { supabase } from '../../lib/supabase';

interface SupabaseOrderRow {
  order_id: string;
  order_type: 'online' | 'walk_in' | 'phone';
  source_channel: 'app' | 'walk-in' | 'phone';
  order_status: 'pending' | 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';
  store_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payment_method: 'cash' | 'upi' | 'card' | null;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  created_at: string;
}

interface SupabaseOrderItemRow {
  order_item_id: string;
  order_id: string;
  item_name: string;
  item_category: string;
  unit_price: number;
  quantity: number;
}

interface SupabaseOrderSelectionRow {
  order_item_selection_id: string;
  order_item_id: string;
  group_name_snapshot: string;
  option_name: string;
}

function toUiStatus(status: SupabaseOrderRow['order_status']): OrderStatus {
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

function toUiOrderType(orderType: SupabaseOrderRow['order_type']): 'pickup' | 'walk-in' {
  return orderType === 'walk_in' ? 'walk-in' : 'pickup';
}

function toSupabaseStatus(status: OrderStatus): SupabaseOrderRow['order_status'] {
  if (status === 'preparing') return 'preparing';
  if (status === 'ready_for_pickup') return 'ready_for_pickup';
  if (status === 'completed') return 'completed';
  return 'placed';
}

export async function fetchOperationalOrdersFromSupabase(): Promise<Order[]> {
  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('order_id, order_type, source_channel, order_status, store_id, customer_name, customer_phone, customer_email, payment_method, subtotal_amount, discount_amount, total_amount, created_at')
    .order('created_at', { ascending: false });

  if (orderError) {
    throw new Error(`Failed to fetch orders: ${orderError.message}`);
  }

  const orders = (orderRows ?? []) as SupabaseOrderRow[];
  if (orders.length === 0) return [];

  const orderIds = orders.map((row) => row.order_id);

  const { data: orderItemRows, error: itemError } = await supabase
    .from('order_items')
    .select('order_item_id, order_id, item_name, item_category, unit_price, quantity')
    .in('order_id', orderIds);

  if (itemError) {
    throw new Error(`Failed to fetch order_items: ${itemError.message}`);
  }

  const items = (orderItemRows ?? []) as SupabaseOrderItemRow[];
  const orderItemIds = items.map((row) => row.order_item_id);

  let selections: SupabaseOrderSelectionRow[] = [];
  if (orderItemIds.length > 0) {
    const { data: selectionRows, error: selectionError } = await supabase
      .from('order_item_selections')
      .select('order_item_selection_id, order_item_id, group_name_snapshot, option_name')
      .in('order_item_id', orderItemIds);

    if (selectionError) {
      throw new Error(`Failed to fetch order_item_selections: ${selectionError.message}`);
    }
    selections = (selectionRows ?? []) as SupabaseOrderSelectionRow[];
  }

  const selectionsByItemId = selections.reduce((acc, row) => {
    const list = acc.get(row.order_item_id) ?? [];
    list.push(row);
    acc.set(row.order_item_id, list);
    return acc;
  }, new Map<string, SupabaseOrderSelectionRow[]>());

  const orderItemsByOrderId = items.reduce((acc, itemRow) => {
    const groupedSelections = selectionsByItemId.get(itemRow.order_item_id) ?? [];
    const groupedBySection = groupedSelections.reduce((sectionAcc, selectionRow) => {
      const section = selectionRow.group_name_snapshot || 'Selections';
      const list = sectionAcc.get(section) ?? [];
      list.push(selectionRow.option_name);
      sectionAcc.set(section, list);
      return sectionAcc;
    }, new Map<string, string[]>());

    const uiSelections: OrderItemSelection[] = Array.from(groupedBySection.entries()).map(([section, choices]) => ({
      section,
      choices,
    }));

    const uiOrderItem: OrderItem = {
      id: itemRow.order_item_id,
      orderId: itemRow.order_id,
      category: itemRow.item_category,
      title: itemRow.item_name,
      selections: uiSelections,
      quantity: itemRow.quantity,
      price: itemRow.unit_price,
    };

    const list = acc.get(itemRow.order_id) ?? [];
    list.push(uiOrderItem);
    acc.set(itemRow.order_id, list);
    return acc;
  }, new Map<string, OrderItem[]>());

  return orders.map((row) => ({
    id: row.order_id,
    storeId: row.store_id,
    category: orderItemsByOrderId.get(row.order_id)?.[0]?.category ?? 'Central Ordering',
    items: orderItemsByOrderId.get(row.order_id) ?? [],
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
  }));
}

export async function updateSupabaseOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ order_status: toSupabaseStatus(status), updated_at: new Date().toISOString() })
    .eq('order_id', orderId);

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
}
