import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { reportsService } from '../../services/reportsService';
import type { InternalReportsSummary } from '../../lib/internalOpsApi';

const formatCurrency = (value: number) => `Rs ${Number(value ?? 0).toFixed(2)}`;

export function ReportsScreen() {
  const { session, permissions, activeStoreUuid, activeStore, stores } = useAdminDashboard();
  const [summary, setSummary] = useState<InternalReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissions.canViewReports || !session) {
      setSummary(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void reportsService.loadDashboard(session, activeStoreUuid ?? undefined)
      .then((nextSummary) => {
        if (!active) return;
        setSummary(nextSummary);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : 'Could not load reports.');
        setSummary(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeStoreUuid, permissions.canViewReports, session]);

  const storeRows = useMemo(() => {
    if (!summary) return [];

    const fallbackNameById = new Map(stores.map((store) => [store.id, store.name]));
    return summary.storeSalesSummary.map((entry) => ({
      id: entry.storeId,
      name: entry.storeName || fallbackNameById.get(entry.storeId) || 'Unknown store',
      orders: entry.orderCount,
      revenue: entry.revenue,
    }));
  }, [stores, summary]);

  const ordersByChannelRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.ordersByChannel).map(([channel, orderCount]) => ({
      channel,
      orderCount,
    }));
  }, [summary]);

  const paymentMethodRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.paymentMethodSummary).map(([paymentMethod, totals]) => ({
      paymentMethod,
      count: totals.count,
      amount: totals.amount,
    }));
  }, [summary]);

  if (!permissions.canViewReports) {
    return <Navigate to="/admin/summary" replace />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reports"
        title="Operations performance"
        description="Backend-authoritative sales, channel mix, payment, and item reporting."
        action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore?.name ?? 'All stores'}</div>}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-primary/12 bg-white/90 px-4 py-5 text-sm text-foreground/60">
          Loading backend reports...
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Total revenue</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.totalRevenue)}</p>
            </article>
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Today revenue</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.todayRevenue)}</p>
            </article>
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Orders</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{summary.totalOrders}</p>
            </article>
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Avg ticket</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.averageTicket)}</p>
            </article>
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">GST today</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.todayTax)}</p>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">Orders by channel</p>
              <div className="mt-4 space-y-3">
                {ordersByChannelRows.map((entry) => (
                  <div key={entry.channel} className="flex items-center justify-between rounded-2xl bg-[#F7FAF3] px-4 py-3">
                    <span className="font-medium capitalize text-foreground">{entry.channel.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-semibold text-foreground">{entry.orderCount}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">Payment methods</p>
              <div className="mt-4 space-y-3">
                {paymentMethodRows.map((entry) => (
                  <div key={entry.paymentMethod} className="flex items-center justify-between rounded-2xl bg-[#F7FAF3] px-4 py-3">
                    <span className="font-medium capitalize text-foreground">{entry.paymentMethod}</span>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(entry.amount)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">Top items</p>
              <div className="mt-4 space-y-3">
                {summary.itemSalesSummary.slice(0, 5).map((entry) => (
                  <div key={entry.itemName} className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                    <p className="font-medium text-foreground">{entry.itemName}</p>
                    <p className="mt-1 text-sm text-foreground/60">{entry.quantity} sold · {formatCurrency(entry.revenue)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
                <p>Store</p>
                <p>Orders</p>
                <p>Revenue</p>
              </div>
              <div className="divide-y divide-primary/8">
                {storeRows.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-4 py-3">
                    <p className="font-medium text-foreground">{entry.name}</p>
                    <p className="text-sm text-foreground/66">{entry.orders}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(entry.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
