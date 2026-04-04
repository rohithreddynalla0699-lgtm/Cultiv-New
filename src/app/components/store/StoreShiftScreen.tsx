import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { SectionHeader } from '../admin/SectionHeader';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { employeeShiftService, type ShiftDashboardEmployee, type ShiftToggleResult } from '../../services/employeeShiftService';

type CardFeedback = {
  tone: 'success' | 'error';
  text: string;
};

const ROLE_LABELS = {
  kitchen: 'Kitchen',
  counter: 'Counter',
  manager: 'Manager',
} as const;

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
  const [dashboard, setDashboard] = useState<ShiftDashboardEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [pinVisibility, setPinVisibility] = useState<Record<string, boolean>>({});
  const [cardFeedback, setCardFeedback] = useState<Record<string, CardFeedback | undefined>>({});
  const [activeSubmitEmployeeId, setActiveSubmitEmployeeId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const feedbackTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const setScopedCardFeedback = useCallback((employeeId: string, feedback?: CardFeedback) => {
    const currentTimer = feedbackTimeoutRefs.current[employeeId];
    if (currentTimer) {
      clearTimeout(currentTimer);
      feedbackTimeoutRefs.current[employeeId] = null;
    }

    setCardFeedback((previous) => ({ ...previous, [employeeId]: feedback }));

    if (!feedback) return;

    const timeoutMs = feedback.tone === 'success' ? 2800 : 3500;
    feedbackTimeoutRefs.current[employeeId] = setTimeout(() => {
      setCardFeedback((previous) => ({ ...previous, [employeeId]: undefined }));
      feedbackTimeoutRefs.current[employeeId] = null;
    }, timeoutMs);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!activeStore || !session || session.scopeType !== 'store' || activeStoreScope === 'all') {
      return;
    }

    setIsLoading(true);
    try {
      const nextDashboard = await employeeShiftService.loadDashboard(session);
      setDashboard(nextDashboard.employees);
      setDashboardError(null);
    } catch {
      setDashboardError('Could not load shift data. Please refresh and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, activeStoreScope, session]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => () => {
    for (const timer of Object.values(feedbackTimeoutRefs.current)) {
      if (timer) clearTimeout(timer);
    }
  }, []);

  if (!session || session.scopeType !== 'store' || !session.scopeStoreId || activeStoreScope === 'all' || !activeStore) {
    return <Navigate to="/operations" replace />;
  }

  const onShiftEmployees = dashboard.filter((employee) => employee.status === 'on_shift');
  const compactSummary = `${activeStore.name} · ${formatDisplayDate(new Date())} · ${onShiftEmployees.length} on shift`;

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
      setScopedCardFeedback(employee.employeeId, { tone: 'error', text: 'Enter a valid 6-digit employee PIN.' });
      pinInputRefs.current[employee.employeeId]?.focus();
      return;
    }

    setIsSubmitting(true);
    setActiveSubmitEmployeeId(employee.employeeId);
    try {
      const result = await employeeShiftService.submitPin(session, employee.employeeId, pin);
      await handleSessionState(result);
      setPinInputs((previous) => ({ ...previous, [employee.employeeId]: '' }));
      setScopedCardFeedback(employee.employeeId, {
        tone: 'success',
        text: result.action === 'clock_in' ? 'Clocked in successfully.' : 'Clocked out successfully.',
      });
      await loadDashboard();
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Shift action failed. Please retry.';
      if (errorText === 'Incorrect PIN') {
        setScopedCardFeedback(employee.employeeId, { tone: 'error', text: 'Incorrect PIN' });
        pinInputRefs.current[employee.employeeId]?.focus();
      } else {
        setScopedCardFeedback(employee.employeeId, { tone: 'error', text: errorText });
      }
    } finally {
      setIsSubmitting(false);
      setActiveSubmitEmployeeId(null);
    }
  }, [handleSessionState, loadDashboard, pinInputs, session, setScopedCardFeedback]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Shift Control"
        title="Clock in and out from each employee card."
        description={compactSummary}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Employee roster</p>
          {isLoading ? <p className="text-sm text-foreground/56">Refreshing shift data...</p> : null}
        </div>

        {dashboardError ? (
          <div className="rounded-2xl border border-[#E7B5B5] bg-[#F7DDDD] px-4 py-3 text-sm text-[#8B2E2E]">
            <p>{dashboardError}</p>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="mt-2 rounded-lg border border-[#8B2E2E]/25 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#8B2E2E]"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {dashboard.map((employee) => (
            <article key={employee.employeeId} className="rounded-[24px] border border-primary/12 bg-white/92 p-4 shadow-[0_12px_30px_rgba(45,80,22,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-[-0.02em] text-foreground">{employee.name}</p>
                  <p className="mt-1 text-sm text-foreground/58">{ROLE_LABELS[employee.role]}</p>
                    <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] transition-all duration-300 ${employee.status === 'on_shift' ? 'border border-[#B7DCCB] bg-[#DDF1E8] text-[#1F6A49]' : 'border border-[#D6D9DE] bg-[#F1F3F5] text-[#5C6470]'}`}>
                      {employee.status === 'on_shift' ? `ON SHIFT${employee.clockInAt ? ` since ${formatDisplayTime(employee.clockInAt)}` : ''}` : 'OFF SHIFT'}
                    </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#F7FAF3] px-4 py-3">
                {employee.status === 'on_shift' ? (
                  <p className="text-sm text-foreground/66">Clock in: <span className="font-semibold text-foreground">{formatDisplayTime(employee.clockInAt)}</span></p>
                ) : (
                  <p className="text-sm text-foreground/66">Clock in: <span className="font-semibold text-foreground">Not active</span></p>
                )}
                <p className="mt-2 text-sm text-foreground/66">Worked today: <span className="font-semibold text-foreground">{formatHours(employee.todayHours)}</span></p>
              </div>

              <button
                type="button"
                data-testid={`store-shift-submit-${employee.employeeId}`}
                onClick={() => void handleSubmit(employee)}
                disabled={isSubmitting || isLoading}
                  className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${employee.status === 'on_shift' ? 'bg-[#B43A3A]' : 'bg-[#2D804B]'}`}
              >
                {isSubmitting && activeSubmitEmployeeId === employee.employeeId
                  ? 'Submitting...'
                  : employee.status === 'on_shift'
                    ? 'Clock Out'
                    : 'Clock In'}
              </button>

              <div className="mt-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-foreground/55">PIN</label>
                <div className="relative mt-2">
                  <input
                    data-testid={`store-shift-pin-input-${employee.employeeId}`}
                    type={pinVisibility[employee.employeeId] ? 'text' : 'password'}
                    autoComplete="off"
                    inputMode="numeric"
                    value={pinInputs[employee.employeeId] ?? ''}
                    ref={(node) => {
                      pinInputRefs.current[employee.employeeId] = node;
                    }}
                    onChange={(event) => {
                      setPinInputs((previous) => ({
                        ...previous,
                        [employee.employeeId]: event.target.value.replace(/\D/g, '').slice(0, 6),
                      }));
                      setScopedCardFeedback(employee.employeeId, undefined);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSubmit(employee);
                      }
                    }}
                    placeholder="Enter 6-digit PIN"
                    className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label={pinVisibility[employee.employeeId] ? 'Hide PIN' : 'Show PIN'}
                    onClick={() => setPinVisibility((previous) => ({
                      ...previous,
                      [employee.employeeId]: !previous[employee.employeeId],
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/55 transition-colors hover:text-foreground"
                  >
                    {pinVisibility[employee.employeeId] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className={`mt-2 transform-gpu overflow-hidden transition-all duration-300 ${cardFeedback[employee.employeeId] ? 'max-h-14 translate-y-0 opacity-100' : 'max-h-0 -translate-y-1 opacity-0'}`}>
                  <p className={`text-sm ${cardFeedback[employee.employeeId]?.tone === 'success' ? 'text-[#1F6A49]' : 'text-[#8B2E2E]'}`}>
                    {cardFeedback[employee.employeeId]?.text ?? ''}
                  </p>
                </div>
              </div>
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
