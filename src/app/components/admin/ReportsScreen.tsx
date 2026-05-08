import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { reportsService } from '../../services/reportsService';
import type { InternalReportsSummary } from '../../lib/internalOpsApi';

const formatCurrency = (value: number) => `Rs ${Number(value ?? 0).toFixed(2)}`;
type ReportsDatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

const EMPTY_RECONCILIATION: NonNullable<InternalReportsSummary['reconciliation']> = {
  summary: {
    initiatedOlderThan15Minutes: 0,
    pendingActionOlderThan15Minutes: 0,
    failed: 0,
    cancelled: 0,
    orphaned: 0,
    succeededWithoutOrder: 0,
    paidOrderMissingOrderPayment: 0,
  },
  anomalies: [],
};

const EMPTY_NOTIFICATION_OBSERVABILITY: NonNullable<InternalReportsSummary['notifications']> = {
  summary: {
    failedReceiptDeliveries: 0,
    failedNotificationEvents: 0,
    notDeliveredNotificationEvents: 0,
    sentNotificationEvents: 0,
  },
  anomalies: [],
};

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? '');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsvContent(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const content = buildCsvContent(rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugifyFilenamePart(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'unknown';
}

function formatDateForFilename(value: string | null | undefined) {
  if (!value) return 'unknown-date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unknown-date';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateRangeForFilename(from: string | null | undefined, to: string | null | undefined) {
  const fromLabel = formatDateForFilename(from);
  const toLabel = formatDateForFilename(to);
  return fromLabel === toLabel ? fromLabel : `${fromLabel}_to_${toLabel}`;
}

function formatStoreForFilename(storeName: string | null | undefined, isAllStores: boolean) {
  if (isAllStores) return 'all-stores';
  return slugifyFilenamePart(storeName);
}

function buildReportFilename(
  type: 'summary' | 'items' | 'payments' | 'store_summary',
  from: string | null | undefined,
  to: string | null | undefined,
  storeName: string | null | undefined,
  isAllStores: boolean,
) {
  const rangePart = formatDateRangeForFilename(from, to);
  const storePart = formatStoreForFilename(storeName, isAllStores);
  return `cultiv_${type}_${rangePart}_${storePart}.csv`;
}

function parseDateInputAsLocalDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const parsed = new Date(year, monthIndex, day);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== monthIndex
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatReconciliationAnomalyLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatNotificationPurposeLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function toDateInputValue(date: Date) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 10);
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeekMonday(date: Date) {
  const next = startOfLocalDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date) {
  const next = startOfLocalDay(date);
  next.setDate(1);
  return next;
}

function buildDateRange(params: {
  preset: ReportsDatePreset;
  customFrom: string;
  customTo: string;
}) {
  const now = new Date();

  if (params.preset === 'today') {
    const from = startOfLocalDay(now);
    const to = endOfLocalDay(now);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'Today',
      preset: params.preset,
    } as const;
  }

  if (params.preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const from = startOfLocalDay(yesterday);
    const to = endOfLocalDay(yesterday);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'Yesterday',
      preset: params.preset,
    } as const;
  }

  if (params.preset === 'this_week') {
    const from = startOfWeekMonday(now);
    const to = endOfLocalDay(now);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'This week',
      preset: params.preset,
    } as const;
  }

  if (params.preset === 'this_month') {
    const from = startOfMonth(now);
    const to = endOfLocalDay(now);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'This month',
      preset: params.preset,
    } as const;
  }

  if (!params.customFrom || !params.customTo) {
    return null;
  }

  const fromDate = parseDateInputAsLocalDate(params.customFrom);
  const toDate = parseDateInputAsLocalDate(params.customTo);

  if (!fromDate || !toDate) {
    return null;
  }

  const from = startOfLocalDay(fromDate);
  const to = endOfLocalDay(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return null;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: `${formatDateLabel(from.toISOString())} - ${formatDateLabel(to.toISOString())}`,
    preset: params.preset,
  } as const;
}

function buildCsvMetadataRows(params: {
  reportName: string;
  rangeLabel: string;
  storeLabel: string;
}) {
  return [
    ['Report Name', params.reportName],
    ['Selected Date Range', params.rangeLabel],
    ['Selected Store', params.storeLabel],
    ['Generated At', new Date().toLocaleString('en-IN')],
    [],
  ];
}

