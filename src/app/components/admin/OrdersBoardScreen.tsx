import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { ordersService } from '../../services/ordersService';
import { OrdersBoardHeader } from './orders-board/OrdersBoardHeader';
import { OrdersKanban } from './orders-board/OrdersKanban';
import CancelOrderDialog from './orders-board/CancelOrderDialog';
import { OrderNotesDrawer } from './orders-board/OrderNotesDrawer';
import { Navigate } from 'react-router-dom';
import type {
  OrdersBoardDateFilter,
  OrdersBoardOrder,
  OrdersBoardOrderTypeFilter,
} from '../../types/ordersBoard';

export function OrdersBoardScreen() {
  const { sharedOrders, updateOrderStatus } = useAuth();
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
  const [mutatingOrderIds, setMutatingOrderIds] = useState<Set<string>>(new Set());
  const [optimisticStatusByOrderId, setOptimisticStatusByOrderId] = useState<Record<string, 'preparing' | 'ready_for_pickup' | 'completed'>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<OrdersBoardOrder | null>(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<OrdersBoardOrder | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshTick((previous) => previous + 1);
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

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

  const mergedOrders = useMemo(() => (
    sharedOrders.map((order) => ({
      ...order,
      status: optimisticStatusByOrderId[order.id] ?? order.status,
    }))
  ), [optimisticStatusByOrderId, sharedOrders]);

  const boardState = useMemo(() => ordersService.getOrders({
    orders: mergedOrders,
    notesByOrderId: orderNotes,
    filters: {
      storeId: activeStoreScope,
      orderType,
      dateFilter,
      customDate,
      searchQuery,
    },
  }), [activeStoreScope, customDate, dateFilter, mergedOrders, orderNotes, orderType, refreshTick, searchQuery]);

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
        return;
      }

      setFeedbackMessage({ tone: 'success', text: result.message });
      setOptimisticStatusByOrderId((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
    });
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    void touchActivity();
    if (!selectedOrderForCancel || !permissionsForBoard.canCancelOrder) return;

    await withMutationGuard(orderId, async () => {
      setOptimisticStatusByOrderId((previous) => ({ ...previous, [orderId]: 'completed' }));

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
        return;
      }

      saveOrderNote(orderId, `Cancelled by ${session?.roleName ?? 'Staff'} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
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

      {boardState.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 px-4 py-6 text-center">
          <h3 className="text-base font-semibold text-foreground">No orders found for this filter.</h3>
          <p className="mt-1 text-sm text-foreground/60">Try switching date, store, order type, or search query.</p>
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