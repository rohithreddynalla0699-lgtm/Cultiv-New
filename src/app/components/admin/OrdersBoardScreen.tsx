import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { ordersService } from '../../services/ordersService';
import {
  listInternalOrders,
  type InternalOrdersListFilters,
  type InternalOrdersListOrderRow,
} from '../../lib/internalOpsApi';

import { OrdersBoardHeader } from './orders-board/OrdersBoardHeader';
import { OrdersKanban } from './orders-board/OrdersKanban';
import CancelOrderDialog from './orders-board/CancelOrderDialog';
import { OrderNotesDrawer } from './orders-board/OrderNotesDrawer';

import type {
  OrdersBoardDateFilter,
  OrdersBoardOrder,
  OrdersBoardOrderTypeFilter,
} from '../../types/ordersBoard';

type OptimisticOrderStatus =
  | 'preparing'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

type OrdersServiceInput = Parameters<typeof ordersService.getOrders>[0];
type BaseOrder = OrdersServiceInput['orders'][number];

function startOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function endOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

function normalizeScopeType(scopeType?: string): 'global' | 'store' {
  return scopeType === 'store' ? 'store' : 'global';
}

function mapOrderTypeFilter(orderType: OrdersBoardOrderTypeFilter): InternalOrdersListFilters['orderType'] {
  if (orderType === 'all') return 'all';
  if (orderType === 'online') return 'online';
  return 'walk_in';
}

function buildInternalFilters(params: {
  orderType: OrdersBoardOrderTypeFilter;
  dateFilter: OrdersBoardDateFilter;
  customDate: string;
  searchQuery: string;
}): InternalOrdersListFilters {
  const { orderType, dateFilter, customDate, searchQuery } = params;

  const filters: InternalOrdersListFilters = {
    orderType: mapOrderTypeFilter(orderType),
    search: searchQuery.trim() || undefined,
    status: 'all',
  };

  const now = new Date();

  if (dateFilter === 'today') {
    filters.date = {
      from: startOfDayIso(now),
      to: endOfDayIso(now),
    };
  } else if (dateFilter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    filters.date = {
      from: startOfDayIso(yesterday),
      to: endOfDayIso(yesterday),
    };
  } else if (dateFilter === 'custom' && customDate) {
    const custom = new Date(customDate);
    if (!Number.isNaN(custom.getTime())) {
      filters.date = {
        from: startOfDayIso(custom),
        to: endOfDayIso(custom),
      };
    }
  }

  return filters;
}

