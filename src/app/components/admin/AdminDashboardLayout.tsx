import { ClipboardList, LayoutDashboard, LogOut, Package2, ReceiptIndianRupee, Store, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { Logo } from '../Logo';
import { AdminAccessScreen } from './AdminAccessScreen';

export function AdminDashboardLayout() {
  const { stores, session, permissions, activeStoreScope, activeStore, setActiveStoreScope, logoutInternalAccess, showIdleWarning, idleCountdown, dismissIdleWarning } = useAdminDashboard();
  const location = useLocation();

  if (!session) {
    return <AdminAccessScreen />;
  }

  const navItems = [
    { to: '/admin/summary', label: 'Summary', icon: LayoutDashboard },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/counter-billing', label: 'Counter / Billing', icon: ReceiptIndianRupee },
    { to: '/admin/inventory', label: 'Inventory', icon: Package2 },
    { to: '/admin/employees', label: 'Employees', icon: Users },
    ...(permissions.canManageStores ? [{ to: '/admin/stores', label: 'Stores', icon: Store }] : []),
  ];

  const scopeLabel = session.role === 'admin'
    ? activeStore ? activeStore.name : 'All stores'
    : activeStore?.name ?? 'Store';
  const currentNav = navItems.find((item) => location.pathname.startsWith(item.to));
  const currentPage = currentNav?.label ?? 'Dashboard';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="admin-ops-shell min-h-screen bg-[radial-gradient(circle_at_6%_10%,rgba(45,80,22,0.12),transparent_24%),radial-gradient(circle_at_94%_16%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] p-4 md:p-5"
      >
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[32px] border border-primary/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.95),rgba(241,246,236,0.88))] p-4 shadow-[0_20px_58px_rgba(45,80,22,0.12)] lg:p-5">
          <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
            <Logo variant="emblem" animated />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/58">Internal Dashboard</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">CULTIV Store Ops</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(45,80,22,0.22)]' : 'bg-white/80 text-foreground/72 hover:text-foreground hover:shadow-[0_8px_20px_rgba(45,80,22,0.08)]'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </aside>

        <div className="rounded-[32px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,243,0.88))] p-4 shadow-[0_20px_58px_rgba(45,80,22,0.1)] md:p-6 lg:p-7">
          <div className="mb-6 flex flex-col gap-3 rounded-[26px] border border-primary/10 bg-white/76 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[#F7FAF3] px-3 py-1.5 font-medium text-foreground/72">Store: {scopeLabel}</span>
              <span className="rounded-full bg-[#F7FAF3] px-3 py-1.5 font-medium text-foreground/72">Role: {session.role === 'admin' ? 'Admin' : 'Store'}</span>
              <span className="rounded-full bg-[#F7FAF3] px-3 py-1.5 font-medium text-foreground/72">Page: {currentPage}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {permissions.canSwitchStores ? (
                <label className="flex flex-col gap-1 text-sm text-foreground/68 md:items-end">
                  <span className="font-medium">Store scope</span>
                  <select data-testid="admin-store-scope" value={activeStoreScope} onChange={(event) => setActiveStoreScope(event.target.value)} className="rounded-xl border border-primary/12 bg-background/80 px-3 py-2 outline-none transition-colors focus:border-primary">
                    <option value="all">All stores</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name} · {store.city}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <button data-testid="admin-signout" type="button" onClick={logoutInternalAccess} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/14 bg-white/86 px-4 py-2.5 text-sm font-medium text-foreground/72">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>

          <Outlet />
        </div>
      </div>
    </motion.div>

      <AnimatePresence>
        {showIdleWarning ? (
          <motion.div
            className="admin-ops-shell fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-[28px] border border-[#E9D0A0] bg-white p-6 shadow-[0_32px_64px_rgba(0,0,0,0.18)]"
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.99 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B5A12]">Session Expiring</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">Logging out in {idleCountdown}s</h2>
            <p className="mt-2 text-sm text-foreground/68">No activity detected. Tap the button below to stay signed in.</p>
            <button
              type="button"
              onClick={dismissIdleWarning}
              className="mt-5 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Stay Active
            </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}