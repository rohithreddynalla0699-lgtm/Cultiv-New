import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';

type InventoryStatusFilter = 'all' | 'low_stock' | 'out_of_stock';

const formatAdjustmentLabel = (value: string) => {
  switch (value) {
    case 'threshold_update':
      return 'Threshold';
    case 'manual_correction':
      return 'Manual correction';
    case 'out_of_stock':
      return 'Marked out';
    default:
      return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
};

const formatSignedValue = (value: number) => {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return '0';
};

export function InventoryScreen() {
  const { touchActivity } = useStoreSession();
  const {
    scopedInventory,
    inventoryHistory,
    inventoryLoading,
    inventoryError,
    refreshInventory,
    addInventoryStock,
    reduceInventoryStock,
    setInventoryQuantity,
    updateInventoryThreshold,
    markInventoryOutOfStock,
    activeStoreScope,
    activeStore,
    getStoreName,
    permissions,
  } = useAdminDashboard();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

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

  useEffect(() => {
    if (!inventoryError) return;
    setFeedback({ tone: 'error', text: inventoryError });
  }, [inventoryError]);

  const categories = useMemo(() => ['all', ...new Set(scopedInventory.map((item) => item.category))], [scopedInventory]);

  const lowStockItems = useMemo(
    () => scopedInventory
      .filter((item) => item.status === 'low_stock' || item.status === 'out_of_stock')
      .sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        if (a.status === 'out_of_stock') return -1;
        if (b.status === 'out_of_stock') return 1;
        return 0;
      }),
    [scopedInventory],
  );

  const visibleItems = useMemo(() => scopedInventory.filter((item) => {
    const query = searchValue.toLowerCase().trim();
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  }), [categoryFilter, scopedInventory, searchValue, statusFilter]);

  const recentHistory = useMemo(() => inventoryHistory.slice(0, 10), [inventoryHistory]);

  const runAction = async (itemId: string, action: () => Promise<{ success: boolean; message: string }>) => {
    void touchActivity();
    setPendingItemId(itemId);
    const result = await action();
    setPendingItemId(null);
    setFeedback({ tone: result.success ? 'success' : 'error', text: result.message });
  };

  const applyAdjustment = async (itemId: string) => {
    if (adjustValue > 0) {
      await runAction(itemId, () => addInventoryStock(itemId, adjustValue));
    } else if (adjustValue < 0) {
      await runAction(itemId, () => reduceInventoryStock(itemId, Math.abs(adjustValue)));
    } else {
      setFeedback({ tone: 'info', text: 'Enter a positive or negative adjustment first.' });
    }

    setAdjustingItemId(null);
    setAdjustValue(0);
  };

  const promptAndSetThreshold = async (itemId: string, itemName: string, currentThreshold: number) => {
    const nextValue = window.prompt(`Set threshold for ${itemName}`, String(currentThreshold));
    if (nextValue == null || nextValue.trim() === '') return;
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFeedback({ tone: 'error', text: 'Threshold must be a non-negative number.' });
      return;
    }
    await runAction(itemId, () => updateInventoryThreshold(itemId, parsed));
  };

  const promptAndSetQuantity = async (itemId: string, itemName: string, currentQuantity: number) => {
    const nextValue = window.prompt(`Set quantity for ${itemName}`, String(currentQuantity));
    if (nextValue == null || nextValue.trim() === '') return;
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFeedback({ tone: 'error', text: 'Quantity must be a non-negative number.' });
      return;
    }
    await runAction(itemId, () => setInventoryQuantity(itemId, parsed));
  };

  const formatUpdatedAt = (updatedAt: string) => new Date(updatedAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!permissions.canAccessInventory) {
    return <Navigate to="/operations" replace />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory"
        title="Keep the line stocked without clutter."
        description="Manual counts now sync to the backend and keep an audit trail for every adjustment."
        action={(
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">
              {activeStore?.name ?? 'All stores'}
            </div>
            <button
              type="button"
              onClick={() => { void refreshInventory(); }}
              className="rounded-full border border-primary/12 bg-white/88 px-4 py-2 text-sm font-medium text-foreground/72"
            >
              Refresh
            </button>
          </div>
        )}
      />

      {feedback ? (
        <div className={`rounded-[22px] border px-4 py-3 text-sm ${
          feedback.tone === 'error'
            ? 'border-[#E7B5B5] bg-[#FFF4F4] text-[#8B2E2E]'
            : feedback.tone === 'success'
              ? 'border-primary/14 bg-[#F7FAF3] text-foreground/72'
              : 'border-primary/12 bg-white/90 text-foreground/72'
        }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search inventory"
          className="w-full rounded-2xl border border-primary/12 bg-white/88 px-4 py-3 text-sm outline-none md:max-w-sm"
          data-testid="inventory-search"
        />

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'low_stock', label: 'Low Stock' },
              { key: 'out_of_stock', label: 'Out of Stock' },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${statusFilter === option.key ? 'bg-primary text-primary-foreground' : 'bg-white/85 text-foreground/70'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground/70" htmlFor="inventory-category-filter">Category</label>
            <select
              id="inventory-category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-2xl border border-primary/12 bg-white/88 px-4 py-2.5 text-sm outline-none"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">Low Stock Action Queue</p>
          <p className="rounded-full bg-[#F7FAF3] px-3 py-1.5 text-xs font-medium text-foreground/62">
            {inventoryLoading ? 'Syncing inventory...' : `Action required: ${lowStockItems.length}`}
          </p>
        </div>
        {inventoryLoading && scopedInventory.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/64">Loading live inventory…</div>
        ) : lowStockItems.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/64">No low stock items right now.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lowStockItems.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 ${item.status === 'out_of_stock' ? 'border-[#E7B5B5] bg-[#FFF4F4]' : 'border-[#E9D0A0] bg-[#FFF9F0]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-foreground/62">
                      {item.quantity} {item.unit} · Threshold {item.threshold}
                      {activeStoreScope === 'all' ? ` · ${getStoreName(item.storeId)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[1, 5, 10, 20].map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={pendingItemId === item.id}
                      onClick={() => { void runAction(item.id, () => addInventoryStock(item.id, value)); }}
                      className="rounded-xl border border-primary/16 bg-white px-2 py-2 text-sm font-medium text-foreground/74 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      +{value}
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  {adjustingItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={adjustValue}
                        onChange={(event) => setAdjustValue(Number(event.target.value))}
                        className="w-full rounded-xl border border-primary/12 bg-white px-3 py-2 text-sm outline-none"
                        placeholder="Use + for add, - for reduce"
                      />
                      <button type="button" onClick={() => { void applyAdjustment(item.id); }} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Apply</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setAdjustingItemId(item.id); setAdjustValue(0); }} className="text-sm font-medium text-primary hover:underline">Adjust</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">All Inventory Items</p>
          <p className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">Showing {visibleItems.length}</p>
        </div>

        {inventoryLoading && visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 text-sm text-foreground/64">Loading backend inventory…</div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 text-sm text-foreground/64">No inventory items match your current filters.</div>
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
            <div className="min-w-[1060px]">
              <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.7fr_0.9fr_1.2fr_1.4fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52 lg:grid">
                <p>Item</p>
                <p>Category</p>
                <p>Quantity</p>
                <p>Unit</p>
                <p>Status</p>
                <p>Last Updated</p>
                <p>Actions</p>
              </div>

              <div className="divide-y divide-primary/8">
                {visibleItems.map((item) => (
                  <div key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1.5fr_1fr_0.8fr_0.7fr_0.9fr_1.2fr_1.4fr] lg:items-center">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      {activeStoreScope === 'all' ? <p className="text-xs text-foreground/54">{getStoreName(item.storeId)}</p> : null}
                    </div>
                    <p className="text-sm text-foreground/66">{item.category}</p>
                    <p className="text-sm font-medium text-foreground">{item.quantity}</p>
                    <p className="text-sm text-foreground/66">{item.unit}</p>
                    <div><StatusBadge status={item.status} /></div>
                    <p className="text-sm text-foreground/62">{formatUpdatedAt(item.updatedAt)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        data-testid={`inventory-add-${item.id}`}
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => { void runAction(item.id, () => addInventoryStock(item.id, 1)); }}
                        className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => { void runAction(item.id, () => reduceInventoryStock(item.id, 1)); }}
                        className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Reduce
                      </button>
                      <button
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => { void promptAndSetQuantity(item.id, item.name, item.quantity); }}
                        className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Set
                      </button>
                      <button
                        data-testid={`inventory-out-${item.id}`}
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => { void runAction(item.id, () => markInventoryOutOfStock(item.id)); }}
                        className="rounded-lg border border-[#E7B5B5] bg-[#FFF4F4] px-2.5 py-1.5 text-xs font-medium text-[#8B2E2E] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Out
                      </button>
                      <button
                        type="button"
                        disabled={pendingItemId === item.id}
                        onClick={() => { void promptAndSetThreshold(item.id, item.name, item.threshold); }}
                        className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Threshold
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-primary/12 bg-white/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">Recent Inventory History</p>
          <p className="rounded-full bg-[#F7FAF3] px-3 py-1.5 text-xs font-medium text-foreground/62">
            Showing {recentHistory.length}
          </p>
        </div>

        {recentHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/64">No inventory adjustments recorded yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentHistory.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {entry.itemName}
                      <span className="ml-2 text-xs font-medium text-foreground/48">({entry.itemCode})</span>
                    </p>
                    <p className="mt-1 text-xs text-foreground/58">
                      {formatAdjustmentLabel(entry.adjustmentType)} · {formatSignedValue(entry.quantityDelta)} · Before {entry.quantityBefore} · After {entry.quantityAfter}
                      {entry.storeName ? ` · ${entry.storeName}` : ` · ${getStoreName(entry.storeId)}`}
                    </p>
                    {entry.adjustmentType === 'threshold_update' ? (
                      <p className="mt-1 text-xs text-foreground/52">
                        Threshold {entry.thresholdBefore ?? 0} to {entry.thresholdAfter ?? 0}
                      </p>
                    ) : null}
                    {entry.notes ? <p className="mt-1 text-xs text-foreground/52">{entry.notes}</p> : null}
                  </div>
                  <div className="text-xs text-foreground/54">
                    <p>{formatUpdatedAt(entry.createdAt)}</p>
                    {entry.actorName ? <p className="mt-1">{entry.actorName}</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
