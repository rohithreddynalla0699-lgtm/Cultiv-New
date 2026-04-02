import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { StoreInput, StoreRecord } from '../../types/admin';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';

const createEmptyStoreForm = (): StoreInput => ({
  name: '',
  city: '',
  code: '',
  pin: '',
  isActive: true,
});

export function StoresScreen() {
  const { stores, employees, permissions, addStore, updateStore } = useAdminDashboard();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreInput>(createEmptyStoreForm);
  const [message, setMessage] = useState('Manage store access and keep new locations ready for rollout.');

  const sortedStores = useMemo(() => [...stores].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)), [stores]);

  if (!permissions.canManageStores) {
    return <Navigate to="/admin/summary" replace />;
  }

  const openCreate = () => {
    setEditingStoreId(null);
    setForm(createEmptyStoreForm());
    setEditorOpen(true);
    setMessage('Create a store with its own code and 6-digit PIN.');
  };

  const openEdit = (store: StoreRecord) => {
    setEditingStoreId(store.id);
    setForm({
      name: store.name,
      city: store.city,
      code: store.code,
      pin: store.pin,
      isActive: store.isActive,
    });
    setEditorOpen(true);
    setMessage(`Editing ${store.name}.`);
  };

  const handleSubmit = () => {
    const result = editingStoreId ? updateStore(editingStoreId, form) : addStore(form);
    setMessage(result.message);
    if (result.success) {
      closeEditor();
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingStoreId(null);
    setForm(createEmptyStoreForm());
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <SectionHeader
        eyebrow="Stores"
        title="Manage stores quickly."
        description="Lightweight list for active status and edits without extra dashboard noise."
        action={<button data-testid="stores-add-btn" type="button" onClick={openCreate} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add Store</button>}
      />

      <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <p>Store Name</p>
            <p>City</p>
            <p>Code</p>
            <p>Status</p>
            <p>Actions</p>
          </div>

          <div className="divide-y divide-primary/8">
            {sortedStores.map((store) => {
              const employeeCount = employees.filter((employee) => employee.storeId === store.id).length;
              return (
                <div key={store.id} data-testid={`store-row-${store.id}`} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr] items-center gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{store.name}</p>
                    <p className="text-xs text-foreground/54">{employeeCount} employees</p>
                  </div>
                  <p className="text-sm text-foreground/66">{store.city}</p>
                  <p className="text-sm font-medium text-foreground">{store.code}</p>
                  <div><StatusBadge status={store.isActive ? 'active' : 'inactive'} /></div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateStore(store.id, { name: store.name, city: store.city, code: store.code, pin: store.pin, isActive: !store.isActive })} className="rounded-lg border border-primary/16 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground/74">
                      {store.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button data-testid={`store-edit-${store.id}`} type="button" onClick={() => openEdit(store)} className="text-xs font-medium text-primary hover:underline">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editorOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <motion.div
              className="w-full max-w-lg rounded-[28px] border border-primary/12 bg-white p-5 shadow-[0_26px_70px_rgba(16,24,16,0.22)]"
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.99 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Store Editor</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">{editingStoreId ? 'Update store' : 'Add store'}</p>
                <p className="mt-2 text-sm text-foreground/64">{message}</p>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-xl border border-primary/14 bg-white p-2 text-foreground/70">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Store Name</span>
                <input data-testid="store-form-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">City</span>
                <input data-testid="store-form-city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Store Code</span>
                <input data-testid="store-form-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">6-digit PIN</span>
                <input data-testid="store-form-pin" value={form.pin} onChange={(event) => setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72">
                <span className="font-medium">Store active</span>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button data-testid="store-form-submit" type="button" onClick={handleSubmit} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{editingStoreId ? 'Save changes' : 'Create store'}</button>
                <button type="button" onClick={closeEditor} className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72">Cancel</button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
