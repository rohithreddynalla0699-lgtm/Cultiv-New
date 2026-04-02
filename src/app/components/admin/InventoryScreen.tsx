import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { StatusBadge } from './StatusBadge';
import { Navigate } from 'react-router-dom';

type InventoryStatusFilter = 'all' | 'low_stock' | 'out_of_stock';

export function InventoryScreen() {
  const { touchActivity } = useStoreSession();
  const {
    scopedInventory,
    addInventoryStock,
    reduceInventoryStock,
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

  const applyAdjustment = (itemId: string) => {
    void touchActivity();
    if (adjustValue > 0) {
      addInventoryStock(itemId, adjustValue);
    } else if (adjustValue < 0) {
      reduceInventoryStock(itemId, Math.abs(adjustValue));
    }
    setAdjustingItemId(null);
    setAdjustValue(0);
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
        description="Simple counts for ingredients, drinks, and packaging with fast action controls."
        action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore?.name ?? 'All stores'}</div>}
      />

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
          <p className="rounded-full bg-[#F7FAF3] px-3 py-1.5 text-xs font-medium text-foreground/62">Action required: {lowStockItems.length}</p>
        </div>
        {lowStockItems.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/64">No low stock items right now.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lowStockItems.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 ${item.status === 'out_of_stock' ? 'border-[#E7B5B5] bg-[#FFF4F4]' : 'border-[#E9D0A0] bg-[#FFF9F0]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-foreground/62">{item.quantity} {item.unit} · Threshold {item.threshold}{activeStoreScope === 'all' ? ` · ${getStoreName(item.storeId)}` : ''}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[1, 5, 10, 20].map((value) => (
                    <button key={value} type="button" onClick={() => addInventoryStock(item.id, value)} className="rounded-xl border border-primary/16 bg-white px-2 py-2 text-sm font-medium text-foreground/74">+{value}</button>
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
                      <button type="button" onClick={() => applyAdjustment(item.id)} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Apply</button>
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

        {visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 text-sm text-foreground/64">No inventory items match your current filters.</div>
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
            <div className="min-w-[980px]">
            <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.7fr_0.9fr_1.2fr_1.2fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52 lg:grid">
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
                <div key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1.5fr_1fr_0.8fr_0.7fr_0.9fr_1.2fr_1.2fr] lg:items-center">
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
                    <button data-testid={`inventory-add-${item.id}`} type="button" onClick={() => addInventoryStock(item.id, 1)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">Add</button>
                    <button type="button" onClick={() => reduceInventoryStock(item.id, 1)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">Reduce</button>
                    <button data-testid={`inventory-out-${item.id}`} type="button" onClick={() => markInventoryOutOfStock(item.id)} className="rounded-lg border border-[#E7B5B5] bg-[#FFF4F4] px-2.5 py-1.5 text-xs font-medium text-[#8B2E2E]">Out</button>
                    <button type="button" onClick={() => {
                      const currentThreshold = item.threshold;
                      const nextValue = window.prompt(`Set threshold for ${item.name}`, String(currentThreshold));
                      if (!nextValue) return;
                      const parsed = Number(nextValue);
                      if (Number.isFinite(parsed) && parsed >= 0) {
                        updateInventoryThreshold(item.id, parsed);
                      }
                    }} className="text-xs font-medium text-primary hover:underline">Threshold</button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}