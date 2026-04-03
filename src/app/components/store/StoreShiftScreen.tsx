import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from '../admin/SectionHeader';
import { StatusBadge } from '../admin/StatusBadge';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { employeeShiftService, type ShiftDashboardEmployee, type ShiftToggleResult } from '../../services/employeeShiftService';

type ShiftMessageTone = 'info' | 'success' | 'error';

type ShiftMessage = {
  tone: ShiftMessageTone;
  text: string;
};

const ROLE_LABELS = {
  kitchen: 'Kitchen',
  counter: 'Counter',
  manager: 'Manager',
} as const;

const MESSAGE_STYLES: Record<ShiftMessageTone, string> = {
  info: 'border-primary/10 bg-white/86 text-foreground/68',
  success: 'border-[#B7DCCB] bg-[#DDF1E8] text-[#1F6A49]',
  error: 'border-[#E7B5B5] bg-[#F7DDDD] text-[#8B2E2E]',
};

const formatDisplayDate = (date: Date) => date.toLocaleDateString([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatDisplayTime = (value: string | null) => {
  if (!value) return 'Not clocked in';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatHours = (value: number) => `${value.toFixed(2)} hrs`;

export function StoreShiftScreen() {
  const { session, activeStoreScope, activeStore } = useAdminDashboard();
  const { session: storeSession, startSession, endSession } = useStoreSession();
  const [message, setMessage] = useState<ShiftMessage>({ tone: 'info', text: 'Use each employee card to enter PIN and clock in or out.' });
  const [dashboard, setDashboard] = useState<ShiftDashboardEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});

  const loadDashboard = useCallback(async () => {
    if (!activeStore || !session || session.scopeType !== 'store' || activeStoreScope === 'all') {
      return;
    }

    setIsLoading(true);
    try {
      const nextDashboard = await employeeShiftService.loadDashboard(session);
      setDashboard(nextDashboard.employees);
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not load shift dashboard.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, activeStoreScope, session]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!session || session.scopeType !== 'store' || !session.scopeStoreId || activeStoreScope === 'all' || !activeStore) {
    return <Navigate to="/operations" replace />;
  }

  const onShiftEmployees = dashboard.filter((employee) => employee.status === 'on_shift');

  const handleSessionState = useCallback(async (result: ShiftToggleResult) => {
    if (result.action === 'clock_in') {
      await startSession(
        result.employeeId,
        result.employeeName,
        employeeShiftService.getRoleForSession(result.employeeRole),
        activeStoreScope,
        activeStore.name,
        result.shiftId,
      );
      return;
    }

    if (storeSession?.employee_id === result.employeeId) {
      await endSession();
    }
  }, [activeStore.name, activeStoreScope, endSession, startSession, storeSession?.employee_id]);

  const handleSubmit = useCallback(async (employee: ShiftDashboardEmployee) => {
    const pin = (pinInputs[employee.employeeId] ?? '').trim();
    if (!/^\d{6}$/.test(pin)) {
      setMessage({ tone: 'error', text: 'Enter a valid 6-digit employee PIN.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await employeeShiftService.submitPin(session, employee.employeeId, pin);
      await handleSessionState(result);
      setMessage({
        tone: 'success',
        text: result.action === 'clock_in' ? `${result.employeeName} clocked in.` : `${result.employeeName} clocked out.`,
      });
      setPinInputs((previous) => ({ ...previous, [employee.employeeId]: '' }));
      await loadDashboard();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Shift action failed. Please retry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSessionState, loadDashboard, pinInputs, session]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Shift Control"
        title="Clock in and out from each employee card."
        description="Keep shift tracking lightweight for store ops with employee-specific PIN confirmation."
        action={<div className="flex flex-wrap gap-2"><div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{activeStore.name}</div><div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{formatDisplayDate(new Date())}</div><div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">On shift: {onShiftEmployees.length}</div></div>}
      />

      <section className="rounded-[24px] border border-primary/12 bg-white/92 p-4 shadow-[0_12px_30px_rgba(45,80,22,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Currently On Shift</p>
        <div className="mt-3 space-y-2">
          {onShiftEmployees.length > 0 ? (
            onShiftEmployees.map((employee) => (
              <div key={`active-${employee.employeeId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{employee.name}</p>
                  <p className="mt-1 text-xs text-foreground/62">{ROLE_LABELS[employee.role]} · Clock in {formatDisplayTime(employee.clockInAt)}</p>
                </div>
                <StatusBadge status="on_shift" label="On Shift" />
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/62">No active shifts right now.</div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,243,0.9))] p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
        <div className="rounded-2xl border border-primary/10 bg-white/82 px-4 py-3 text-sm text-foreground/64">
          <p className="font-medium text-foreground">Current terminal operator</p>
          <p className="mt-1">{storeSession ? `${storeSession.employee_name} · ${storeSession.employee_role === 'store_manager' ? 'Store Manager' : 'Staff'}` : 'No active operator session on this device.'}</p>
        </div>
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${MESSAGE_STYLES[message.tone]}`}>{message.text}</div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Employee roster</p>
          {isLoading ? <p className="text-sm text-foreground/56">Refreshing shift data...</p> : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {dashboard.map((employee) => (
            <article key={employee.employeeId} className="rounded-[24px] border border-primary/12 bg-white/92 p-4 shadow-[0_12px_30px_rgba(45,80,22,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-[-0.02em] text-foreground">{employee.name}</p>
                  <p className="mt-1 text-sm text-foreground/58">{ROLE_LABELS[employee.role]}</p>
                </div>
                <StatusBadge status={employee.status} label={employee.status === 'on_shift' ? 'On Shift' : 'Off Shift'} />
              </div>

              <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3">
                {employee.status === 'on_shift' ? (
                  <p className="text-sm text-foreground/66">Clock in: <span className="font-semibold text-foreground">{formatDisplayTime(employee.clockInAt)}</span></p>
                ) : (
                  <p className="text-sm text-foreground/66">Clock in: <span className="font-semibold text-foreground">Not active</span></p>
                )}
                <p className="mt-2 text-sm text-foreground/66">Worked today: <span className="font-semibold text-foreground">{formatHours(employee.todayHours)}</span></p>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-foreground/55">PIN</label>
                <input
                  data-testid={`store-shift-pin-input-${employee.employeeId}`}
                  value={pinInputs[employee.employeeId] ?? ''}
                  onChange={(event) => setPinInputs((previous) => ({
                    ...previous,
                    [employee.employeeId]: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleSubmit(employee);
                    }
                  }}
                  placeholder="Enter 6-digit PIN"
                  className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>

              <button
                type="button"
                data-testid={`store-shift-submit-${employee.employeeId}`}
                onClick={() => void handleSubmit(employee)}
                disabled={isSubmitting || isLoading}
                className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {employee.status === 'on_shift' ? 'Clock Out' : 'Clock In'}
              </button>
            </article>
          ))}

          {!isLoading && dashboard.length === 0 ? (
            <div className="rounded-[24px] border border-primary/12 bg-white/92 p-5 text-sm text-foreground/62">
              No active employees are configured for this store yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-x-auto rounded-[24px] border border-primary/12 bg-white/92 shadow-[0_12px_30px_rgba(45,80,22,0.08)]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 border-b border-primary/10 bg-[#F7FAF3] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <p>Employee Name</p>
            <p>Today Hours</p>
            <p>Week Hours</p>
            <p>Month Hours</p>
          </div>
          <div className="divide-y divide-primary/8">
            {dashboard.map((employee) => (
              <div key={`summary-${employee.employeeId}`} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{employee.name}</p>
                  <p className="mt-1 text-sm text-foreground/58">{ROLE_LABELS[employee.role]}</p>
                </div>
                <p className="text-sm font-medium text-foreground/72">{formatHours(employee.todayHours)}</p>
                <p className="text-sm font-medium text-foreground/72">{formatHours(employee.weekHours)}</p>
                <p className="text-sm font-medium text-foreground/72">{formatHours(employee.monthHours)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
