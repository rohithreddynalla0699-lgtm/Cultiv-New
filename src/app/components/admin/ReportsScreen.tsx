import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { getOrderStoreId, isOrderToday } from '../../utils/adminOrders';

export function ReportsScreen() {
  const { sharedOrders } = useAuth();
  const { permissions, activeStoreScope, activeStoreUuid, stores, activeStore } = useAdminDashboard();

  if (!permissions.canViewReports) {
    return <Navigate to="/admin/summary" replace />;
  }

  const scopedOrders = useMemo(() => (
    sharedOrders.filter((order) => {
      if (activeStoreScope === 'all') return true;
      if (activeStoreUuid) return getOrderStoreId(order) === activeStoreUuid;
      return getOrderStoreId(order) === activeStoreScope;
    })
  ), [activeStoreScope, activeStoreUuid, sharedOrders]);

  const todayOrders = useMemo(() => scopedOrders.filter(isOrderToday), [scopedOrders]);

  const metrics = useMemo(() => {
    const totalRevenue = scopedOrders.reduce((sum, order) => sum + order.total, 0);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const avgTicket = scopedOrders.length > 0 ? Math.round(totalRevenue / scopedOrders.length) : 0;
    const pickupCount = scopedOrders.filter((order) => order.orderType === 'pickup').length;
    const walkInCount = scopedOrders.filter((order) => order.orderType === 'walk_in').length;
    return { totalRevenue, todayRevenue, avgTicket, pickupCount, walkInCount };
  }, [scopedOrders, todayOrders]);

  const revenueByStore = useMemo(() => (
    (activeStoreUuid && activeStore ? [activeStore] : stores)
      .map((store) => {
        const canonicalStoreId =
          activeStoreUuid && activeStore && store.id === activeStore.id
            ? activeStoreUuid
            : store.id;
        const storeOrders = sharedOrders.filter((order) => getOrderStoreId(order) === canonicalStoreId);
        return {
          id: store.id,
          name: store.name,
          orders: storeOrders.length,
          revenue: storeOrders.reduce((sum, order) => sum + order.total, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
  ), [activeStore, activeStoreUuid, sharedOrders, stores]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reports"
        title="Operations performance"
        description="Monitor revenue, order mix, and store-level contribution in one report surface."
        action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore?.name ?? 'All stores'}</div>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Total revenue</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">Rs {metrics.totalRevenue}</p>
        </article>
        <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Today revenue</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">Rs {metrics.todayRevenue}</p>
        </article>
        <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Orders</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{scopedOrders.length}</p>
        </article>
        <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Avg ticket</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">Rs {metrics.avgTicket}</p>
        </article>
        <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Pickup / Walk-in</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{metrics.pickupCount} / {metrics.walkInCount}</p>
        </article>
      </div>

      <section className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <p>Store</p>
            <p>Orders</p>
            <p>Revenue</p>
          </div>
          <div className="divide-y divide-primary/8">
            {revenueByStore.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-4 py-3">
                <p className="font-medium text-foreground">{entry.name}</p>
                <p className="text-sm text-foreground/66">{entry.orders}</p>
                <p className="text-sm font-semibold text-foreground">Rs {entry.revenue}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
