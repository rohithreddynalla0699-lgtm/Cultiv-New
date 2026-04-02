import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { menuService, type OperationsMenuItem } from '../../services/menuService';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  categorySlug: 'signature-bowls',
  hasAddons: false,
};

export function MenuManagementScreen() {
  const { permissions } = useAdminDashboard();
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState('Manage items, prices, and add-on eligibility for operations.');
  const [form, setForm] = useState(EMPTY_FORM);

  const menuItems = useMemo(() => menuService.getAllMenuItemsForOperations(), [refreshKey]);

  if (!permissions.canManageMenu) {
    return <Navigate to="/admin/summary" replace />;
  }

  const categories = Array.from(new Set(menuItems.map((item) => item.categorySlug)));

  const refresh = () => setRefreshKey((value) => value + 1);

  const handleCreate = () => {
    const result = menuService.createMenuItem({
      name: form.name,
      description: form.description,
      price: Number(form.price),
      categorySlug: form.categorySlug,
      hasAddons: form.hasAddons,
    });
    setMessage(result.message);
    if (result.success) {
      setForm(EMPTY_FORM);
      refresh();
    }
  };

  const updatePrice = (item: OperationsMenuItem, delta: number) => {
    const result = menuService.updateMenuItem(item.id, { price: Math.max(0, item.price + delta) });
    setMessage(result.message);
    if (result.success) refresh();
  };

  const toggleActive = (item: OperationsMenuItem) => {
    const result = menuService.updateMenuItem(item.id, { isActive: !item.isActive });
    setMessage(result.message);
    if (result.success) refresh();
  };

  const toggleAddons = (item: OperationsMenuItem) => {
    const result = menuService.updateMenuItem(item.id, { hasAddons: !item.hasAddons });
    setMessage(result.message);
    if (result.success) refresh();
  };

  const deleteItem = (item: OperationsMenuItem) => {
    const result = menuService.deleteMenuItem(item.id);
    setMessage(result.message);
    if (result.success) refresh();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Menu"
        title="Menu management"
        description="Owner/Admin can control live operations pricing and availability from one place."
        action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">Items: {menuItems.length}</div>}
      />

      <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4">
        <p className="text-sm text-foreground/65">{message}</p>
      </div>

      <section className="rounded-[28px] border border-primary/12 bg-white/90 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Create item</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Item name"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none"
          />
          <input
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none"
          />
          <input
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value.replace(/[^\d.]/g, '') }))}
            placeholder="Price"
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none"
          />
          <select
            value={form.categorySlug}
            onChange={(event) => setForm((prev) => ({ ...prev, categorySlug: event.target.value }))}
            className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            Add menu item
          </button>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={form.hasAddons}
            onChange={(event) => setForm((prev) => ({ ...prev, hasAddons: event.target.checked }))}
            className="h-4 w-4 accent-primary"
          />
          Add-ons enabled
        </label>
      </section>

      <section className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[2fr_1fr_0.7fr_0.9fr_0.8fr_1.6fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <p>Item</p>
            <p>Category</p>
            <p>Price</p>
            <p>Status</p>
            <p>Add-ons</p>
            <p>Actions</p>
          </div>
          <div className="divide-y divide-primary/8">
            {menuItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_0.7fr_0.9fr_0.8fr_1.6fr] gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-foreground/58">{item.description || 'No description'}</p>
                </div>
                <p className="text-sm text-foreground/66">{item.categoryName}</p>
                <p className="text-sm font-semibold text-foreground">Rs {item.price}</p>
                <p className="text-sm text-foreground/66">{item.isActive ? 'Active' : 'Inactive'}</p>
                <p className="text-sm text-foreground/66">{item.hasAddons ? 'Enabled' : 'Disabled'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => updatePrice(item, 10)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">+10</button>
                  <button type="button" onClick={() => updatePrice(item, -10)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">-10</button>
                  <button type="button" onClick={() => toggleAddons(item)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">Add-ons</button>
                  <button type="button" onClick={() => toggleActive(item)} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">{item.isActive ? 'Disable' : 'Enable'}</button>
                  <button type="button" onClick={() => deleteItem(item)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
