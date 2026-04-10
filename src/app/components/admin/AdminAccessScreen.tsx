import { Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { Logo } from '../Logo';

interface AdminAccessScreenProps {
  adminSuccessPath?: string;
  storeSuccessPath?: string;
}

export function AdminAccessScreen({
  adminSuccessPath = '/operations/summary',
  storeSuccessPath = '/operations/summary',
}: AdminAccessScreenProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { stores, loginAsOwner, loginAsAdmin, loginAsStore } = useAdminDashboard();
  const [mode, setMode] = useState<'owner' | 'admin' | 'store'>('owner');
  const [ownerPin, setOwnerPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [storeCode, setStoreCode] = useState(stores.find((store) => store.isActive)?.code ?? '');
  const [storePin, setStorePin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState('Choose owner, admin, or store access and continue with a 6-digit PIN.');
  const [isLoading, setIsLoading] = useState(false);

  // Defensive guard: this screen is only valid on /operations.
  if (!location.pathname.startsWith('/operations')) {
    return null;
  }

  const activeStores = stores.filter((store) => store.isActive);

  useEffect(() => {
    if (storeCode || activeStores.length === 0) {
      return;
    }

    setStoreCode(activeStores[0].code);
  }, [activeStores, storeCode]);

  const handleOwnerLogin = async () => {
    setIsLoading(true);
    const result = await loginAsOwner(ownerPin);
    setIsLoading(false);
    setMessage(result.message);
    if (result.success) {
      navigate(adminSuccessPath, { replace: true });
    }
  };

  const handleScopedAdminLogin = async () => {
    setIsLoading(true);
    const result = await loginAsAdmin(adminPin);
    setIsLoading(false);
    setMessage(result.message);
    if (result.success) {
      navigate(adminSuccessPath, { replace: true });
    }
  };

  const handleStoreLogin = async () => {
    setIsLoading(true);
    const result = await loginAsStore(storeCode, storePin);
    setIsLoading(false);
    setMessage(result.message);
    if (result.success) {
      navigate(storeSuccessPath, { replace: true });
      window.requestAnimationFrame(() => {
        if (window.location.pathname.startsWith('/operations')) {
          window.location.replace(storeSuccessPath);
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(45,80,22,0.14),transparent_26%),radial-gradient(circle_at_92%_18%,rgba(126,153,108,0.18),transparent_30%),linear-gradient(160deg,#EFF3E9_0%,#F8F7F2_48%,#EDF2E6_100%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1180px] items-center justify-center">
        <div className="grid w-full max-w-[1080px] gap-7 lg:grid-cols-[minmax(440px,500px)_minmax(500px,560px)] lg:justify-center lg:gap-8">
          <section className="rounded-[36px] border border-primary/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,246,236,0.9))] p-7 shadow-[0_24px_64px_rgba(45,80,22,0.14)] md:p-9 lg:min-h-[620px]">
            <div className="flex items-center gap-4 border-b border-primary/10 pb-5">
              <Logo variant="emblem" animated />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/58">Internal Access</p>
                <h1 className="mt-1 text-[2.2rem] font-semibold tracking-[-0.04em] text-foreground md:text-[2.5rem]">CULTIV Control</h1>
              </div>
            </div>

            <p className="mt-7 max-w-lg text-base leading-8 text-foreground/66">
              Choose your operations access mode and continue with your 6-digit PIN.
            </p>

            <div className="mt-7 rounded-[30px] border border-primary/10 bg-white/86 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/58">Access Modes</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  data-testid="mode-owner"
                  onClick={() => {
                    setMode('owner');
                    setShowPin(false);
                  }}
                  className={`rounded-2xl px-4 py-4 text-base font-semibold leading-tight ${mode === 'owner' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Owner Login
                </button>
                <button
                  type="button"
                  data-testid="mode-admin"
                  onClick={() => {
                    setMode('admin');
                    setShowPin(false);
                  }}
                  className={`rounded-2xl px-4 py-4 text-base font-semibold leading-tight ${mode === 'admin' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Admin Login
                </button>
                <button
                  type="button"
                  data-testid="mode-store"
                  onClick={() => {
                    setMode('store');
                    setShowPin(false);
                  }}
                  className={`rounded-2xl px-4 py-4 text-base font-semibold leading-tight ${mode === 'store' ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}
                >
                  Store Login
                </button>
              </div>
            </div>

          </section>

          <section className="flex flex-col justify-center gap-5 lg:gap-6">
            <motion.div layout className="rounded-[36px] border border-primary/12 bg-white/92 p-7 shadow-[0_20px_52px_rgba(45,80,22,0.12)] md:p-8 lg:min-h-[430px]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  {mode === 'store' ? <Building2 className="h-5.5 w-5.5" /> : <ShieldCheck className="h-5.5 w-5.5" />}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/58">{mode === 'store' ? 'Store Access' : 'Admin Access'}</p>
                  <p className="mt-1 text-[1.7rem] font-semibold tracking-[-0.03em] text-foreground leading-tight">{mode === 'owner' ? 'Owner controls and multi-store oversight' : mode === 'admin' ? 'Administrative dashboard access' : 'One store, daily operations'}</p>
                </div>
              </div>

              <div className="mt-7 flex min-h-[250px] flex-col justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  {mode === 'owner' ? (
                    <motion.div
                      key="owner"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="mx-auto w-full max-w-[420px] space-y-4"
                    >
                      <label className="block text-base text-foreground/68">
                        <span className="mb-3 block font-medium">Owner PIN</span>
                        <div className="relative">
                          <input type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" data-testid="owner-pin-input" value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit owner PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-5 py-4 pr-14 text-lg outline-none transition-colors focus:border-primary" />
                          <button
                            type="button"
                            onClick={() => setShowPin((value) => !value)}
                            className="absolute inset-y-0 right-0 flex items-center px-4 text-foreground/55 transition-colors hover:text-foreground"
                            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </label>
                      <button data-testid="owner-login-button" type="button" onClick={handleOwnerLogin} disabled={isLoading} className="w-full rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-60">{isLoading ? 'Verifying…' : 'Open owner panel'}</button>
                    </motion.div>
                  ) : mode === 'admin' ? (
                    <motion.div
                      key="admin"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="mx-auto w-full max-w-[420px] space-y-4"
                    >
                      <label className="block text-base text-foreground/68">
                        <span className="mb-3 block font-medium">Admin PIN</span>
                        <div className="relative">
                          <input type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" data-testid="admin-pin-input" value={adminPin} onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit admin PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-5 py-4 pr-14 text-lg outline-none transition-colors focus:border-primary" />
                          <button
                            type="button"
                            onClick={() => setShowPin((value) => !value)}
                            className="absolute inset-y-0 right-0 flex items-center px-4 text-foreground/55 transition-colors hover:text-foreground"
                            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </label>
                      <button data-testid="admin-login-button" type="button" onClick={handleScopedAdminLogin} disabled={isLoading} className="w-full rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-60">{isLoading ? 'Verifying…' : 'Open admin dashboard'}</button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="store"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="mx-auto w-full max-w-[420px] space-y-4"
                    >
                      <label className="block text-base text-foreground/68">
                        <span className="mb-3 block font-medium">Store</span>
                        <select data-testid="store-select" value={storeCode} onChange={(event) => setStoreCode(event.target.value)} className="w-full rounded-2xl border border-primary/12 bg-background/80 px-5 py-4 text-lg outline-none transition-colors focus:border-primary">
                          {activeStores.map((store) => (
                            <option key={store.id} value={store.code}>{store.name} · {store.city}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-base text-foreground/68">
                        <span className="mb-3 block font-medium">6-digit PIN</span>
                        <div className="relative">
                          <input type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" data-testid="store-pin-input" value={storePin} onChange={(event) => setStorePin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Store PIN" className="w-full rounded-2xl border border-primary/12 bg-background/80 px-5 py-4 pr-14 text-lg outline-none transition-colors focus:border-primary" />
                          <button
                            type="button"
                            onClick={() => setShowPin((value) => !value)}
                            className="absolute inset-y-0 right-0 flex items-center px-4 text-foreground/55 transition-colors hover:text-foreground"
                            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </label>
                      <button data-testid="store-login-button" type="button" onClick={handleStoreLogin} disabled={isLoading} className="w-full rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-60">{isLoading ? 'Verifying…' : 'Open store workspace'}</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <div className="rounded-[30px] border border-primary/10 bg-[linear-gradient(180deg,rgba(247,250,243,0.95),rgba(255,255,255,0.88))] px-6 py-5 text-base leading-7 text-foreground/66 shadow-[0_16px_40px_rgba(45,80,22,0.08)]">
              {message}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
