import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';
import { credentialsAdminService } from '../../services/credentialsAdminService';
import { operationsAdminService, type OperationsInternalUserRecord } from '../../services/operationsAdminService';

interface StoreEditorState {
  show: boolean;
  targetStoreId: string | null;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  code: string;
  isActive: boolean;
  storeLoginInternalUserId: string | null;
  storeLoginFullName: string;
  storeLoginPin: string;
  storeLoginIsActive: boolean;
  isSubmitting: boolean;
}

interface AdminEditorState {
  show: boolean;
  internalUserId: string | null;
  fullName: string;
  pin: string;
  isActive: boolean;
  isSubmitting: boolean;
}

interface ResetPinState {
  show: boolean;
  internalUserId: string | null;
  label: string;
  newPin: string;
  isSubmitting: boolean;
}

interface ManagementConfirmationState {
  show: boolean;
  entityType: 'store' | 'admin';
  action: 'deactivate' | 'delete';
  targetId: string | null;
  label: string;
  isSubmitting: boolean;
}

const createEmptyStoreEditorState = (): StoreEditorState => ({
  show: false,
  targetStoreId: null,
  name: '',
  addressLine1: '',
  city: '',
  state: '',
  postalCode: '',
  phone: '',
  code: '',
  isActive: true,
  storeLoginInternalUserId: null,
  storeLoginFullName: '',
  storeLoginPin: '',
  storeLoginIsActive: true,
  isSubmitting: false,
});

const createEmptyAdminEditorState = (): AdminEditorState => ({
  show: false,
  internalUserId: null,
  fullName: '',
  pin: '',
  isActive: true,
  isSubmitting: false,
});

const createEmptyResetPinState = (): ResetPinState => ({
  show: false,
  internalUserId: null,
  label: '',
  newPin: '',
  isSubmitting: false,
});

const createEmptyManagementConfirmationState = (): ManagementConfirmationState => ({
  show: false,
  entityType: 'store',
  action: 'deactivate',
  targetId: null,
  label: '',
  isSubmitting: false,
});

