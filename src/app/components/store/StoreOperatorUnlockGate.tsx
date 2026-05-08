import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { employeeShiftService, type ShiftDashboardEmployee } from '../../services/employeeShiftService.ts';

type GateFeedback = {
  tone: 'error' | 'success';
  text: string;
};

const ROLE_LABELS = {
  kitchen: 'Kitchen',
  counter: 'Counter',
  manager: 'Manager',
} as const;

const formatDisplayTime = (value: string | null) => {
  if (!value) return 'Not clocked in';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface StoreOperatorUnlockGateProps {
  currentPath: string;
}

export function StoreOperatorUnlockGate({ currentPath }: StoreOperatorUnlockGateProps) {
  const { session, activeStoreScope, activeStore } = useAdminDashboard();
  const { startSession, isSessionLoading, sessionError } = useStoreSession();

  const [employees, setEmployees] = useState<ShiftDashboardEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<GateFeedback | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!activeStore || !session || session.scopeType !== 'store' || activeStoreScope === 'all') {
      setEmployees([]);
      setSelectedEmployeeId('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dashboard = await employeeShiftService.loadDashboard(session);
      const onShiftEmployees = dashboard.employees.filter((employee) => employee.status === 'on_shift');
      setEmployees(onShiftEmployees);
      setSelectedEmployeeId((current) => (
        current && onShiftEmployees.some((employee) => employee.employeeId === current)
          ? current
          : onShiftEmployees[0]?.employeeId ?? ''
      ));
      setFeedback(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load on-shift employees.';
      setEmployees([]);
      setSelectedEmployeeId('');
      setFeedback({ tone: 'error', text: message });
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, activeStoreScope, session]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.employeeId === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const handleUnlock = useCallback(async () => {
    if (!session || session.scopeType !== 'store' || !activeStore || activeStoreScope === 'all') {
      setFeedback({ tone: 'error', text: 'Store login is required before unlocking this terminal.' });
      return;
    }

    if (!selectedEmployee) {
      setFeedback({ tone: 'error', text: 'Select an on-shift employee to continue.' });
      return;
    }

    const normalizedPin = pin.trim();
    if (!/^\d{6}$/.test(normalizedPin)) {
      setFeedback({ tone: 'error', text: 'Enter a valid 6-digit employee PIN.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await employeeShiftService.verifyResume(session, selectedEmployee.employeeId, normalizedPin);
      const startResult = await startSession(
        result.employeeId,
        result.employeeName,
        employeeShiftService.getRoleForSession(result.employeeRole),
        activeStoreScope,
        activeStore.name,
        result.shiftId,
      );

      if (!startResult.success) {
        throw new Error(startResult.error ?? 'Could not unlock this terminal.');
      }

      setPin('');
      setFeedback({ tone: 'success', text: 'Terminal unlocked successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not unlock this terminal.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeStore, activeStoreScope, pin, selectedEmployee, session, startSession]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(22,34,14,0.34)] p-4 backdrop-blur-[2px]">
      <div className="absolute inset-0" aria-hidden="true" />
      <section className="relative z-[91] w-full max-w-xl rounded-[28px] border border-primary/14 bg-white/96 p-5 shadow-[0_24px_60px_rgba(20,35,10,0.24)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Operator Session</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">Who is operating?</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/62">
              Select an employee who is already on shift for {activeStore?.name ?? 'this store'} and enter their PIN to unlock {currentPath.replace('/store/', '')}.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">On-shift employees</p>
            {isLoading || isSessionLoading ? <p className="text-sm text-foreground/56">Loading roster...</p> : null}
          </div>

          {feedback ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.tone === 'error' ? 'border-[#E7B5B5] bg-[#F7DDDD] text-[#8B2E2E]' : 'border-[#B7DCCB] bg-[#DDF1E8] text-[#1F6A49]'}`}>
              {feedback.text}
            </div>
          ) : sessionError ? (
            <div className="rounded-2xl border border-[#E7B5B5] bg-[#F7DDDD] px-4 py-3 text-sm text-[#8B2E2E]">
              {sessionError}
            </div>
          ) : null}

          {!isLoading && employees.length === 0 ? (
            <div className="rounded-[24px] border border-primary/12 bg-[#FBFCFA] p-4">
              <p className="text-sm text-foreground/66">No employees are currently on shift for this store.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/store/shift"
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:-translate-y-0.5 hover:brightness-95"
                >
                  Go to Shift Control
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {employees.map((employee) => {
                  const isSelected = employee.employeeId === selectedEmployeeId;
                  return (
                    <button
                      key={employee.employeeId}
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(employee.employeeId);
                        setFeedback(null);
                      }}
                      className={`rounded-[22px] border px-4 py-4 text-left transition-all duration-150 ${isSelected ? 'border-primary/28 bg-primary/6 shadow-[0_10px_24px_rgba(45,80,22,0.08)]' : 'border-primary/12 bg-white hover:-translate-y-0.5 hover:border-primary/20'}`}
                    >
                      <p className="text-base font-semibold text-foreground">{employee.name}</p>
                      <p className="mt-1 text-sm text-foreground/58">{ROLE_LABELS[employee.role]}</p>
                      <p className="mt-3 inline-flex items-center rounded-full border border-[#B7DCCB] bg-[#DDF1E8] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#1F6A49]">
                        On Shift since {formatDisplayTime(employee.clockInAt)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[24px] border border-primary/12 bg-[#FBFCFA] p-4">
                <label htmlFor="store-operator-pin" className="block text-xs font-semibold uppercase tracking-[0.1em] text-foreground/55">
                  Employee PIN
                </label>
                <div className="relative mt-2">
                  <input
                    id="store-operator-pin"
                    name="employeePin"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="off"
                    inputMode="numeric"
                    value={pin}
                    onChange={(event) => {
                      setPin(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setFeedback(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleUnlock();
                      }
                    }}
                    placeholder="Enter 6-digit PIN"
                    className="w-full rounded-2xl border border-primary/12 bg-white px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    onClick={() => setShowPin((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/55 transition-colors duration-200 hover:text-foreground"
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleUnlock()}
                    disabled={isSubmitting || isSessionLoading || isLoading || !selectedEmployeeId}
                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:-translate-y-0.5 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? 'Unlocking...' : 'Unlock'}
                  </button>
                  <Link
                    to="/store/shift"
                    className="rounded-2xl border border-primary/16 bg-white px-5 py-3 text-sm font-semibold text-foreground/72 transition-all duration-150 hover:-translate-y-0.5"
                  >
                    Go to Shift Control
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
