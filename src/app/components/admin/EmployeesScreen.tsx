import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { EmployeeShiftCard } from './EmployeeShiftCard';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { EmployeeInput, EmployeeRole, EmployeeRecord, EmployeeShift } from '../../types/admin';
import { employeeAdminService, type EmployeeDashboardRow } from '../../services/employeeAdminService';
import { credentialsAdminService } from '../../services/credentialsAdminService';
import type { InternalEmployeeDashboardPeriod } from '../../lib/internalOpsApi';

const formatShiftTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatShiftDate = (value: string) => new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

const ROLE_OPTIONS: EmployeeRole[] = ['kitchen', 'counter', 'manager'];
const PERIOD_OPTIONS: Array<{ value: InternalEmployeeDashboardPeriod; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
];
const VISIBILITY_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
] as const;

type EmployeeVisibilityFilter = typeof VISIBILITY_OPTIONS[number]['value'];

interface DeleteConfirmationState {
  show: boolean;
  employeeId: string | null;
  employeeName: string;
  action: 'delete' | 'deactivate';
  isDeleting: boolean;
}

interface ResetPinState {
  show: boolean;
  employeeId: string | null;
  employeeName: string;
  newPin: string;
  isSubmitting: boolean;
}

const createEmptyEmployeeForm = (storeId: string): EmployeeInput => ({
  name: '',
  role: 'kitchen',
  storeId,
  pin: '',
  phone: '',
  isActive: true,
});