export function ReportsScreen() {
  const { session, permissions, activeStoreUuid, activeStore, stores } = useAdminDashboard();
  const [summary, setSummary] = useState<InternalReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<ReportsDatePreset>('today');
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));

  const selectedDateRange = useMemo(
    () => buildDateRange({ preset: datePreset, customFrom, customTo }),
    [customFrom, customTo, datePreset],
  );

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

    if (!selectedDateRange) {
      setSummary(null);
      setIsLoading(false);
      setError('Choose a valid custom date range.');
      return () => {
        active = false;
      };
    }

    void reportsService.loadDashboard(session, {
      storeId: activeStoreUuid ?? undefined,
      dateRange: selectedDateRange,
    })
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
  }, [activeStoreUuid, permissions.canViewReports, selectedDateRange, session]);

  const storeRows = useMemo(() => {
    if (!summary) return [];

    const fallbackNameById = new Map(stores.map((store) => [store.id, store.name]));
    return summary.storeSalesSummary.map((entry) => ({
      id: entry.storeId,
      name: entry.storeName || fallbackNameById.get(entry.storeId) || 'Unknown store',
      orders: entry.orderCount,
      revenue: entry.revenue,
      tax: entry.tax,
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
    })).sort((left, right) => right.amount - left.amount || right.count - left.count);
  }, [summary]);

  const selectedStoreLabel = activeStore?.name ?? 'All stores';
  const isAllStores = !activeStore;
  const reconciliation = summary?.reconciliation ?? EMPTY_RECONCILIATION;
  const reconciliationRows = reconciliation.anomalies;
  const notificationObservability = summary?.notifications ?? EMPTY_NOTIFICATION_OBSERVABILITY;
  const notificationRows = notificationObservability.anomalies;

  const exportSummaryCsv = () => {
    if (!summary) return;
    downloadCsvFile(
      buildReportFilename('summary', summary.rangeFrom, summary.rangeTo, selectedStoreLabel, isAllStores),
      [
        ...buildCsvMetadataRows({
          reportName: 'Daily Summary Report',
          rangeLabel: summary.rangeLabel,
          storeLabel: selectedStoreLabel,
        }),
        ['Metric', 'Value'],
        ['Revenue', summary.totalRevenue],
        ['Orders', summary.totalOrders],
        ['Average Ticket', summary.averageTicket],
        ['Tax', summary.totalTax],
      ],
    );
  };

  const exportItemSalesCsv = () => {
    if (!summary) return;
    downloadCsvFile(
      buildReportFilename('items', summary.rangeFrom, summary.rangeTo, selectedStoreLabel, isAllStores),
      [
        ...buildCsvMetadataRows({
          reportName: 'Item Sales Report',
          rangeLabel: summary.rangeLabel,
          storeLabel: selectedStoreLabel,
        }),
        ['Item Name', 'Quantity Sold', 'Revenue'],
        ...summary.itemSalesSummary.map((entry) => [entry.itemName, entry.quantity, entry.revenue]),
      ],
    );
  };

  const exportPaymentMethodsCsv = () => {
    if (!summary) return;
    downloadCsvFile(
      buildReportFilename('payments', summary.rangeFrom, summary.rangeTo, selectedStoreLabel, isAllStores),
      [
        ...buildCsvMetadataRows({
          reportName: 'Payment Method Split Report',
          rangeLabel: summary.rangeLabel,
          storeLabel: selectedStoreLabel,
        }),
        ['Payment Method', 'Payment Count', 'Amount'],
        ...paymentMethodRows.map((entry) => [entry.paymentMethod, entry.count, entry.amount]),
      ],
    );
  };

  const exportStoreSummaryCsv = () => {
    if (!summary) return;
    downloadCsvFile(
      buildReportFilename('store_summary', summary.rangeFrom, summary.rangeTo, selectedStoreLabel, isAllStores),
      [
        ...buildCsvMetadataRows({
          reportName: 'Store Summary Report',
          rangeLabel: summary.rangeLabel,
          storeLabel: selectedStoreLabel,
        }),
        ['Store', 'Orders', 'Revenue', 'Tax'],
        ...storeRows.map((entry) => [entry.name, entry.orders, entry.revenue, entry.tax]),
      ],
    );
  };

  const exportReconciliationCsv = () => {
    if (!summary) return;
    downloadCsvFile(
      buildReportFilename('payments', summary.rangeFrom, summary.rangeTo, `${selectedStoreLabel}_reconciliation`, isAllStores),
      [
        ...buildCsvMetadataRows({
          reportName: 'Payment Reconciliation Report',
          rangeLabel: summary.rangeLabel,
          storeLabel: selectedStoreLabel,
        }),
        ['Anomaly Type', 'Payment ID', 'Status', 'Store', 'Store ID', 'Amount', 'Gateway', 'Gateway Order ID', 'Gateway Payment ID', 'Order ID', 'Failure Message', 'Created At', 'Updated At'],
        ...reconciliationRows.map((entry) => [
          entry.anomalyType,
          entry.paymentId,
          entry.status,
          entry.storeName,
          entry.storeId,
          entry.amount,
          entry.gateway,
          entry.gatewayOrderId,
          entry.gatewayPaymentId,
          entry.orderId,
          entry.failureMessage,
          entry.createdAt,
          entry.updatedAt,
        ]),
      ],
    );
  };

  if (!permissions.canViewReports) {
    return <Navigate to="/operations/summary" replace />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reports"
        title="Operations performance"
        description="Backend-authoritative sales, channel mix, payment, item, and store reporting for the selected date range."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{selectedStoreLabel}</div>
            {summary ? (
              <>
                <button
                  type="button"
                  onClick={exportSummaryCsv}
                  className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 transition hover:bg-primary/5"
                >
                  Export Summary CSV
                </button>
                <button
                  type="button"
                  onClick={exportItemSalesCsv}
                  className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 transition hover:bg-primary/5"
                >
                  Export Item CSV
                </button>
                <button
                  type="button"
                  onClick={exportPaymentMethodsCsv}
                  className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 transition hover:bg-primary/5"
                >
                  Export Payment CSV
                </button>
                <button
                  type="button"
                  onClick={exportStoreSummaryCsv}
                  className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 transition hover:bg-primary/5"
                >
                  Export Store CSV
                </button>
                <button
                  type="button"
                  onClick={exportReconciliationCsv}
                  className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 transition hover:bg-primary/5"
                >
                  Export Reconciliation CSV
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ['today', 'Today'],
              ['yesterday', 'Yesterday'],
              ['this_week', 'This week'],
              ['this_month', 'This month'],
              ['custom', 'Custom'],
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-medium transition',
                  datePreset === preset
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-primary/16 bg-white text-foreground/72 hover:bg-primary/5',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm text-foreground/64">
            <span className="font-medium text-foreground/76">
              Selected range: {selectedDateRange?.label ?? 'Invalid range'}
            </span>
            {summary?.rangeFrom && summary?.rangeTo ? (
              <span>
                {formatDateLabel(summary.rangeFrom)} - {formatDateLabel(summary.rangeTo)}
              </span>
            ) : null}
          </div>
        </div>

        {datePreset === 'custom' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-foreground/72">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-foreground/52">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="min-h-[42px] w-full rounded-2xl border border-primary/14 bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
              />
            </label>
            <label className="text-sm text-foreground/72">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-foreground/52">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="min-h-[42px] w-full rounded-2xl border border-primary/14 bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
              />
            </label>
          </div>
        ) : null}
      </section>

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-primary/12 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.totalRevenue)}</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">GST / Tax</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.totalTax)}</p>
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
                    <div>
                      <span className="font-medium capitalize text-foreground">{entry.paymentMethod}</span>
                      <p className="mt-1 text-sm text-foreground/60">{entry.count} payments</p>
                    </div>
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

          <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">Payment Reconciliation</p>
                <p className="mt-1 text-sm text-foreground/60">Read-only visibility into customer checkout payment attempts that may need support review.</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-3 py-2 text-xs text-foreground/64">
                {reconciliationRows.length} anomaly row{reconciliationRows.length === 1 ? '' : 's'} in range
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Stale initiated</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{reconciliation.summary.initiatedOlderThan15Minutes}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Stale pending action</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{reconciliation.summary.pendingActionOlderThan15Minutes}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Failed / Cancelled</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{reconciliation.summary.failed + reconciliation.summary.cancelled}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Escalate now</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {reconciliation.summary.orphaned + reconciliation.summary.succeededWithoutOrder + reconciliation.summary.paidOrderMissingOrderPayment}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-primary/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Failed</p>
                <p className="mt-1 text-base font-semibold text-foreground">{reconciliation.summary.failed}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Cancelled</p>
                <p className="mt-1 text-base font-semibold text-foreground">{reconciliation.summary.cancelled}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Orphaned</p>
                <p className="mt-1 text-base font-semibold text-foreground">{reconciliation.summary.orphaned}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Succeeded without order</p>
                <p className="mt-1 text-base font-semibold text-foreground">{reconciliation.summary.succeededWithoutOrder}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Paid order missing payment row</p>
                <p className="mt-1 text-base font-semibold text-foreground">{reconciliation.summary.paidOrderMissingOrderPayment}</p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-[20px] border border-primary/10">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[1.25fr_1.35fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
                  <p>Anomaly</p>
                  <p>Payment</p>
                  <p>Store</p>
                  <p>Amount</p>
                  <p>Gateway</p>
                  <p>Order Ref</p>
                  <p>Payment Ref</p>
                  <p>Order</p>
                  <p>Updated</p>
                </div>
                <div className="divide-y divide-primary/8">
                  {reconciliationRows.length > 0 ? reconciliationRows.map((entry) => (
                    <div key={`${entry.paymentId}-${entry.anomalyType}`} className="grid grid-cols-[1.25fr_1.35fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1.2fr] gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium capitalize text-foreground">{formatReconciliationAnomalyLabel(entry.anomalyType)}</p>
                        <p className="mt-1 text-xs text-foreground/56">{entry.status || 'unknown'}</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-foreground">{entry.paymentId}</p>
                        {entry.failureMessage ? (
                          <p className="mt-1 text-xs text-rose-700">{entry.failureMessage}</p>
                        ) : (
                          <p className="mt-1 text-xs text-foreground/56">Created {formatDateTimeLabel(entry.createdAt)}</p>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{entry.storeName}</p>
                        <p className="mt-1 font-mono text-xs text-foreground/56">{entry.storeId}</p>
                      </div>
                      <p className="font-semibold text-foreground">{formatCurrency(entry.amount)}</p>
                      <p className="capitalize text-foreground/72">{entry.gateway || 'unknown'}</p>
                      <p className="font-mono text-xs text-foreground/72">{entry.gatewayOrderId ?? '—'}</p>
                      <p className="font-mono text-xs text-foreground/72">{entry.gatewayPaymentId ?? '—'}</p>
                      <p className="font-mono text-xs text-foreground/72">{entry.orderId ?? '—'}</p>
                      <p className="text-xs text-foreground/62">{formatDateTimeLabel(entry.updatedAt)}</p>
                    </div>
                  )) : (
                    <div className="px-4 py-6 text-sm text-foreground/60">
                      No reconciliation anomalies found for the selected range.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">Receipt & Notification Observability</p>
                <p className="mt-1 text-sm text-foreground/60">Read-only delivery audit visibility for receipts, signup verification, and password reset preparation.</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-3 py-2 text-xs text-foreground/64">
                {notificationRows.length} anomaly row{notificationRows.length === 1 ? '' : 's'} in range
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Failed receipt deliveries</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{notificationObservability.summary.failedReceiptDeliveries}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Failed notification events</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{notificationObservability.summary.failedNotificationEvents}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Prepared / not delivered</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{notificationObservability.summary.notDeliveredNotificationEvents}</p>
              </div>
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/52">Sent notification events</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{notificationObservability.summary.sentNotificationEvents}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] border border-primary/10">
              <div className="max-h-[min(60vh,34rem)] overflow-auto">
                <div className="min-w-[1220px]">
                  <div className="grid grid-cols-[0.9fr_1fr_0.95fr_0.9fr_1.1fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
                    <p>Source</p>
                    <p>Purpose</p>
                    <p>Channel</p>
                  <p>Status</p>
                  <p>Store</p>
                  <p>Recipient</p>
                  <p>Provider</p>
                  <p>Order</p>
                  <p>Updated</p>
                </div>
                  <div className="divide-y divide-primary/8">
                    {notificationRows.length > 0 ? notificationRows.map((entry) => (
                      <div key={`${entry.source}-${entry.eventId}`} className="grid grid-cols-[0.9fr_1fr_0.95fr_0.9fr_1.1fr_1fr_1fr_1fr_1.2fr] gap-3 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium capitalize text-foreground">{entry.source.replace(/_/g, ' ')}</p>
                          <p className="mt-1 font-mono text-xs text-foreground/56">{entry.eventId}</p>
                        </div>
                        <div>
                          <p className="font-medium capitalize text-foreground">{formatNotificationPurposeLabel(entry.purpose)}</p>
                          {entry.errorMessage ? (
                            <p className="mt-1 text-xs text-rose-700">{entry.errorMessage}</p>
                          ) : (
                            <p className="mt-1 text-xs text-foreground/56">Created {formatDateTimeLabel(entry.createdAt)}</p>
                          )}
                        </div>
                        <p className="capitalize text-foreground/72">{entry.channel || 'unknown'}</p>
                        <p className="capitalize text-foreground/72">{entry.status || 'unknown'}</p>
                        <div>
                          <p className="font-medium text-foreground">{entry.storeName}</p>
                          <p className="mt-1 font-mono text-xs text-foreground/56">{entry.storeId ?? '—'}</p>
                        </div>
                        <p className="text-xs text-foreground/72">{entry.recipient ?? '—'}</p>
                        <p className="capitalize text-foreground/72">{entry.provider ?? '—'}</p>
                        <p className="font-mono text-xs text-foreground/72">{entry.orderId ?? '—'}</p>
                        <p className="text-xs text-foreground/62">{formatDateTimeLabel(entry.updatedAt)}</p>
                      </div>
                    )) : (
                      <div className="px-4 py-6 text-sm text-foreground/60">
                        No receipt or notification anomalies found for the selected range.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
                <p>Store</p>
                <p>Orders</p>
                <p>Revenue</p>
                <p>Tax</p>
              </div>
              <div className="divide-y divide-primary/8">
                {storeRows.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-3">
                    <p className="font-medium text-foreground">{entry.name}</p>
                    <p className="text-sm text-foreground/66">{entry.orders}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(entry.revenue)}</p>
                    <p className="text-sm text-foreground/66">{formatCurrency(entry.tax)}</p>
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
