import type { OrdersBoardDateFilter, OrdersBoardOrderTypeFilter } from '../../../types/ordersBoard';
import type { StoreRecord } from '../../../types/admin';

interface OrdersBoardHeaderProps {
  activeStoreScope: string;
  stores: StoreRecord[];
  canSwitchStoreScope: boolean;
  orderType: OrdersBoardOrderTypeFilter;
  dateFilter: OrdersBoardDateFilter;
  customDate: string;
  searchQuery: string;
  lastSyncLabel: string;
  onChangeStore: (nextStoreId: string) => void;
  onChangeOrderType: (nextType: OrdersBoardOrderTypeFilter) => void;
  onChangeDateFilter: (nextDateFilter: OrdersBoardDateFilter) => void;
  onChangeCustomDate: (nextDate: string) => void;
  onChangeSearchQuery: (nextSearch: string) => void;
}

const ORDER_TYPE_TABS: Array<{ value: OrdersBoardOrderTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'counter', label: 'Counter' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
];

const DATE_TABS: Array<{ value: OrdersBoardDateFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'custom', label: 'Custom' },
];

export function OrdersBoardHeader({
  activeStoreScope,
  stores,
  canSwitchStoreScope,
  orderType,
  dateFilter,
  customDate,
  searchQuery,
  lastSyncLabel,
  onChangeStore,
  onChangeOrderType,
  onChangeDateFilter,
  onChangeCustomDate,
  onChangeSearchQuery,
}: OrdersBoardHeaderProps) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Orders Board</h2>
          <p className="text-sm text-foreground/60">Fast-moving assembly line workflow across all order sources.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live · {lastSyncLabel}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_180px_260px]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Store</label>
          <select
            value={activeStoreScope}
            onChange={(event) => onChangeStore(event.target.value)}
            disabled={!canSwitchStoreScope}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-55"
          >
            <option value="all">All Stores</option>
            {stores.filter((store) => store.isActive).map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Order Type</p>
          <div className="flex flex-wrap gap-2">
            {ORDER_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onChangeOrderType(tab.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${orderType === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70 hover:bg-muted/75'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Date</p>
          <div className="flex flex-wrap gap-2">
            {DATE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onChangeDateFilter(tab.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${dateFilter === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70 hover:bg-muted/75'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {dateFilter === 'custom' ? (
            <input
              type="date"
              value={customDate}
              onChange={(event) => onChangeCustomDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Search</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onChangeSearchQuery(event.target.value)}
            placeholder="Order ID, customer, phone"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>
    </section>
  );
}
