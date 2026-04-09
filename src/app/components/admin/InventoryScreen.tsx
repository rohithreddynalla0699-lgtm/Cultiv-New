import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { Modal } from '../Modal';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';

type InventoryStatusFilter = 'all' | 'low_stock' | 'out_of_stock';

type FeedbackTone = 'success' | 'error' | 'info';

const INVENTORY_CATEGORY_OPTIONS = [
  { value: 'rice', label: 'Rice' },
  { value: 'proteins', label: 'Proteins' },
  { value: 'veggies', label: 'Veggies' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'packaging', label: 'Packaging' },
] as const;

const EMPTY_NEW_ITEM_FORM = {
  name: '',
  category: 'rice',
  unit: '',
  threshold: '',
  initialQuantity: '',
};

const surfaceClassByTone: Record<FeedbackTone, string> = {
  error: 'border-[#E7B5B5] bg-[#FFF4F4] text-[#8B2E2E]',
  success: 'border-primary/14 bg-[#F7FAF3] text-foreground/72',
  info: 'border-primary/12 bg-white/90 text-foreground/72',
};

const sanitizeDecimalInput = (value: string) => {
  const sanitized = value.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = sanitized.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

const parsePositiveNumber = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

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
    createInventoryItem,
    archiveInventoryItem,
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
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState(EMPTY_NEW_ITEM_FORM);

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

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

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

  const runAction = async (actionKey: string, action: () => Promise<{ success: boolean; message: string }>) => {
    void touchActivity();
    setPendingActionKey(actionKey);
    const result = await action();
    setPendingActionKey(null);
    setFeedback({ tone: result.success ? 'success' : 'error', text: result.message });
    return result;
  };

  const getEnteredQuantity = (itemId: string) => quantityInputs[itemId] ?? '';

  const handleEnteredQuantityChange = (itemId: string, value: string) => {
    setQuantityInputs((previous) => ({
      ...previous,
      [itemId]: sanitizeDecimalInput(value),
    }));
  };

  const handleDirectQuantityAction = async (itemId: string, mode: 'add' | 'reduce' | 'set') => {
    const rawValue = getEnteredQuantity(itemId);
    const parsed = parsePositiveNumber(rawValue);

    if (parsed == null) {
      setFeedback({ tone: 'error', text: 'Enter a positive quantity before applying that action.' });
      return;
    }

    const actionMap = {
      add: () => addInventoryStock(itemId, parsed),
      reduce: () => reduceInventoryStock(itemId, parsed),
      set: () => setInventoryQuantity(itemId, parsed),
    };

    const result = await runAction(`${itemId}:${mode}`, actionMap[mode]);
    if (result.success) {
      setQuantityInputs((previous) => ({
        ...previous,
        [itemId]: '',
      }));
    }
  };

  const promptAndSetThreshold = async (itemId: string, itemName: string, currentThreshold: number) => {
    const nextValue = window.prompt(`Set threshold for ${itemName}`, String(currentThreshold));
    if (nextValue == null || nextValue.trim() === '') return;
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFeedback({ tone: 'error', text: 'Threshold must be a non-negative number.' });
      return;
    }
    await runAction(`${itemId}:threshold`, () => updateInventoryThreshold(itemId, parsed));
  };

  const handleArchive = async (inventoryItemId: string, itemName: string) => {
    const confirmed = window.confirm(`Archive ${itemName}? It will be hidden from operations screens, but inventory history stays intact.`);
    if (!confirmed) return;

    await runAction(`${inventoryItemId}:archive`, () => archiveInventoryItem(inventoryItemId));
  };

  const handleCreateInventoryItem = async () => {
    if (!newItemForm.name.trim()) {
      setFeedback({ tone: 'error', text: 'Inventory item name is required.' });
      return;
    }

    if (!newItemForm.unit.trim()) {
      setFeedback({ tone: 'error', text: 'Unit is required.' });
      return;
    }

    const threshold = Number(newItemForm.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      setFeedback({ tone: 'error', text: 'Threshold must be a non-negative number.' });
      return;
    }

    const initialQuantity = newItemForm.initialQuantity.trim() === ''
      ? 0
      : Number(newItemForm.initialQuantity);

    if (!Number.isFinite(initialQuantity) || initialQuantity < 0) {
      setFeedback({ tone: 'error', text: 'Initial quantity must be a non-negative number.' });
      return;
    }

    const result = await runAction('create-inventory-item', () => createInventoryItem({
      name: newItemForm.name,
      category: newItemForm.category,
      unit: newItemForm.unit,
      threshold,
      initialQuantity,
    }));

    if (result.success) {
      setIsAddModalOpen(false);
      setNewItemForm(EMPTY_NEW_ITEM_FORM);
    }
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

  const canCreateItem = activeStoreScope !== 'all' && Boolean(activeStore);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory"
        title="Keep the line stocked without clutter."
        description="Manual counts stay backend-authoritative, and faster row controls make large adjustments much easier to enter."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">
              {activeStore?.name ?? 'All stores'}
            </div>
            <button
              type="button"
              onClick={() => { void refreshInventory(); }}
              className="cursor-pointer rounded-full border border-primary/12 bg-white/88 px-4 py-2 text-sm font-medium text-foreground/72 transition hover:border-primary/18 hover:bg-white"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={!canCreateItem}
              onClick={() => setIsAddModalOpen(true)}
              className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              title={canCreateItem ? 'Add inventory item' : 'Select a specific store to add inventory'}
            >
              Add Inventory Item
            </button>
          </div>
        )}
      />

      <AnimatePresence mode="wait">
        {feedback ? (
          <motion.div
            key={`${feedback.tone}:${feedback.text}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`rounded-[22px] border px-4 py-3 text-sm shadow-[0_16px_34px_rgba(28,45,14,0.07)] ${surfaceClassByTone[feedback.tone]}`}
          >
            {feedback.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search inventory"
          className="w-full rounded-2xl border border-primary/12 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-primary/24 md:max-w-sm"
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
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                  statusFilter === option.key
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(45,80,22,0.18)]'
                    : 'bg-white/85 text-foreground/70 hover:bg-white'
                }`}
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
              className="cursor-pointer rounded-2xl border border-primary/12 bg-white/88 px-4 py-2.5 text-sm outline-none transition focus:border-primary/24"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      <motion.section
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.03 }}
        className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]"
      >
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
            {lowStockItems.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.03 }}
                className={`rounded-2xl border p-4 ${item.status === 'out_of_stock' ? 'border-[#E7B5B5] bg-[#FFF4F4]' : 'border-[#E9D0A0] bg-[#FFF9F0]'}`}
              >
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
                      disabled={pendingActionKey === `${item.id}:quick-add-${value}`}
                      onClick={() => { void runAction(`${item.id}:quick-add-${value}`, () => addInventoryStock(item.id, value)); }}
                      className="cursor-pointer rounded-xl border border-primary/16 bg-white px-2 py-2 text-sm font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      +{value}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void promptAndSetThreshold(item.id, item.name, item.threshold); }}
                    disabled={pendingActionKey === `${item.id}:threshold`}
                    className="cursor-pointer text-sm font-medium text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Threshold
                  </button>
                  <button
                    type="button"
                    onClick={() => { void runAction(`${item.id}:out`, () => markInventoryOutOfStock(item.id)); }}
                    disabled={pendingActionKey === `${item.id}:out`}
                    className="cursor-pointer text-sm font-medium text-[#8B2E2E] transition hover:text-[#6e2020] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Mark out
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.06 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">All Inventory Items</p>
          <p className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">Showing {visibleItems.length}</p>
        </div>

        {inventoryLoading && visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 text-sm text-foreground/64">Loading backend inventory…</div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 text-sm text-foreground/64">No inventory items match your current filters.</div>
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90 shadow-[0_16px_34px_rgba(28,45,14,0.06)]">
            <div className="min-w-[1280px]">
              <div className="hidden grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr_2.1fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52 lg:grid">
                <p>Item</p>
                <p>Category</p>
                <p>Quantity</p>
                <p>Unit</p>
                <p>Status</p>
                <p>Last Updated</p>
                <p>Actions</p>
              </div>

              <div className="divide-y divide-primary/8">
                {visibleItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.01 }}
                    className="grid gap-3 px-4 py-3 lg:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr_2.1fr] lg:items-center"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-foreground/54">{item.code}</p>
                      {activeStoreScope === 'all' ? <p className="text-xs text-foreground/54">{getStoreName(item.storeId)}</p> : null}
                    </div>
                    <p className="text-sm text-foreground/66">{item.category}</p>
                    <p className="text-sm font-medium text-foreground">{item.quantity}</p>
                    <p className="text-sm text-foreground/66">{item.unit}</p>
                    <div><StatusBadge status={item.status} /></div>
                    <p className="text-sm text-foreground/62">{formatUpdatedAt(item.updatedAt)}</p>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          data-testid={`inventory-add-${item.id}`}
                          type="button"
                          disabled={pendingActionKey === `${item.id}:add-one`}
                          onClick={() => { void runAction(`${item.id}:add-one`, () => addInventoryStock(item.id, 1)); }}
                          className="cursor-pointer rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.id}:reduce-one`}
                          onClick={() => { void runAction(`${item.id}:reduce-one`, () => reduceInventoryStock(item.id, 1)); }}
                          className="cursor-pointer rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Reduce
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.id}:threshold`}
                          onClick={() => { void promptAndSetThreshold(item.id, item.name, item.threshold); }}
                          className="cursor-pointer rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Threshold
                        </button>
                        <button
                          data-testid={`inventory-out-${item.id}`}
                          type="button"
                          disabled={pendingActionKey === `${item.id}:out`}
                          onClick={() => { void runAction(`${item.id}:out`, () => markInventoryOutOfStock(item.id)); }}
                          className="cursor-pointer rounded-lg border border-[#E7B5B5] bg-[#FFF4F4] px-2.5 py-1.5 text-xs font-medium text-[#8B2E2E] transition hover:bg-[#ffeaea] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Out
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.inventoryItemId}:archive`}
                          onClick={() => { void handleArchive(item.inventoryItemId, item.name); }}
                          className="cursor-pointer text-xs font-medium text-[#8B2E2E] transition hover:text-[#6e2020] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Archive
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={getEnteredQuantity(item.id)}
                          onChange={(event) => handleEnteredQuantityChange(item.id, event.target.value)}
                          inputMode="decimal"
                          placeholder={`Qty in ${item.unit}`}
                          className="w-[120px] rounded-xl border border-primary/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/24"
                        />
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.id}:add`}
                          onClick={() => { void handleDirectQuantityAction(item.id, 'add'); }}
                          className="cursor-pointer rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Add Entered
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.id}:reduce`}
                          onClick={() => { void handleDirectQuantityAction(item.id, 'reduce'); }}
                          className="cursor-pointer rounded-xl border border-primary/16 bg-white px-3 py-2 text-xs font-semibold text-foreground/76 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Reduce Entered
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionKey === `${item.id}:set`}
                          onClick={() => { void handleDirectQuantityAction(item.id, 'set'); }}
                          className="cursor-pointer rounded-xl border border-primary/16 bg-[#F7FAF3] px-3 py-2 text-xs font-semibold text-foreground/76 transition hover:border-primary/24 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          Set Exact
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      <motion.section
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.09 }}
        className="rounded-[28px] border border-primary/12 bg-white/90 p-5"
      >
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
            {recentHistory.map((entry, index) => (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3"
              >
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
              </motion.article>
            ))}
          </div>
        )}
      </motion.section>

      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        ariaLabel="Add inventory item"
      >
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Inventory</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Add Inventory Item</h2>
            <p className="mt-2 text-sm text-foreground/64">
              Create a new inventory item for {activeStore?.name ?? 'the selected store'} and record its starting count truthfully.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={newItemForm.name}
              onChange={(event) => setNewItemForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Item name"
              className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/24"
            />
            <select
              value={newItemForm.category}
              onChange={(event) => setNewItemForm((previous) => ({ ...previous, category: event.target.value }))}
              className="cursor-pointer rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/24"
            >
              {INVENTORY_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={newItemForm.unit}
              onChange={(event) => setNewItemForm((previous) => ({ ...previous, unit: event.target.value }))}
              placeholder="Unit (kg, pcs, packs)"
              className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/24"
            />
            <input
              value={newItemForm.threshold}
              onChange={(event) => setNewItemForm((previous) => ({ ...previous, threshold: sanitizeDecimalInput(event.target.value) }))}
              inputMode="decimal"
              placeholder="Threshold"
              className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/24"
            />
            <input
              value={newItemForm.initialQuantity}
              onChange={(event) => setNewItemForm((previous) => ({ ...previous, initialQuantity: sanitizeDecimalInput(event.target.value) }))}
              inputMode="decimal"
              placeholder="Initial quantity"
              className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/24 md:col-span-2"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { void handleCreateInventoryItem(); }}
              disabled={pendingActionKey === 'create-inventory-item'}
              className="cursor-pointer rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingActionKey === 'create-inventory-item' ? 'Creating…' : 'Create item'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="cursor-pointer rounded-2xl border border-primary/12 bg-white px-4 py-3 text-sm font-medium text-foreground/72 transition hover:bg-[#F7FAF3]"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
