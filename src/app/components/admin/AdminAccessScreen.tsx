import { Building2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { Logo } from '../Logo';

export function AdminAccessScreen() {
  const navigate = useNavigate();
  const { stores, loginAsAdmin, loginAsStore } = useAdminDashboard();
  const [mode, setMode] = useState<'owner' | 'store'>('owner');
  const [adminPin, setAdminPin] = useState('');
  const [storeId, setStoreId] = useState(stores.find((store) => store.isActive)?.id ?? '');
  const [storePin, setStorePin] = useState('');
  const [message, setMessage] = useState('Choose owner access or open a store workspace.');

  const activeStores = stores.filter((store) => store.isActive);

  const handleAdminLogin = () => {
    const result = loginAsAdmin(adminPin);
    setMessage(result.message);
    if (result.success) {
      navigate('/admin/summary', { replace: true });
    }
  };

  const handleStoreLogin = () => {
    const result = loginAsStore(storeId, storePin);
    setMessage(result.message);
    if (result.success) {
      navigate('/admin/summary', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(45,80,22,0.14),transparent_26%),radial-gradient(circle_at_92%_18%,rgba(126,153,108,0.18),transparent_30%),linear-gradient(160deg,#EFF3E9_0%,#F8F7F2_48%,#EDF2E6_100%)] p-4 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] border border-primary/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,246,236,0.9))] p-6 shadow-[0_24px_64px_rgba(45,80,22,0.14)] md:p-8">
            <div className="flex items-center gap-4 border-b border-primary/10 pb-5">
              <Logo variant="emblem" animated />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/58">Internal Access</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-foreground">CULTIV Control</h1>
              </div>
            </div>

            <p className="mt-6 max-w-md text-sm leading-6 text-foreground/66">
              Choose access mode and enter your 6-digit PIN.
            </p>

            <div className="mt-6 rounded-[28px] border border-primary/10 bg-white/86 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Access Modes</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid="mode-owner"
                  onClick={() => setMode('owner')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === 'owner' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Owner Login
                </button>
                <button
                  type="button"
                  data-testid="mode-store"
                  onClick={() => setMode('store')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === 'store' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Store Login
                </button>
              </div>
            </div>

          </section>

          <section className="grid gap-4">
            <div className="rounded-[32px] border border-primary/12 bg-white/92 p-6 shadow-[0_20px_52px_rgba(45,80,22,0.12)] md:p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  {mode === 'owner' ? <ShieldCheck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">{mode === 'owner' ? 'Owner Access' : 'Store Access'}</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">{mode === 'owner' ? 'All stores, all controls' : 'One store, daily operations'}</p>
                </div>
              </div>

              {mode === 'owner' ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-sm text-foreground/68">
                    <span className="mb-2 block font-medium">Owner PIN</span>
                    <input data-testid="owner-pin-input" value={adminPin} onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit owner PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                  </label>
                  <button data-testid="owner-login-button" type="button" onClick={handleAdminLogin} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Open owner panel</button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <label className="block text-sm text-foreground/68">
                    <span className="mb-2 block font-medium">Store</span>
                    <select data-testid="store-select" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary">
                      {activeStores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name} · {store.city}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-foreground/68">
                    <span className="mb-2 block font-medium">6-digit PIN</span>
                    <input data-testid="store-pin-input" value={storePin} onChange={(event) => setStorePin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Store PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                  </label>
                  <button data-testid="store-login-button" type="button" onClick={handleStoreLogin} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Open store workspace</button>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(247,250,243,0.95),rgba(255,255,255,0.88))] px-5 py-4 text-sm text-foreground/66 shadow-[0_16px_40px_rgba(45,80,22,0.08)]">
              {message}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