export function StoresScreen() {
  const { stores, permissions, session, refreshStores } = useAdminDashboard();
  const [message, setMessage] = useState('Stores, store logins, and admin logins are now managed from backend truth.');
  const [storeUsers, setStoreUsers] = useState<OperationsInternalUserRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<OperationsInternalUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storeEditor, setStoreEditor] = useState<StoreEditorState>(createEmptyStoreEditorState);
  const [adminEditor, setAdminEditor] = useState<AdminEditorState>(createEmptyAdminEditorState);
  const [resetPinState, setResetPinState] = useState<ResetPinState>(createEmptyResetPinState);
  const [managementConfirmation, setManagementConfirmation] = useState<ManagementConfirmationState>(createEmptyManagementConfirmationState);

  const loadManagementState = useCallback(async () => {
    if (!session) {
      setStoreUsers([]);
      setAdminUsers([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextStoreUsers, nextAdminUsers] = await Promise.all([
        operationsAdminService.loadInternalUsers(session, 'store'),
        operationsAdminService.loadInternalUsers(session, 'admin'),
      ]);
      setStoreUsers(nextStoreUsers);
      setAdminUsers(nextAdminUsers);
      setLoadError(null);
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Could not load management state.';
      setLoadError(nextError);
      setMessage(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadManagementState();
  }, [loadManagementState]);

  const storeRows = useMemo(() => {
    const storeUsersByStoreId = storeUsers.reduce<Record<string, OperationsInternalUserRecord[]>>((accumulator, user) => {
      if (!user.storeId) return accumulator;
      if (!accumulator[user.storeId]) {
        accumulator[user.storeId] = [];
      }
      accumulator[user.storeId].push(user);
      return accumulator;
    }, {});

    return [...stores]
      .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name))
      .map((store) => ({
        store,
        storeUsers: storeUsersByStoreId[store.id] ?? [],
      }));
  }, [stores, storeUsers]);

  if (!permissions.canManageStores) {
    return <Navigate to="/operations/summary" replace />;
  }

  const openCreateStore = () => {
    setStoreEditor({
      ...createEmptyStoreEditorState(),
      show: true,
    });
    setMessage('Create a store and its first store login together so store access works immediately.');
  };

  const openEditStore = (params: {
    storeId: string;
    name: string;
    addressLine1?: string;
    city: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    code: string;
    isActive: boolean;
    storeUser: OperationsInternalUserRecord | null;
  }) => {
    setStoreEditor({
      show: true,
      targetStoreId: params.storeId,
      name: params.name,
      addressLine1: params.addressLine1 ?? '',
      city: params.city,
      state: params.state ?? '',
      postalCode: params.postalCode ?? '',
      phone: params.phone ?? '',
      code: params.code,
      isActive: params.isActive,
      storeLoginInternalUserId: params.storeUser?.internalUserId ?? null,
      storeLoginFullName: params.storeUser?.fullName ?? '',
      storeLoginPin: '',
      storeLoginIsActive: params.storeUser?.isActive ?? params.isActive,
      isSubmitting: false,
    });
    setMessage(`Editing ${params.name}.`);
  };

  const closeStoreEditor = () => setStoreEditor(createEmptyStoreEditorState());

  const saveStore = async () => {
    if (!session) {
      setMessage('Internal session expired. Please sign in again.');
      return;
    }

    if (!storeEditor.name.trim() || !storeEditor.addressLine1.trim() || !storeEditor.city.trim() || !storeEditor.state.trim() || !storeEditor.postalCode.trim() || !storeEditor.code.trim()) {
      setMessage('Store name, address, city, state, postal code, and code are required.');
      return;
    }

    const needsStoreLoginCreation = !storeEditor.targetStoreId || !storeEditor.storeLoginInternalUserId;
    if (needsStoreLoginCreation) {
      if (!storeEditor.storeLoginFullName.trim()) {
        setMessage('A store login full name is required.');
        return;
      }
      if (!/^\d{6}$/.test(storeEditor.storeLoginPin)) {
        setMessage('A valid 6-digit store login PIN is required.');
        return;
      }
    }

    setStoreEditor((previous) => ({ ...previous, isSubmitting: true }));
    try {
      const result = await operationsAdminService.saveStore(session, {
        targetStoreId: storeEditor.targetStoreId ?? undefined,
        name: storeEditor.name.trim(),
        addressLine1: storeEditor.addressLine1.trim(),
        city: storeEditor.city.trim(),
        state: storeEditor.state.trim(),
        postalCode: storeEditor.postalCode.trim(),
        phone: storeEditor.phone.trim() || undefined,
        code: storeEditor.code.trim(),
        isActive: storeEditor.isActive,
        storeLoginInternalUserId: storeEditor.storeLoginInternalUserId ?? undefined,
        storeLoginFullName: storeEditor.storeLoginFullName.trim() || undefined,
        storeLoginPin: storeEditor.storeLoginPin || undefined,
        storeLoginIsActive: storeEditor.storeLoginIsActive,
      });

      setMessage(result.message);
      closeStoreEditor();
      await Promise.all([refreshStores(), loadManagementState()]);
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Could not save store.';
      setMessage(nextError);
      setStoreEditor((previous) => ({ ...previous, isSubmitting: false }));
    }
  };

  const openManagementConfirmation = (
    entityType: 'store' | 'admin',
    action: 'deactivate' | 'delete',
    targetId: string,
    label: string,
  ) => {
    setManagementConfirmation({
      show: true,
      entityType,
      action,
      targetId,
      label,
      isSubmitting: false,
    });
  };

  const closeManagementConfirmation = () => setManagementConfirmation(createEmptyManagementConfirmationState());

  const openCreateAdmin = () => {
    setAdminEditor({
      ...createEmptyAdminEditorState(),
      show: true,
    });
    setMessage('Create a backend-backed admin login from the UI.');
  };

  const openEditAdmin = (adminUser: OperationsInternalUserRecord) => {
    setAdminEditor({
      show: true,
      internalUserId: adminUser.internalUserId,
      fullName: adminUser.fullName,
      pin: '',
      isActive: adminUser.isActive,
      isSubmitting: false,
    });
    setMessage(`Editing ${adminUser.fullName}. Leave PIN blank to keep the current login PIN.`);
  };

  const closeAdminEditor = () => setAdminEditor(createEmptyAdminEditorState());

  const saveAdmin = async () => {
    if (!session) {
      setMessage('Internal session expired. Please sign in again.');
      return;
    }

    if (!adminEditor.fullName.trim()) {
      setMessage('Admin full name is required.');
      return;
    }

    if (!adminEditor.internalUserId && !/^\d{6}$/.test(adminEditor.pin)) {
      setMessage('A valid 6-digit admin PIN is required for new admins.');
      return;
    }

    if (adminEditor.pin && !/^\d{6}$/.test(adminEditor.pin)) {
      setMessage('Use a valid 6-digit admin PIN.');
      return;
    }

    setAdminEditor((previous) => ({ ...previous, isSubmitting: true }));
    try {
      const result = await operationsAdminService.saveInternalUser(session, {
        internalUserId: adminEditor.internalUserId ?? undefined,
        roleKey: 'admin',
        fullName: adminEditor.fullName.trim(),
        pin: adminEditor.pin || undefined,
        isActive: adminEditor.isActive,
      });

      setMessage(result.message);
      closeAdminEditor();
      await loadManagementState();
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Could not save admin.';
      setMessage(nextError);
      setAdminEditor((previous) => ({ ...previous, isSubmitting: false }));
    }
  };

  const submitManagementAction = async () => {
    if (!session || !managementConfirmation.targetId) {
      setMessage('Internal session expired. Please sign in again.');
      closeManagementConfirmation();
      return;
    }

    setManagementConfirmation((previous) => ({ ...previous, isSubmitting: true }));

    try {
      let result: { message: string };
      if (managementConfirmation.entityType === 'store') {
        result = managementConfirmation.action === 'delete'
          ? await operationsAdminService.deleteStore(session, managementConfirmation.targetId)
          : await operationsAdminService.deactivateStore(session, managementConfirmation.targetId);
        await Promise.all([refreshStores(), loadManagementState()]);
      } else {
        result = managementConfirmation.action === 'delete'
          ? await operationsAdminService.deleteInternalUser(session, managementConfirmation.targetId)
          : await operationsAdminService.deactivateInternalUser(session, managementConfirmation.targetId);
        await loadManagementState();
      }

      setMessage(result.message);
      closeManagementConfirmation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete this management action.');
      setManagementConfirmation((previous) => ({ ...previous, isSubmitting: false }));
    }
  };

  const openResetPin = (internalUserId: string, label: string) => {
    setResetPinState({
      show: true,
      internalUserId,
      label,
      newPin: '',
      isSubmitting: false,
    });
  };

  const closeResetPin = () => setResetPinState(createEmptyResetPinState());

  const submitResetPin = async () => {
    if (!session || !resetPinState.internalUserId) {
      setMessage('Internal session expired. Please sign in again.');
      closeResetPin();
      return;
    }

    if (!/^\d{6}$/.test(resetPinState.newPin)) {
      setMessage('Use a valid 6-digit PIN.');
      return;
    }

    setResetPinState((previous) => ({ ...previous, isSubmitting: true }));
    try {
      const isAdminTarget = adminUsers.some((entry) => entry.internalUserId === resetPinState.internalUserId);
      const result = isAdminTarget
        ? await credentialsAdminService.updateAdminPin(session, resetPinState.internalUserId, resetPinState.newPin)
        : await credentialsAdminService.updateStoreLoginPin(session, resetPinState.internalUserId, resetPinState.newPin);
      setMessage(result.message);
      closeResetPin();
      await loadManagementState();
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Could not reset login PIN.';
      setMessage(nextError);
      setResetPinState((previous) => ({ ...previous, isSubmitting: false }));
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <SectionHeader
        eyebrow="Operations Management"
        title="Manage stores and internal access."
        description="Owner-managed operational records now persist through backend functions. Store creation includes the required store login user, and admin/store login PINs can be reset without touching SQL."
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadManagementState()} className="rounded-full border border-primary/16 bg-white px-4 py-2.5 text-sm font-medium text-foreground/72">Refresh</button>
            <button type="button" onClick={openCreateAdmin} className="rounded-full border border-primary/16 bg-white px-4 py-2.5 text-sm font-medium text-foreground/72">Add Admin</button>
            <button type="button" onClick={openCreateStore} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add Store</button>
          </div>
        )}
      />

      <div className="rounded-[24px] border border-primary/12 bg-white/92 px-5 py-4 text-sm text-foreground/66">
        {message}
      </div>

      {loadError ? (
        <div className="rounded-[24px] border border-[#D9A06A]/35 bg-[#FFF7F0] p-4 text-sm text-[#8A4B16]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadManagementState()} className="rounded-full border border-[#D9A06A]/35 bg-white px-4 py-2 text-sm font-medium text-[#8A4B16]">Retry</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-[28px] border border-primary/12 bg-white/92 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Stores</p>
            <p className="mt-2 text-sm text-foreground/64">Create stores, edit store metadata, and ensure each store has a real backend login user.</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_1.2fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
              <p>Store</p>
              <p>Code</p>
              <p>Status</p>
              <p>Store Login</p>
              <p>Actions</p>
            </div>

            <div className="divide-y divide-primary/8">
              {storeRows.map(({ store, storeUsers: scopedStoreUsers }) => {
                const primaryStoreUser = scopedStoreUsers[0] ?? null;
                const hasAmbiguousStoreUsers = scopedStoreUsers.length > 1;
                return (
                  <div key={store.id} className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_1.2fr] items-center gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{store.name}</p>
                      <p className="text-xs text-foreground/54">{store.city}</p>
                    </div>
                    <p className="text-sm font-medium text-foreground">{store.code}</p>
                    <div><StatusBadge status={store.isActive ? 'active' : 'inactive'} /></div>
                    <div>
                      {primaryStoreUser ? (
                        <>
                          <p className="text-sm font-medium text-foreground">{primaryStoreUser.fullName}</p>
                          <p className="text-xs text-foreground/54">
                            {primaryStoreUser.isActive ? 'Login enabled' : 'Login disabled'}
                            {hasAmbiguousStoreUsers ? ` · ${scopedStoreUsers.length} login users found` : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">Missing store login</p>
                          <p className="text-xs text-foreground/54">Edit store to add a backend store login user.</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditStore({
                          storeId: store.id,
                          name: store.name,
                          addressLine1: store.addressLine1,
                          city: store.city,
                          state: store.state,
                          postalCode: store.postalCode,
                          phone: store.phone,
                          code: store.code,
                          isActive: store.isActive,
                          storeUser: hasAmbiguousStoreUsers ? null : primaryStoreUser,
                        })}
                        className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => primaryStoreUser && openResetPin(primaryStoreUser.internalUserId, `${primaryStoreUser.fullName} · ${store.name}`)}
                        disabled={!primaryStoreUser || hasAmbiguousStoreUsers}
                        className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => openManagementConfirmation('store', 'deactivate', store.id, store.name)}
                        disabled={!store.isActive}
                        className="rounded-lg border border-red-300/50 bg-red-50/60 px-3 py-1.5 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => openManagementConfirmation('store', 'delete', store.id, store.name)}
                        className="rounded-lg border border-red-400/60 bg-red-100/80 px-3 py-1.5 text-xs font-semibold text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-[28px] border border-primary/12 bg-white/92 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Admin Access</p>
          <p className="mt-2 text-sm text-foreground/64">Create and manage global admin login users from the frontend. Owner remains backend-seeded only.</p>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/90">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
              <p>Admin</p>
              <p>Role</p>
              <p>Status</p>
              <p>Actions</p>
            </div>

            <div className="divide-y divide-primary/8">
              {adminUsers.map((adminUser) => (
                <div key={adminUser.internalUserId} className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr] items-center gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{adminUser.fullName}</p>
                    <p className="text-xs text-foreground/54">{adminUser.scopeType === 'global' ? 'Global access' : 'Scoped access'}</p>
                  </div>
                  <p className="text-sm text-foreground/66">{adminUser.roleName}</p>
                  <div><StatusBadge status={adminUser.isActive ? 'active' : 'inactive'} /></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openEditAdmin(adminUser)} className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74">Edit</button>
                    <button type="button" onClick={() => openResetPin(adminUser.internalUserId, adminUser.fullName)} className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74">Reset PIN</button>
                    <button type="button" onClick={() => openManagementConfirmation('admin', 'deactivate', adminUser.internalUserId, adminUser.fullName)} disabled={!adminUser.isActive} className="rounded-lg border border-red-300/50 bg-red-50/60 px-3 py-1.5 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50">Deactivate</button>
                    <button type="button" onClick={() => openManagementConfirmation('admin', 'delete', adminUser.internalUserId, adminUser.fullName)} className="rounded-lg border border-red-400/60 bg-red-100/80 px-3 py-1.5 text-xs font-semibold text-red-800">Delete</button>
                  </div>
                </div>
              ))}

              {!isLoading && adminUsers.length === 0 ? (
                <div className="px-4 py-4 text-sm text-foreground/58">No admin users found yet.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {storeEditor.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">{storeEditor.targetStoreId ? 'Edit store' : 'Add store'}</p>
            <p className="mt-2 text-sm text-foreground/72">
              {storeEditor.targetStoreId
                ? 'Update store details and keep the associated store login user accurate.'
                : 'Create the store and its first store login user together.'}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Store name</span>
                <input value={storeEditor.name} onChange={(event) => setStoreEditor((previous) => ({ ...previous, name: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Address line</span>
                <input value={storeEditor.addressLine1} onChange={(event) => setStoreEditor((previous) => ({ ...previous, addressLine1: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">City</span>
                <input value={storeEditor.city} onChange={(event) => setStoreEditor((previous) => ({ ...previous, city: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">State</span>
                <input value={storeEditor.state} onChange={(event) => setStoreEditor((previous) => ({ ...previous, state: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Postal code</span>
                <input value={storeEditor.postalCode} onChange={(event) => setStoreEditor((previous) => ({ ...previous, postalCode: event.target.value.replace(/\D/g, '').slice(0, 10) }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Store phone</span>
                <input value={storeEditor.phone} onChange={(event) => setStoreEditor((previous) => ({ ...previous, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Optional" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Store code</span>
                <input value={storeEditor.code} onChange={(event) => setStoreEditor((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72">
                <span className="font-medium">Store active</span>
                <input type="checkbox" checked={storeEditor.isActive} onChange={(event) => setStoreEditor((previous) => ({ ...previous, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">{storeEditor.storeLoginInternalUserId ? 'Store login user' : 'Initial store login user'}</span>
                <input value={storeEditor.storeLoginFullName} onChange={(event) => setStoreEditor((previous) => ({ ...previous, storeLoginFullName: event.target.value }))} placeholder="Store operator name" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">{storeEditor.storeLoginInternalUserId ? 'Create new PIN only if replacing missing login' : 'Initial store login PIN'}</span>
                <input value={storeEditor.storeLoginPin} onChange={(event) => setStoreEditor((previous) => ({ ...previous, storeLoginPin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder={storeEditor.storeLoginInternalUserId ? 'Leave blank to keep current PIN' : '6-digit PIN'} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72 md:col-span-2">
                <span className="font-medium">Store login active</span>
                <input type="checkbox" checked={storeEditor.storeLoginIsActive} onChange={(event) => setStoreEditor((previous) => ({ ...previous, storeLoginIsActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeStoreEditor} disabled={storeEditor.isSubmitting} className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void saveStore()} disabled={storeEditor.isSubmitting} className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{storeEditor.isSubmitting ? 'Saving…' : storeEditor.targetStoreId ? 'Save store' : 'Create store'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {adminEditor.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">{adminEditor.internalUserId ? 'Edit admin' : 'Add admin'}</p>
            <p className="mt-2 text-sm text-foreground/72">Admin login users are backend-managed internal users with global scope.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-foreground/68 md:col-span-2">
                <span className="mb-2 block font-medium">Full name</span>
                <input value={adminEditor.fullName} onChange={(event) => setAdminEditor((previous) => ({ ...previous, fullName: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">{adminEditor.internalUserId ? 'New PIN (optional)' : 'Initial PIN'}</span>
                <input value={adminEditor.pin} onChange={(event) => setAdminEditor((previous) => ({ ...previous, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder={adminEditor.internalUserId ? 'Leave blank to keep current PIN' : '6-digit PIN'} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72">
                <span className="font-medium">Admin active</span>
                <input type="checkbox" checked={adminEditor.isActive} onChange={(event) => setAdminEditor((previous) => ({ ...previous, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeAdminEditor} disabled={adminEditor.isSubmitting} className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void saveAdmin()} disabled={adminEditor.isSubmitting} className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{adminEditor.isSubmitting ? 'Saving…' : adminEditor.internalUserId ? 'Save admin' : 'Create admin'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {resetPinState.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-w-sm rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">Reset login PIN</p>
            <p className="mt-2 text-sm text-foreground/72">Set a new 6-digit login PIN for {resetPinState.label}. Active sessions for that account will be revoked.</p>
            <label className="mt-4 block text-sm text-foreground/68">
              <span className="mb-2 block font-medium">New login PIN</span>
              <input value={resetPinState.newPin} onChange={(event) => setResetPinState((previous) => ({ ...previous, newPin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="6-digit PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
            </label>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeResetPin} disabled={resetPinState.isSubmitting} className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void submitResetPin()} disabled={resetPinState.isSubmitting} className="flex-1 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{resetPinState.isSubmitting ? 'Updating…' : 'Update PIN'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {managementConfirmation.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-w-md rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">
              {managementConfirmation.action === 'delete' ? 'Delete permanently?' : 'Deactivate record?'}
            </p>
            <p className="mt-2 text-sm text-foreground/72">
              {managementConfirmation.action === 'delete'
                ? `Delete ${managementConfirmation.label}. The backend will only allow this if no historical dependencies exist. Otherwise it will tell you to deactivate instead.`
                : `Deactivate ${managementConfirmation.label}. This keeps historical records but removes active operational access.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeManagementConfirmation}
                disabled={managementConfirmation.isSubmitting}
                className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitManagementAction()}
                disabled={managementConfirmation.isSubmitting}
                className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  managementConfirmation.action === 'delete'
                    ? 'border border-red-400/60 bg-red-100/80 text-red-800'
                    : 'border border-red-300/50 bg-red-50/60 text-red-700'
                }`}
              >
                {managementConfirmation.isSubmitting
                  ? managementConfirmation.action === 'delete' ? 'Deleting…' : 'Deactivating…'
                  : managementConfirmation.action === 'delete' ? 'Delete' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
