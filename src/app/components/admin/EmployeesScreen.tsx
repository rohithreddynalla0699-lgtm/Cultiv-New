import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { EmployeeShiftCard } from './EmployeeShiftCard';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { EmployeeInput, EmployeeRole, EmployeeShift } from '../../types/admin';

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const getShiftHours = (shift: EmployeeShift) => shift.totalHoursWorked;

const formatShiftTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ROLE_OPTIONS: EmployeeRole[] = ['kitchen', 'counter', 'manager'];

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
    stores,
    scopedEmployees,
    addEmployee,
    updateEmployee,
    permissions,
    activeStoreScope,
    activeStore,
    getStoreName,
  } = useAdminDashboard();
  const defaultStoreId = activeStoreScope === 'all' ? (stores.find((store) => store.isActive)?.id ?? stores[0]?.id ?? '') : activeStoreScope;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(createEmptyEmployeeForm(defaultStoreId));
  const [message, setMessage] = useState('Shift attendance stays lightweight while employee records stay clean.');
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  const visibleStores = useMemo(() => stores.filter((store) => store.isActive || store.id === form.storeId), [form.storeId, stores]);
  const historyCount = useMemo(() => scopedEmployees.reduce((sum, employee) => sum + employee.shifts.filter((shift) => activeStoreScope === 'all' || shift.storeId === activeStoreScope).length, 0), [activeStoreScope, scopedEmployees]);

  if (!permissions.canManageEmployees) {
    return <Navigate to="/operations" replace />;
  }

  const openCreate = () => {
    setEditingEmployeeId(null);
    setForm(createEmptyEmployeeForm(defaultStoreId));
    setEditorOpen(true);
    setMessage('Add an employee and assign their home store and role.');
  };

  const openEdit = (employee: { id: string; name: string; role: EmployeeRole; storeId: string; pin: string; phone?: string; isActive: boolean }) => {
    setEditingEmployeeId(employee.id);
    setForm({
      name: employee.name,
      role: employee.role,
      storeId: employee.storeId,
      pin: employee.pin,
      phone: employee.phone ?? '',
      isActive: employee.isActive,
    });
    setEditorOpen(true);
    setMessage(`Editing ${employee.name}.`);
  };

  const handleSubmit = () => {
    const result = editingEmployeeId ? updateEmployee(editingEmployeeId, form) : addEmployee(form);
    setMessage(result.message);
    if (result.success) {
      closeEditor();
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingEmployeeId(null);
    setForm(createEmptyEmployeeForm(defaultStoreId));
  };

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Employees" title="Track shifts with one tap." description="A lightweight view of who is on shift, how long they have worked today, and their running week/month hours for future payout calculations." action={<div className="flex flex-wrap gap-2"><div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">Shift entries: {historyCount}</div>{permissions.canManageEmployees ? <button data-testid="employees-add-btn" type="button" onClick={openCreate} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add Employee</button> : null}</div>} />

      {permissions.canManageEmployees ? (
        <div className="rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,243,0.9))] p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
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
                <input data-testid="employee-form-pin" value={form.pin} onChange={(event) => setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="6-digit PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm text-foreground/68">
                <span className="mb-2 block font-medium">Phone</span>
                <input value={form.phone ?? ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Optional" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-primary/12 bg-white/86 px-4 py-3 text-sm text-foreground/72 xl:col-span-2">
                <span className="font-medium">Employee active</span>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2 xl:col-span-3">
                <button data-testid="employee-form-submit" type="button" onClick={handleSubmit} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{editingEmployeeId ? 'Save changes' : 'Create employee'}</button>
                <button type="button" onClick={closeEditor} className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72">Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {scopedEmployees.map((employee) => {
          const today = new Date();
          const weekStart = new Date();
          weekStart.setDate(today.getDate() - 7);
          const monthStart = new Date();
          monthStart.setDate(today.getDate() - 30);

          const relevantShifts = employee.shifts.filter((shift) => activeStoreScope === 'all' || shift.storeId === activeStoreScope);

          const todayHours = relevantShifts.filter((shift) => isSameDay(new Date(shift.loginAt), today)).reduce((sum, shift) => sum + getShiftHours(shift), 0);
          const weekHours = relevantShifts.filter((shift) => new Date(shift.loginAt) >= weekStart).reduce((sum, shift) => sum + getShiftHours(shift), 0);
          const monthHours = relevantShifts.filter((shift) => new Date(shift.loginAt) >= monthStart).reduce((sum, shift) => sum + getShiftHours(shift), 0);

          return (
            <div key={employee.id} className="space-y-3">
              <EmployeeShiftCard
                employee={employee}
                storeName={activeStoreScope === 'all' ? getStoreName(employee.storeId) : undefined}
                todayHours={todayHours}
                weekHours={weekHours}
                monthHours={monthHours}
                onEdit={permissions.canManageEmployees ? () => openEdit(employee) : undefined}
              />

              <div className="rounded-[24px] border border-primary/12 bg-white/88 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Shift history</p>
                  <button
                    type="button"
                    onClick={() => setExpandedHistory((previous) => ({ ...previous, [employee.id]: !previous[employee.id] }))}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {expandedHistory[employee.id] ? 'Hide' : 'Show'} history
                  </button>
                </div>

                {expandedHistory[employee.id] ? (
                  <div className="mt-3 space-y-2">
                    {relevantShifts.slice(0, 4).map((shift) => (
                      <div key={shift.id} className="rounded-2xl bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/66">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{new Date(shift.loginAt).toLocaleDateString()}</span>
                          <span className="font-medium text-foreground">{shift.totalHoursWorked.toFixed(1)}h</span>
                        </div>
                        <p className="mt-1">{formatShiftTime(shift.loginAt)} - {shift.logoutAt ? formatShiftTime(shift.logoutAt) : 'Active now'}{activeStoreScope === 'all' ? ` · ${getStoreName(shift.storeId)}` : ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-foreground/58">Recent shifts are collapsed to keep the roster scannable.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}