function mapInternalRowToBaseOrder(row: InternalOrdersListOrderRow): BaseOrder {
  const items = (row.order_items ?? []).map((item) => ({
    id: item.order_item_id,
    menuItemId: '',
    name: item.item_name,
    title: item.item_name,
    category: item.item_category,
    price: Number(item.unit_price ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    quantity: item.quantity,
    selections: (item.order_item_selections ?? []).map((selection) => ({
      id: selection.order_item_selection_id,
      section: selection.group_name_snapshot,
      choice: selection.option_name,
      label: selection.option_name,
    })),
  }));

  const subtotal = Number(row.subtotal_amount ?? 0);
  const discount = Number(row.discount_amount ?? 0);
  const taxAmount = Number(row.tax_amount ?? 0);
  const tipAmount = Number(row.tip_amount ?? 0);
  const total = Number(row.total_amount ?? 0);

  return {
    id: row.order_id,
    orderNumber: row.order_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email ?? '',
    status: row.order_status,
    type: row.order_type === 'walk_in' ? 'in_store' : row.order_type,
    sourceChannel: row.source_channel,
    storeId: row.store_id,
    paymentMethod: row.payment_method ?? undefined,
    items,
    category: items[0]?.category ?? 'Order',
    subtotal,
    rewardDiscount: discount,
    discountAmount: discount,
    gst: taxAmount,
    taxAmount,
    tipAmount,
    total,
    totalAmount: total,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    placedAt: row.created_at,
    note: '',
    cancellationReason: row.cancellation_reason ?? '',
  } as unknown as BaseOrder;
}

export function OrdersBoardScreen() {
  const { updateOrderStatus } = useAuth();
  const { touchActivity } = useStoreSession();
  const {
    session,
    stores,
    orderNotes,
    saveOrderNote,
    activeStoreScope,
    setActiveStoreScope,
    hasPermission,
    hasAnyPermission,
    isStoreScoped,
  } = useAdminDashboard();

  const [orderType, setOrderType] = useState<OrdersBoardOrderTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<OrdersBoardDateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const [internalOrders, setInternalOrders] = useState<BaseOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [mutatingOrderIds, setMutatingOrderIds] = useState<Set<string>>(new Set());
  const [optimisticStatusByOrderId, setOptimisticStatusByOrderId] = useState<
    Record<string, OptimisticOrderStatus>
  >({});
  const [feedbackMessage, setFeedbackMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<OrdersBoardOrder | null>(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<OrdersBoardOrder | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!session?.internalSessionToken) {
      setInternalOrders([]);
      return;
    }

    setIsLoadingOrders(true);

    const result = await listInternalOrders({
      internalSessionToken: session.internalSessionToken,
      roleKey: session.roleKey,
      scopeType: normalizeScopeType(session.scopeType),
      scopeStoreId: session.scopeStoreId ?? null,
      filters: buildInternalFilters({
        orderType,
        dateFilter,
        customDate,
        searchQuery,
      }),
    });

    if (result.error || !result.data) {
      setInternalOrders([]);
      setFeedbackMessage({
        tone: 'error',
        text: result.error ?? 'Could not fetch internal orders.',
      });
      setIsLoadingOrders(false);
      return;
    }

    setInternalOrders(result.data.orders.map(mapInternalRowToBaseOrder));
    setIsLoadingOrders(false);
  }, [session, orderType, dateFilter, customDate, searchQuery]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshTick((previous) => previous + 1);
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders, refreshTick]);

  useEffect(() => {
    const onActivity = () => {
      void touchActivity();
    };

    document.addEventListener('click', onActivity);
    document.addEventListener('keydown', onActivity);

    return () => {
      document.removeEventListener('click', onActivity);
      document.removeEventListener('keydown', onActivity);
    };
  }, [touchActivity]);

  const mergedOrders = useMemo(
    () =>
      internalOrders.map((order) => ({
        ...order,
        status: optimisticStatusByOrderId[order.id] ?? (order as any).status,
        note: orderNotes[order.id] ?? (order as any).note ?? '',
      })),
    [internalOrders, optimisticStatusByOrderId, orderNotes],
  );

  const boardState = useMemo(
    () =>
      ordersService.getOrders({
        orders: mergedOrders,
        notesByOrderId: orderNotes,
        filters: {
          storeId: session?.scopeStoreId ?? activeStoreScope,
          orderType,
          dateFilter,
          customDate,
          searchQuery,
        },
      }),
    [session?.scopeStoreId, activeStoreScope, customDate, dateFilter, mergedOrders, orderNotes, orderType, searchQuery],
  );

  const permissionsForBoard = useMemo(() => {
    return ordersService.getPermissions({ hasPermission, hasAnyPermission });
  }, [hasAnyPermission, hasPermission]);

  if (!hasPermission('can_access_orders')) {
    return <Navigate to={isStoreScoped() ? '/store/shift' : '/operations'} replace />;
  }

  const withMutationGuard = async (orderId: string, work: () => Promise<void>) => {
    if (mutatingOrderIds.has(orderId)) return;

    setMutatingOrderIds((previous) => new Set(previous).add(orderId));
    try {
      await work();
    } finally {
      setMutatingOrderIds((previous) => {
        const next = new Set(previous);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handlePrimaryAction = async (order: OrdersBoardOrder) => {
    void touchActivity();

    const nextStatus = ordersService.getNextStatus(order.boardStatus);
    if (!nextStatus || !permissionsForBoard.canAdvanceOrderStatus) return;

    await withMutationGuard(order.id, async () => {
      setOptimisticStatusByOrderId((previous) => ({ ...previous, [order.id]: nextStatus }));

      const result = await ordersService.updateStatus({
        orderId: order.id,
        status: nextStatus,
        updateOrderStatus,
      });

      if (!result.success) {
        setOptimisticStatusByOrderId((previous) => {
          const next = { ...previous };
          delete next[order.id];
          return next;
        });

        const isConflict = /workflow|step|already|changed/i.test(result.message);
        setFeedbackMessage({
          tone: 'error',
          text: isConflict
            ? 'Order was already updated by another teammate. Board has been refreshed.'
            : result.message,
        });

        await loadOrders();
        return;
      }

      setFeedbackMessage({ tone: 'success', text: result.message });

      setOptimisticStatusByOrderId((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });

      await loadOrders();
    });
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    void touchActivity();
    if (!selectedOrderForCancel || !permissionsForBoard.canCancelOrder) return;

    await withMutationGuard(orderId, async () => {
      setOptimisticStatusByOrderId((previous) => ({ ...previous, [orderId]: 'cancelled' }));

      const result = await ordersService.cancelOrder({
        orderId,
        reason,
        updateOrderStatus,
      });

      if (!result.success) {
        setOptimisticStatusByOrderId((previous) => {
          const next = { ...previous };
          delete next[orderId];
          return next;
        });
        setFeedbackMessage({ tone: 'error', text: result.message });
        await loadOrders();
        return;
      }

      saveOrderNote(
        orderId,
        `Cancelled by ${session?.roleName ?? 'Staff'} at ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      );

      setSelectedOrderForCancel(null);
      setFeedbackMessage({
        tone: 'info',
        text: 'Order cancelled and moved out of active queue.',
      });

      setOptimisticStatusByOrderId((previous) => {
        const next = { ...previous };
        delete next[orderId];
        return next;
      });

      await loadOrders();
    });
  };

  const handleSaveNote = async (nextValue: string) => {
    void touchActivity();
    if (!selectedOrderForNotes) return;

    setIsSavingNote(true);
    try {
      saveOrderNote(selectedOrderForNotes.id, nextValue.trim());
      setFeedbackMessage({ tone: 'success', text: 'Order note saved.' });
      setSelectedOrderForNotes(null);
    } finally {
      setIsSavingNote(false);
    }
  };

  const syncLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [refreshTick]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <OrdersBoardHeader
        activeStoreScope={activeStoreScope}
        stores={stores}
        canSwitchStoreScope={hasPermission('can_switch_stores')}
        orderType={orderType}
        dateFilter={dateFilter}
        customDate={customDate}
        searchQuery={searchQuery}
        lastSyncLabel={syncLabel}
        onChangeStore={setActiveStoreScope}
        onChangeOrderType={setOrderType}
        onChangeDateFilter={setDateFilter}
        onChangeCustomDate={setCustomDate}
        onChangeSearchQuery={setSearchQuery}
      />

      {feedbackMessage ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedbackMessage.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : feedbackMessage.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      {isLoadingOrders ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 px-4 py-6 text-center">
          <h3 className="text-base font-semibold text-foreground">Loading orders...</h3>
          <p className="mt-1 text-sm text-foreground/60">
            Fetching latest store orders from backend.
          </p>
        </div>
      ) : boardState.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 px-4 py-6 text-center">
          <h3 className="text-base font-semibold text-foreground">No orders found for this filter.</h3>
          <p className="mt-1 text-sm text-foreground/60">
            Try switching date, store, order type, or search query.
          </p>
        </div>
      ) : (
        <OrdersKanban
          boardState={boardState}
          canCancelOrder={permissionsForBoard.canCancelOrder}
          mutatingOrderIds={mutatingOrderIds}
          onPrimaryAction={(order) => {
            void handlePrimaryAction(order);
          }}
          onOpenNotes={setSelectedOrderForNotes}
          onCancelOrder={setSelectedOrderForCancel}
        />
      )}

      <OrderNotesDrawer
        isOpen={Boolean(selectedOrderForNotes)}
        orderId={selectedOrderForNotes?.displayId}
        initialValue={selectedOrderForNotes?.note}
        isSaving={isSavingNote}
        onClose={() => setSelectedOrderForNotes(null)}
        onSave={handleSaveNote}
      />

      {selectedOrderForCancel && (
        <CancelOrderDialog
          isOpen={true}
          orderId={selectedOrderForCancel.id}
          displayOrderId={selectedOrderForCancel.displayId}
          isSubmitting={mutatingOrderIds.has(selectedOrderForCancel.id)}
          onClose={() => setSelectedOrderForCancel(null)}
          onConfirmCancel={async (orderId, reason) => {
            await handleCancelOrder(orderId, reason);
          }}
        />
      )}
    </motion.div>
  );
}