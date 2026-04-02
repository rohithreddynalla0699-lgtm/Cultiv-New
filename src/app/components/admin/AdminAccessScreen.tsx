import { Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { ServerStatus } from '../../types/adminInternalAuth';
import { Logo } from '../Logo';

export function AdminAccessScreen() {
  const navigate = useNavigate();
  const { stores, loginAsAdmin, loginAsStore, serverStatus } = useAdminDashboard();
  const [mode, setMode] = useState<'owner' | 'store'>('owner');
  const [adminPin, setAdminPin] = useState('');
  const [storeId, setStoreId] = useState(stores.find((store) => store.isActive)?.id ?? '');
  const [storePin, setStorePin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [showStorePin, setShowStorePin] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [storeError, setStoreError] = useState('');

  const activeStores = stores.filter((store) => store.isActive);
  const AUTH_SERVER_UNAVAILABLE_MESSAGE = 'Auth server is unavailable. Please check the sync server or try again.';

  useEffect(() => {
    setOwnerError('');
    setStoreError('');
  }, [mode]);

  const renderStatusDot = (status: ServerStatus) => {
    if (status === 'online') return 'bg-[#1E8A3B]';
    if (status === 'offline') return 'bg-[#B42318]';
    return 'bg-foreground/35';
  };

  const renderStatusLabel = (status: ServerStatus) => {
    if (status === 'online') return 'Online';
    if (status === 'offline') return 'Offline';
    return 'Unknown';
  };

  const handleAdminLogin = async () => {
    if (isSubmitting) return;
    setOwnerError('');
    setIsSubmitting(true);
    const result = await loginAsAdmin(adminPin);
    if (result.success) {
      navigate('/admin/summary', { replace: true });
    } else {
      setOwnerError(result.message);
    }
    setIsSubmitting(false);
  };

  const handleStoreLogin = async () => {
    if (isSubmitting) return;
    setStoreError('');
    setIsSubmitting(true);
    const result = await loginAsStore(storeId, storePin);
    if (result.success) {
      navigate('/admin/summary', { replace: true });
    } else {
      setStoreError(result.message);
    }
    setIsSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="admin-ops-shell min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(45,80,22,0.14),transparent_26%),radial-gradient(circle_at_92%_18%,rgba(126,153,108,0.18),transparent_30%),linear-gradient(160deg,#EFF3E9_0%,#F8F7F2_48%,#EDF2E6_100%)] p-4 md:p-6"
    >
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
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-[1.02] active:scale-[0.99] ${mode === 'owner' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Owner Login
                </button>
                <button
                  type="button"
                  data-testid="mode-store"
                  onClick={() => setMode('store')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all hover:brightness-[1.02] active:scale-[0.99] ${mode === 'store' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Store Login
                </button>
              </div>
            </div>

          </section>

          <section className="grid gap-4">
            <div className="rounded-[32px] border border-primary/12 bg-white/92 p-6 shadow-[0_20px_52px_rgba(45,80,22,0.12)] md:min-h-[352px] md:p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  {mode === 'owner' ? <ShieldCheck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">{mode === 'owner' ? 'Owner Access' : 'Store Access'}</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">{mode === 'owner' ? 'All stores, all controls' : 'One store, daily operations'}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#F7FAF3] px-3 py-2 text-xs text-foreground/66">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${renderStatusDot(serverStatus)}`} />
                  Auth Server: {renderStatusLabel(serverStatus)}
                </span>
              </div>

              <div className="mt-5 min-h-[184px]">
                {mode === 'owner' ? (
                  <div className="space-y-3">
                  <label className="block text-sm text-foreground/68">
                    <span className="mb-2 block font-medium">Owner PIN</span>
                    <div className="relative">
                      <input data-testid="owner-pin-input" type={showOwnerPin ? 'text' : 'password'} inputMode="numeric" value={adminPin} onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit owner PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 pr-11 outline-none transition-colors focus:border-primary" />
                      <button
                        type="button"
                        aria-label={showOwnerPin ? 'Hide owner PIN' : 'Show owner PIN'}
                        onClick={() => setShowOwnerPin((value) => !value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-foreground/54 hover:bg-black/[0.04]"
                      >
                        {showOwnerPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <button data-testid="owner-login-button" type="button" disabled={isSubmitting} onClick={() => void handleAdminLogin()} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Verifying...' : 'Open owner panel'}</button>
                  {serverStatus === 'offline' ? <p className="text-sm text-[#8B2E2E]">{AUTH_SERVER_UNAVAILABLE_MESSAGE}</p> : ownerError ? <p className="text-sm text-[#8B2E2E]">{ownerError}</p> : null}
                  </div>
                ) : (
                  <div className="space-y-3">
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
                    <div className="relative">
                      <input data-testid="store-pin-input" type={showStorePin ? 'text' : 'password'} inputMode="numeric" value={storePin} onChange={(event) => setStorePin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Store PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 pr-11 outline-none transition-colors focus:border-primary" />
                      <button
                        type="button"
                        aria-label={showStorePin ? 'Hide store PIN' : 'Show store PIN'}
                        onClick={() => setShowStorePin((value) => !value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-foreground/54 hover:bg-black/[0.04]"
                      >
                        {showStorePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <button data-testid="store-login-button" type="button" disabled={isSubmitting} onClick={() => void handleStoreLogin()} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Verifying...' : 'Open store workspace'}</button>
                  {serverStatus === 'offline' ? <p className="text-sm text-[#8B2E2E]">{AUTH_SERVER_UNAVAILABLE_MESSAGE}</p> : storeError ? <p className="text-sm text-[#8B2E2E]">{storeError}</p> : null}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
