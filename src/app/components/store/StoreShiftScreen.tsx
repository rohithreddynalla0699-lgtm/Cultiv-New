import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';

export function StoreShiftScreen() {
  const { session, scopedEmployees, clockInEmployee, clockOutEmployee } = useAdminDashboard();
  const [pinInput, setPinInput] = useState('');
  const [message, setMessage] = useState('Enter employee PIN to start or end shift.');

  if (!session || session.role !== 'store' || !session.storeId) {
    return <Navigate to="/operations" replace />;
  }

  const storeEmployees = useMemo(
    () => scopedEmployees.filter((employee) => employee.storeId === session.storeId && employee.isActive),
    [scopedEmployees, session.storeId]
  );
  const onShiftEmployees = storeEmployees.filter((employee) => employee.status === 'on_shift');

  const handleSubmit = () => {
    const pin = pinInput.trim();
    if (!/^\d{6}$/.test(pin)) {
      setMessage('Enter a valid 6-digit employee PIN.');
      return;
    }

    const employee = storeEmployees.find((entry) => entry.pin === pin);
    if (!employee) {
      setMessage('PIN did not match an active employee in this store.');
      setPinInput('');
      return;
    }

    if (employee.status === 'on_shift') {
      clockOutEmployee(employee.id);
      setMessage(`${employee.name} shift ended.`);
    } else {
      clockInEmployee(employee.id);
      setMessage(`${employee.name} shift started.`);
    }

    setPinInput('');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,243,0.9))] p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Shift Control</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">Start or end shift by employee PIN.</h2>
            <p className="mt-2 text-sm text-foreground/64">Owner/admin assign PINs in Employees. Team members use the same PIN here to clock in or out.</p>
          </div>
          <div className="rounded-full bg-white/86 px-4 py-2 text-sm font-medium text-foreground/68">On shift now: {onShiftEmployees.length}</div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,320px)_auto]">
          <label className="block text-sm text-foreground/68">
            <span className="mb-2 block font-medium">Employee PIN</span>
            <input
              data-testid="store-shift-pin-input"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit PIN"
              className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary"
            />
          </label>
          <button
            data-testid="store-shift-pin-submit"
            type="button"
            onClick={handleSubmit}
            className="h-fit self-end rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Submit PIN
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-primary/10 bg-white/86 px-4 py-3 text-sm text-foreground/68">{message}</div>
      </div>

      <div className="rounded-[24px] border border-primary/12 bg-white/92 p-4 shadow-[0_12px_30px_rgba(45,80,22,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Currently On Shift</p>
        <div className="mt-3 space-y-2">
          {onShiftEmployees.length > 0 ? (
            onShiftEmployees.map((employee) => (
              <div key={employee.id} className="rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{employee.name}</p>
                <p className="mt-1 text-xs text-foreground/62">{employee.role} · PIN ending {employee.pin.slice(-2)}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-primary/10 bg-[#F7FAF3] px-4 py-3 text-sm text-foreground/62">
              No active shifts right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
