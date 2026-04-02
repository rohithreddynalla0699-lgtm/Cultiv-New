import type { EmployeeRecord } from '../../types/admin';
import { StatusBadge } from './StatusBadge';

interface EmployeeShiftCardProps {
  employee: EmployeeRecord;
  storeName?: string;
  todayHours: number;
  weekHours: number;
  monthHours: number;
  onClockIn: () => void;
  onClockOut: () => void;
  onEdit?: () => void;
}

const ROLE_LABELS = {
  kitchen: 'Kitchen',
  counter: 'Counter',
  manager: 'Manager',
} as const;

export function EmployeeShiftCard({ employee, storeName, todayHours, weekHours, monthHours, onClockIn, onClockOut, onEdit }: EmployeeShiftCardProps) {
  const activeShift = employee.shifts.find((shift) => !shift.logoutAt);
  const canStartShift = employee.status !== 'on_shift' && employee.isActive;
  const canEndShift = employee.status === 'on_shift' && employee.isActive;
  const primaryActionLabel = canEndShift ? 'End Shift' : 'Start Shift';
  const primaryAction = canEndShift ? onClockOut : onClockIn;
  const isPrimaryDisabled = !(canStartShift || canEndShift);

  return (
    <div className="rounded-[22px] border border-primary/12 bg-white/92 p-4 shadow-[0_12px_30px_rgba(45,80,22,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(45,80,22,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-[-0.02em] text-foreground">{employee.name}</p>
          <p className="mt-1 text-sm text-foreground/58">{ROLE_LABELS[employee.role]}{storeName ? ` · ${storeName}` : ''}{employee.phone ? ` · ${employee.phone}` : ''}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge status={employee.isActive ? 'active' : 'inactive'} label={employee.isActive ? 'Active' : 'Inactive'} />
          <StatusBadge status={employee.status} />
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#F7FAF3] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Today</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">{todayHours.toFixed(1)}h</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#F7FAF3] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">This week</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">{weekHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-xl bg-[#F7FAF3] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">This month</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">{monthHours.toFixed(1)}h</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground/64">
        <span>Active shift:</span>
        <span className="font-medium text-foreground/78">{activeShift ? new Date(activeShift.loginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Off shift'}</span>
      </div>

      <div className={`mt-3 grid gap-2 ${onEdit ? 'sm:grid-cols-[1fr_auto]' : 'sm:grid-cols-1'}`}>
        <button data-testid={`employee-shift-btn-${employee.id}`} type="button" onClick={primaryAction} disabled={isPrimaryDisabled} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{primaryActionLabel}</button>
        {onEdit ? <button type="button" onClick={onEdit} className="rounded-xl border border-primary/16 bg-white px-4 py-2.5 text-sm font-medium text-foreground/74">Edit</button> : null}
      </div>
    </div>
  );
}