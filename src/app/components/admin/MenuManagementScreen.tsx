import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { menuService, type OperationsMenuItem, type OperationsOptionGroup } from '../../services/menuService';

const DEFAULT_CATEGORY_OPTIONS = [
  'signature-bowls',
  'salad-bowls',
  'breakfast-bowls',
  'high-protein-cups',
  'kids-meal',
  'drinks-juices',
] as const;

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  categorySlug: 'signature-bowls',
  subcategorySlug: '',
  imageUrl: '',
  calories: '',
  protein: '',
  badge: '',
  sortOrder: '',
  isActive: true,
  optionGroupIds: [] as string[],
};

export function MenuManagementScreen() {
  const { permissions, session } = useAdminDashboard();
  const formSectionRef = useRef<HTMLElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string }>({
    tone: 'info',
    text: 'Manage menu items, availability, and add-on mappings from the backend.',
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<OperationsMenuItem[]>([]);
  const [optionGroups, setOptionGroups] = useState<OperationsOptionGroup[]>([]);

  useEffect(() => {
    if (!message.text || message.tone === 'info') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage({
        tone: 'info',
        text: editingItemId
          ? 'Editing backend menu item. Changes save directly to the live menu.'
          : 'Manage menu items, availability, and add-on mappings from the backend.',
      });
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [editingItemId, message]);

  useEffect(() => {
    if (!permissions.canManageMenu || !session) {
      return;
    }

    let isActive = true;
    setLoading(true);

    void menuService
      .getAllMenuItemsForOperations(session)
      .then((dashboard) => {
        if (!isActive) return;
        setMenuItems(dashboard.items);
        setOptionGroups(dashboard.optionGroups);
      })
      .catch((error) => {
        if (!isActive) return;
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Could not load menu items.',
        });
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [permissions.canManageMenu, refreshKey, session]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const categories = useMemo(
    () => Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...menuItems.map((item) => item.categorySlug)])),
    [menuItems],
  );

  if (!permissions.canManageMenu) {
    return <Navigate to="/admin/summary" replace />;
  }

  const resetForm = () => {
    setEditingItemId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (item: OperationsMenuItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      categorySlug: item.categorySlug,
      subcategorySlug: item.subcategorySlug ?? '',
      imageUrl: item.image,
      calories: item.calories == null ? '' : String(item.calories),
      protein: item.protein == null ? '' : String(item.protein),
      badge: item.badge ?? '',
      sortOrder: String(item.sortOrder ?? ''),
      isActive: item.isActive,
      optionGroupIds: [...item.optionGroupIds],
    });
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const toggleOptionGroup = (groupId: string) => {
    setForm((previous) => ({
      ...previous,
      optionGroupIds: previous.optionGroupIds.includes(groupId)
        ? previous.optionGroupIds.filter((value) => value !== groupId)
        : [...previous.optionGroupIds, groupId],
    }));
  };

  const handleSubmit = async () => {
    if (!session) {
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    if (!form.name.trim()) {
      setMessage({ tone: 'error', text: 'Item name is required.' });
      return;
    }

    if (!form.price || isNaN(Number(form.price)) || !Number.isInteger(Number(form.price))) {
      setMessage({ tone: 'error', text: 'Price must be a whole number (integer).' });
      return;
    }

    setSaving(true);
    const result = await menuService.saveMenuItem(session, {
      menuItemId: editingItemId ?? undefined,
      name: form.name.trim(),
      description: form.description || null,
      price: Number(form.price),
      categorySlug: form.categorySlug,
      subcategorySlug: form.subcategorySlug || null,
      imageUrl: form.imageUrl || null,
      calories: form.calories ? Number(form.calories) : null,
      protein: form.protein ? Number(form.protein) : null,
      badge: form.badge || null,
      sortOrder: form.sortOrder ? Number(form.sortOrder) : null,
      isActive: form.isActive,
      optionGroupIds: form.optionGroupIds,
    });
    setSaving(false);

    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success) {
      resetForm();
      refresh();
    }
  };

  const handleAvailabilityToggle = async (item: OperationsMenuItem) => {
    if (!session) return;
    setSaving(true);
    const result = await menuService.setMenuItemAvailability(session, item.id, !item.isActive);
    setSaving(false);
    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });
    if (result.success) {
      refresh();
    }
  };

  const handleDelete = async (item: OperationsMenuItem) => {
    if (!session) return;

    const confirmed = window.confirm(`Remove ${item.name}? Items with order history will be disabled instead of deleted.`);
    if (!confirmed) return;

    setSaving(true);
    const result = await menuService.deleteMenuItem(session, item.id);
    setSaving(false);
    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });
    if (result.success) {
      if (editingItemId === item.id) {
        resetForm();
      }
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Menu"
        title="Menu management"
        description="Owner/Admin can now manage the backend-authoritative menu and attach real add-on groups."
        action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68 shadow-[0_12px_30px_rgba(28,45,14,0.05)]">Items: {menuItems.length}</div>}
      />

      <AnimatePresence mode="wait">
        {message.text ? (
          <motion.div
            key={`${message.tone}:${message.text}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`rounded-[24px] border px-4 py-3 text-sm shadow-[0_16px_34px_rgba(28,45,14,0.07)] ${
              message.tone === 'error'
                ? 'border-[#E7B5B5] bg-[#FFF4F4] text-[#8B2E2E]'
                : message.tone === 'success'
                  ? 'border-primary/12 bg-[#F7FAF3] text-foreground/72'
                  : 'border-primary/12 bg-white/90 text-foreground/65'
            }`}
          >
            {message.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.section
        ref={formSectionRef}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="rounded-[28px] border border-primary/12 bg-white/90 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">
            {editingItemId ? 'Edit item' : 'Create item'}
          </p>
          {editingItemId ? (
            <button type="button" onClick={resetForm} className="cursor-pointer text-sm font-medium text-primary transition hover:text-primary/80 hover:underline">
              Cancel edit
            </button>
          ) : null}
        </div>

        <motion.div layout className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Item name"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <input
            value={form.price}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(event) => {
              // Only allow integer values
              const value = event.target.value.replace(/[^\d]/g, '');
              setForm((prev) => ({ ...prev, price: value }));
            }}
            placeholder="Price (integer)"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <select
            value={form.categorySlug}
            onChange={(event) => setForm((prev) => ({ ...prev, categorySlug: event.target.value }))}
            className="cursor-pointer rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          >
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input
            value={form.subcategorySlug}
            onChange={(event) => setForm((prev) => ({ ...prev, subcategorySlug: event.target.value }))}
            placeholder="Subcategory slug"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <input
            value={form.imageUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
            placeholder="Image URL"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <input
            value={form.calories}
            onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value.replace(/[^\d]/g, '') }))}
            placeholder="Calories"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <input
            value={form.protein}
            onChange={(event) => setForm((prev) => ({ ...prev, protein: event.target.value.replace(/[^\d]/g, '') }))}
            placeholder="Protein grams"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <input
            value={form.sortOrder}
            onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value.replace(/[^\d]/g, '') }))}
            placeholder="Sort order"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
        </motion.div>

        <textarea
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Description"
          className="mt-3 min-h-[96px] w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
        />

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={form.badge}
            onChange={(event) => setForm((prev) => ({ ...prev, badge: event.target.value }))}
            placeholder="Badge"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/22"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm text-foreground/72 transition hover:border-primary/18">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Item is visible
          </label>
        </div>

        <motion.div layout className="mt-5 rounded-[24px] border border-primary/10 bg-[#F7FAF3] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/58">Add-on Groups</p>
              <p className="mt-1 text-sm text-foreground/62">These are the real backend option groups attached to this item.</p>
            </div>
            <p className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-foreground/62">
              Selected: {form.optionGroupIds.length}
            </p>
          </div>
          {optionGroups.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-foreground/58">No backend option groups found yet.</div>
          ) : (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {optionGroups.map((group) => {
                const isSelected = form.optionGroupIds.includes(group.id);
                return (
                  <label key={group.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:border-primary/20 hover:bg-white ${isSelected ? 'border-primary/20 bg-white shadow-[0_10px_22px_rgba(28,45,14,0.05)]' : 'border-primary/10 bg-white/70'}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOptionGroup(group.id)}
                      className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                    />
                    <span>
                      <span className="block font-medium text-foreground">{group.name}</span>
                      <span className="mt-1 block text-xs text-foreground/58">
                        {group.selectionType} · {group.isRequired ? 'Required' : 'Optional'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </motion.div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={saving}
            className="cursor-pointer rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : editingItemId ? 'Save changes' : 'Add menu item'}
          </button>
          {editingItemId ? (
            <button type="button" onClick={resetForm} className="cursor-pointer rounded-2xl border border-primary/12 bg-white px-4 py-3 text-sm font-medium text-foreground/72 transition hover:bg-[#F7FAF3]">
              Cancel
            </button>
          ) : null}
        </div>
      </motion.section>

      <motion.section
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.04 }}
        className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90 shadow-[0_16px_34px_rgba(28,45,14,0.06)]"
      >
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[1.7fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_1.7fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <p>Item</p>
            <p>Category</p>
            <p>Price</p>
            <p>Status</p>
            <p>Add-ons</p>
            <p>Sort</p>
            <p>Actions</p>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-foreground/62">Loading backend menu…</div>
          ) : (
            <div className="divide-y divide-primary/8">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.01 }}
                  className="grid grid-cols-[1.7fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_1.7fr] gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-foreground/58">{item.description || 'No description'}</p>
                    {item.subcategorySlug ? <p className="mt-1 text-[11px] text-foreground/48">{item.subcategorySlug}</p> : null}
                  </div>
                  <p className="text-sm text-foreground/66">{item.categoryName}</p>
                  <p className="text-sm font-semibold text-foreground">Rs {item.price}</p>
                  <p className="text-sm text-foreground/66">{item.isActive ? 'Active' : 'Hidden'}</p>
                  <p className="text-sm text-foreground/66">{item.optionGroupCount} group{item.optionGroupCount === 1 ? '' : 's'}</p>
                  <p className="text-sm text-foreground/66">{item.sortOrder}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => startEdit(item)} className="cursor-pointer rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-[#F7FAF3]">Edit</button>
                    <button type="button" onClick={() => { void handleAvailabilityToggle(item); }} className="cursor-pointer rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74 transition hover:border-primary/24 hover:bg-[#F7FAF3]">
                      {item.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" onClick={() => { void handleDelete(item); }} className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100">Delete</button>
                  </div>
                </motion.div>
              ))}
              {menuItems.length === 0 ? (
                <div className="px-4 py-6 text-sm text-foreground/62">No menu items found in the backend.</div>
              ) : null}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