export function EmployeesScreen() {
  const {
    session,
    stores,
    permissions,
    activeStoreScope,
    activeStore,
  } = useAdminDashboard();
  const defaultStoreId = activeStoreScope === 'all' ? (stores.find((store) => store.isActive)?.id ?? stores[0]?.id ?? '') : activeStoreScope;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(createEmptyEmployeeForm(defaultStoreId));
  const [message, setMessage] = useState('Shift attendance stays lightweight while employee records stay clean.');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [employees, setEmployees] = useState<EmployeeDashboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<InternalEmployeeDashboardPeriod>('this_week');
  const [visibilityFilter, setVisibilityFilter] = useState<EmployeeVisibilityFilter>('active');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
    show: false,
    employeeId: null,
    employeeName: '',
    action: 'delete',
    isDeleting: false,
  });
  const [resetPinState, setResetPinState] = useState<ResetPinState>({
    show: false,
    employeeId: null,
    employeeName: '',
    newPin: '',
    isSubmitting: false,
  });
  const latestDashboardRequestIdRef = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const activeStoreCode = activeStore?.code ?? null;

  const visibleStores = useMemo(() => stores.filter((store) => store.isActive || store.id === form.storeId), [form.storeId, stores]);
  const scopedEmployees = useMemo(
    () => employees.filter((employee) => activeStoreScope === 'all' || employee.storeCode === activeStoreCode),
    [activeStoreCode, activeStoreScope, employees],
  );
  const visibleEmployees = useMemo(
    () => scopedEmployees.filter((employee) => {
      if (visibilityFilter === 'active') return employee.isActive;
      if (visibilityFilter === 'inactive') return !employee.isActive;
      return true;
    }),
    [scopedEmployees, visibilityFilter],
  );
  const historyCount = useMemo(() => visibleEmployees.reduce((sum, employee) => sum + employee.recentShifts.length, 0), [visibleEmployees]);

  const loadEmployees = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = latestDashboardRequestIdRef.current + 1;
    latestDashboardRequestIdRef.current = requestId;

    if (!session) {
      if (requestId !== latestDashboardRequestIdRef.current) return;
      setEmployees([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const dashboard = await employeeAdminService.loadDashboard(session, selectedPeriod);
      if (requestId !== latestDashboardRequestIdRef.current) return;
      setEmployees(dashboard.employees);
      setLoadError(null);
    } catch (error) {
      if (requestId !== latestDashboardRequestIdRef.current) return;
      const nextError = error instanceof Error ? error.message : 'Could not load employees.';
      setLoadError(nextError);
      setMessage(nextError);
    } finally {
      if (requestId !== latestDashboardRequestIdRef.current) return;
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [selectedPeriod, session]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!session) return;

    const handleFocus = () => {
      void loadEmployees({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadEmployees({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadEmployees, session]);

  if (!permissions.canManageEmployees) {
    return <Navigate to="/operations" replace />;
  }

  const openCreate = () => {
    setEditingEmployeeId(null);
    setForm(createEmptyEmployeeForm(defaultStoreId));
    setEditorOpen(true);
    setMessage('Add an employee and assign their home store and role.');
  };

  const openEdit = (employee: { id: string; name: string; role: EmployeeRole; storeId: string; phone?: string | null; isActive: boolean }) => {
    const matchedStore = stores.find((store) => store.code === employee.storeId) ?? null;
    setEditingEmployeeId(employee.id);
    setForm({
      name: employee.name,
      role: employee.role,
      storeId: matchedStore?.id ?? defaultStoreId,
      pin: '',
      phone: employee.phone ?? '',
      isActive: employee.isActive,
    });
    setEditorOpen(true);
    setMessage(`Editing ${employee.name}. Leave PIN empty to keep the current PIN.`);
  };

  const handleSubmit = async () => {
    if (!session) {
      setMessage('Internal session expired. Please sign in again.');
      return;
    }

    try {
      const selectedStore = stores.find((store) => store.id === form.storeId) ?? null;
      await employeeAdminService.upsertEmployee(session, {
        employeeId: editingEmployeeId ?? undefined,
        name: form.name,
        role: form.role,
        storeCode: selectedStore?.code,
        pin: form.pin.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        isActive: form.isActive,
      });

      setMessage(editingEmployeeId ? 'Employee updated.' : 'Employee added.');
      closeEditor();
      await loadEmployees();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save employee.');
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingEmployeeId(null);
    setForm(createEmptyEmployeeForm(defaultStoreId));
  };

  const openDeleteConfirmation = (employeeId: string, employeeName: string, action: 'delete' | 'deactivate') => {
    setDeleteConfirmation({ show: true, employeeId, employeeName, action, isDeleting: false });
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({ show: false, employeeId: null, employeeName: '', action: 'delete', isDeleting: false });
  };

  const openResetPin = (employeeId: string, employeeName: string) => {
    setResetPinState({
      show: true,
      employeeId,
      employeeName,
      newPin: '',
      isSubmitting: false,
    });
  };

  const closeResetPin = () => {
    setResetPinState({
      show: false,
      employeeId: null,
      employeeName: '',
      newPin: '',
      isSubmitting: false,
    });
  };

  const confirmDelete = async () => {
    if (!session || !deleteConfirmation.employeeId) {
      setMessage('Internal session expired. Please sign in again.');
      closeDeleteConfirmation();
      return;
    }

    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      const result = deleteConfirmation.action === 'delete'
        ? await employeeAdminService.deleteEmployee(session, deleteConfirmation.employeeId)
        : await employeeAdminService.deactivateEmployee(session, deleteConfirmation.employeeId);
      setMessage(result.message);
      closeEditor();
      closeDeleteConfirmation();
      await loadEmployees();
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : deleteConfirmation.action === 'delete'
          ? 'Could not delete employee.'
          : 'Could not deactivate employee.';
      setMessage(errorMessage);
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const confirmResetPin = async () => {
    if (!session || !resetPinState.employeeId) {
      setMessage('Internal session expired. Please sign in again.');
      closeResetPin();
      return;
    }

    if (!/^\d{6}$/.test(resetPinState.newPin)) {
      setMessage('Use a valid 6-digit shift PIN.');
      return;
    }

    setResetPinState((previous) => ({ ...previous, isSubmitting: true }));

    try {
      const result = await credentialsAdminService.updateEmployeePin(session, resetPinState.employeeId, resetPinState.newPin);
      setMessage(result.message);
      closeResetPin();
      await loadEmployees({ silent: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not update employee shift PIN.';
      setMessage(errorMessage);
      setResetPinState((previous) => ({ ...previous, isSubmitting: false }));
    }
  };

  useEffect(() => {
    if (editorOpen && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editorOpen]);

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Employees" title="Track shifts with one tap." description="A lightweight view of who is on shift, how long they have worked, and recent real shift history for manual cash payout review." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadEmployees()} className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72">Refresh</button><div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">Shift entries: {historyCount}</div><button data-testid="employees-add-btn" type="button" onClick={openCreate} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add Employee</button></div>} />

      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => setSelectedPeriod(period.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${selectedPeriod === period.value ? 'bg-primary text-primary-foreground' : 'border border-primary/12 bg-white text-foreground/72'}`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setVisibilityFilter(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${visibilityFilter === option.value ? 'bg-primary text-primary-foreground' : 'border border-primary/12 bg-white text-foreground/72'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="rounded-[24px] border border-[#D9A06A]/35 bg-[#FFF7F0] p-4 text-sm text-[#8A4B16]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadEmployees()} className="rounded-full border border-[#D9A06A]/35 bg-white px-4 py-2 text-sm font-medium text-[#8A4B16]">Retry</button>
          </div>
        </div>
      ) : null}

      <div ref={editorRef} className="rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,243,0.9))] p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Employee Records</p>
              <p className="mt-2 text-sm text-foreground/64">{message}</p>
            </div>
            <div className="rounded-full bg-white/86 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore?.name ?? 'All stores'}</div>
          </div>

          {editorOpen ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <label className="block text-sm text-foreground/68 xl:col-span-2">
                <span className="mb-2 block font-medium">Employee Name</span>
                <input data-testid="employee-form-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Role</span>
                <select data-testid="employee-form-role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as EmployeeRole }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary">
                  {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Assigned Store</span>
                <select data-testid="employee-form-store" value={form.storeId} onChange={(event) => setForm((current) => ({ ...current, storeId: event.target.value }))} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary">
                  {visibleStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Shift PIN</span>
                <input
                  data-testid="employee-form-pin"
                  value={form.pin}
                  onChange={(event) => setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder={editingEmployeeId ? 'Leave blank to keep current PIN' : '6-digit PIN'}
                  className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary"
                />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Phone</span>
                <input value={form.phone ?? ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Optional" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72 xl:col-span-2">
                <span className="font-medium">Employee active</span>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
              <div className={`grid gap-2 ${editingEmployeeId ? 'sm:grid-cols-5' : 'sm:grid-cols-2'} xl:col-span-3`}>
                <button data-testid="employee-form-submit" type="button" onClick={handleSubmit} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{editingEmployeeId ? 'Save changes' : 'Create employee'}</button>
                <button type="button" onClick={closeEditor} className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72">Cancel</button>
                {editingEmployeeId ? (
                  <button
                    type="button"
                    onClick={() => openResetPin(editingEmployeeId, form.name)}
                    className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72"
                  >
                    Reset Shift PIN
                  </button>
                ) : null}
                {editingEmployeeId ? (
                  <button
                    type="button"
                    onClick={() => openDeleteConfirmation(editingEmployeeId, form.name, 'deactivate')}
                    disabled={!form.isActive}
                    className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm font-medium text-amber-800 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                ) : null}
                {editingEmployeeId ? (
                  <button
                    type="button"
                    onClick={() => openDeleteConfirmation(editingEmployeeId, form.name, 'delete')}
                    className="rounded-2xl border border-red-300/50 bg-red-50/60 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleEmployees.map((employee) => {
          const cardEmployee: EmployeeRecord = {
            id: employee.employeeId,
            name: employee.name,
            role: employee.role,
            storeId: employee.storeId,
            pin: '',
            phone: employee.phone ?? undefined,
            isActive: employee.isActive,
            createdAt: '',
            status: employee.shiftStatus,
            shifts: employee.recentShifts.map((shift): EmployeeShift => ({
              id: shift.shiftId,
              employeeId: employee.employeeId,
              storeId: employee.storeId,
              loginAt: shift.clockInAt,
              logoutAt: shift.clockOutAt ?? undefined,
              totalHoursWorked: shift.totalHours,
            })),
          };

          return (
            <div key={employee.employeeId} className="space-y-3">
              <EmployeeShiftCard
                employee={cardEmployee}
                storeName={activeStoreScope === 'all' ? (stores.find((store) => store.code === employee.storeCode)?.name ?? 'Unknown store') : undefined}
                summaryLabel={employee.summaryLabel}
                summaryHours={employee.summaryHours}
                todayHours={employee.todayHours}
                weekHours={employee.weekHours}
                monthHours={employee.monthHours}
                onEdit={() => openEdit({
                  id: employee.employeeId,
                  name: employee.name,
                  role: employee.role,
                  storeId: employee.storeCode,
                  phone: employee.phone,
                  isActive: employee.isActive,
                })}
              />

              <div className="rounded-[24px] border border-primary/12 bg-white/88 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Shift history · {employee.summaryLabel}</p>
                  <button
                    type="button"
                    onClick={() => setExpandedHistory((previous) => ({ ...previous, [employee.employeeId]: !previous[employee.employeeId] }))}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {expandedHistory[employee.employeeId] ? 'Hide' : 'Show'} history
                  </button>
                </div>

                {expandedHistory[employee.employeeId] ? (
                  employee.recentShifts.length > 0 ? (
                    <div className="mt-3 space-y-2">
                    {employee.recentShifts.slice(0, 8).map((shift) => (
                      <div key={shift.shiftId} className="rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/66">
                        <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-center">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/55">Date</p>
                            <p className="mt-1 text-sm text-foreground">{formatShiftDate(shift.clockInAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/55">Clock in</p>
                            <p className="mt-1 text-sm text-foreground">{formatShiftTime(shift.clockInAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/55">Clock out</p>
                            <p className="mt-1 text-sm text-foreground">{shift.clockOutAt ? formatShiftTime(shift.clockOutAt) : 'Active now'}</p>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/55">Total</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{shift.totalHours.toFixed(1)}h</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-foreground/58">No shifts found for {employee.summaryLabel.toLowerCase()}.</p>
                  )
                ) : (
                  <p className="mt-2 text-sm text-foreground/58">Recent shifts are collapsed to keep the roster scannable.</p>
                )}
              </div>
            </div>
          );
        })}

        {!isLoading && visibleEmployees.length === 0 ? (
          <div className="rounded-[24px] border border-primary/12 bg-white/92 p-5 text-sm text-foreground/62">
            No employees found for the current scope.
          </div>
        ) : null}
      </div>

      {deleteConfirmation.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-w-sm rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">Delete this employee?</p>
            <p className="mt-2 text-sm text-foreground/72">
              {deleteConfirmation.action === 'delete'
                ? `Delete ${deleteConfirmation.employeeName}. This is permanent and will be rejected if shift history exists.`
                : `Deactivate ${deleteConfirmation.employeeName}. This keeps history but removes active access.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deleteConfirmation.isDeleting}
                className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 disabled:opacity-50"
              >
                Keep employee
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirmation.isDeleting}
                className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  deleteConfirmation.action === 'delete'
                    ? 'border border-red-300/50 bg-red-50/60 text-red-700'
                    : 'border border-amber-300/50 bg-amber-50/60 text-amber-800'
                }`}
              >
                {deleteConfirmation.isDeleting
                  ? deleteConfirmation.action === 'delete' ? 'Deleting...' : 'Deactivating...'
                  : deleteConfirmation.action === 'delete' ? 'Delete' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetPinState.show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-w-sm rounded-[28px] border border-primary/12 bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold text-foreground">Reset shift PIN</p>
            <p className="mt-2 text-sm text-foreground/72">Set a new 6-digit shift PIN for {resetPinState.employeeName}.</p>
            <label className="mt-4 block text-sm text-foreground/68">
              <span className="mb-2 block font-medium">New shift PIN</span>
              <input
                value={resetPinState.newPin}
                onChange={(event) => setResetPinState((previous) => ({ ...previous, newPin: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="6-digit PIN"
                className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary"
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeResetPin}
                disabled={resetPinState.isSubmitting}
                className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmResetPin()}
                disabled={resetPinState.isSubmitting}
                className="flex-1 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {resetPinState.isSubmitting ? 'Updating…' : 'Update PIN'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
