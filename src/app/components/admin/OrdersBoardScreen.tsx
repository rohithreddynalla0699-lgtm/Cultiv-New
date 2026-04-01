import { useMemo, useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { OrderCard } from './OrderCard';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { getAdminOrderBoardStatus, getOrderItemsSummary, getOrderStoreId, getRewardSummary, isOrderActive } from '../../utils/adminOrders';
import type { AdminOrderBoardStatus } from '../../types/admin';

type OrderFilter = 'all' | 'active' | 'ready' | 'completed';

const BOARD_COLUMNS: Array<{ status: AdminOrderBoardStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'picked_up', label: 'Picked Up' },
];

export function OrdersBoardScreen() {
  const { sharedOrders, updateOrderStatus } = useAuth();
  const { orderNotes, saveOrderNote, activeStoreScope, activeStore, getStoreName } = useAdminDashboard();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [transitioningOrderIds, setTransitioningOrderIds] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => sharedOrders.filter((order) => {
    if (activeStoreScope !== 'all' && getOrderStoreId(order) !== activeStoreScope) {
      return false;
    }
    const boardStatus = getAdminOrderBoardStatus(order);
    if (activeFilter === 'active') return isOrderActive(order);
    if (activeFilter === 'ready') return boardStatus === 'ready';
    if (activeFilter === 'completed') return boardStatus === 'picked_up';
    return true;
  }), [activeFilter, activeStoreScope, sharedOrders]);

  const groupedOrders = useMemo(() => Object.fromEntries(BOARD_COLUMNS.map((column) => [
    column.status,
    filteredOrders.filter((order) => getAdminOrderBoardStatus(order) === column.status),
  ])), [filteredOrders]);

  const getWaitingMinutes = (createdAt: string) => {
    const createdAtMs = new Date(createdAt).getTime();
    const deltaMs = Date.now() - createdAtMs;
    return Math.max(0, Math.floor(deltaMs / 60000));
  };

  const transitionOrder = async (orderId: string, status: 'preparing' | 'ready_for_pickup' | 'completed') => {
    if (transitioningOrderIds.has(orderId)) return;

    setTransitioningOrderIds((previous) => new Set(previous).add(orderId));
    try {
      await updateOrderStatus(orderId, status);
    } finally {
      setTransitioningOrderIds((previous) => {
        const next = new Set(previous);
        next.delete(orderId);
        return next;
      });
    }
  };

  const getPrimaryAction = (orderId: string, boardStatus: AdminOrderBoardStatus) => {
    if (boardStatus === 'new') {
      return () => void transitionOrder(orderId, 'preparing');
    }
    if (boardStatus === 'preparing') {
      return () => void transitionOrder(orderId, 'ready_for_pickup');
    }
    if (boardStatus === 'ready') {
      return () => void transitionOrder(orderId, 'completed');
    }
    return undefined;
  };

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Orders Board" title="Move pickup orders through the line." description="Track walk-in and online orders in one board with clear source badges and fast status actions." action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore?.name ?? 'All stores'}</div>} />

      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'ready', 'completed'] as const).map((filter) => (
          <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-full px-4 py-2 text-sm font-medium ${activeFilter === filter ? 'bg-primary text-primary-foreground' : 'bg-white/85 text-foreground/70'}`}>
            {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'ready' ? 'Ready' : 'Completed'}
          </button>
        ))}
      </div>

      <div className="hidden gap-4 xl:grid xl:grid-cols-4">
        {BOARD_COLUMNS.map((column) => (
          <section key={column.status} className="rounded-[28px] border border-primary/12 bg-white/70 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{column.label}</h2>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground/58">{groupedOrders[column.status]?.length ?? 0}</span>
            </div>
            <div className="space-y-4">
              {(groupedOrders[column.status] ?? []).map((order) => {
                const boardStatus = getAdminOrderBoardStatus(order);
                return (
                  <OrderCard
                    key={order.id}
                    orderId={order.id}
                    customerName={order.fullName}
                    storeName={activeStoreScope === 'all' ? getStoreName(getOrderStoreId(order)) : undefined}
                    placedTime={new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    waitingMinutes={getWaitingMinutes(order.createdAt)}
                    itemsSummary={getOrderItemsSummary(order)}
                    totalPayable={order.total}
                    rewardUsed={getRewardSummary(order) ?? undefined}
                    status={boardStatus}
                    pickupEstimate={order.fulfillmentWindow}
                    note={orderNotes[order.id]}
                    source={order.source}
                    onPrimaryAction={getPrimaryAction(order.id, boardStatus)}
                    onNoteSave={(value) => saveOrderNote(order.id, value)}
                    isTransitioning={transitioningOrderIds.has(order.id)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-8 xl:hidden">
        {BOARD_COLUMNS.map((column) => {
          const columnOrders = groupedOrders[column.status] ?? [];
          return (
            <section key={column.status} aria-label={`${column.label} orders`}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground/58">{column.label}</h2>
                <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground/58">{columnOrders.length}</span>
              </div>
              {columnOrders.length === 0 ? (
                <div className="rounded-[18px] border border-primary/10 bg-white/60 px-4 py-3 text-sm text-foreground/50">No orders in this stage.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {columnOrders.map((order) => {
                    const boardStatus = getAdminOrderBoardStatus(order);
                    return (
                      <OrderCard
                        key={order.id}
                        orderId={order.id}
                        customerName={order.fullName}
                        storeName={activeStoreScope === 'all' ? getStoreName(getOrderStoreId(order)) : undefined}
                        placedTime={new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        waitingMinutes={getWaitingMinutes(order.createdAt)}
                        itemsSummary={getOrderItemsSummary(order)}
                        totalPayable={order.total}
                        rewardUsed={getRewardSummary(order) ?? undefined}
                        status={boardStatus}
                        pickupEstimate={order.fulfillmentWindow}
                        note={orderNotes[order.id]}
                        source={order.source}
                        onPrimaryAction={getPrimaryAction(order.id, boardStatus)}
                        onNoteSave={(value) => saveOrderNote(order.id, value)}
                        isTransitioning={transitioningOrderIds.has(order.id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}