import { BarChart3, ClipboardList, Package2, ShoppingBag, Users } from 'lucide-react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { StatCard } from './StatCard';
import { SectionHeader } from './SectionHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { getAdminOrderBoardStatus, getOrderStoreId, isOrderActive, isOrderToday } from '../../utils/adminOrders';

export function AdminSummaryScreen() {
  const { sharedOrders } = useAuth();
  const { scopedInventory, scopedEmployees, activeStoreScope, activeStore, getStoreName } = useAdminDashboard();

  const scopedOrders = useMemo(() => sharedOrders.filter((order) => activeStoreScope === 'all' || getOrderStoreId(order) === activeStoreScope), [activeStoreScope, sharedOrders]);

  const todayOrders = useMemo(() => scopedOrders.filter(isOrderToday), [scopedOrders]);
  const activeOrders = useMemo(() => scopedOrders.filter(isOrderActive), [scopedOrders]);
  const readyOrders = useMemo(() => scopedOrders.filter((order) => getAdminOrderBoardStatus(order) === 'ready'), [scopedOrders]);
  const todayRevenue = useMemo(() => todayOrders.reduce((sum, order) => sum + order.total, 0), [todayOrders]);
  const lowStockItems = useMemo(() => scopedInventory.filter((item) => item.status === 'low_stock' || item.status === 'out_of_stock'), [scopedInventory]);
  const onShiftEmployees = useMemo(() => scopedEmployees.filter((employee) => employee.status === 'on_shift'), [scopedEmployees]);

  const hourlySeries = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const hour = 9 + index * 2;
      const matching = todayOrders.filter((order) => new Date(order.createdAt).getHours() >= hour && new Date(order.createdAt).getHours() < hour + 2);
      return {
        label: `${hour}:00`,
        orders: matching.length,
        revenue: matching.reduce((sum, order) => sum + order.total, 0),
      };
    });
    return buckets;
  }, [todayOrders]);

  const maxOrders = Math.max(...hourlySeries.map((item) => item.orders), 1);
  const scopeLabel = activeStore ? activeStore.name : 'All stores';

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <SectionHeader eyebrow="Admin Summary" title="Keep operations in view." description={`A calm overview of order pace, shift coverage, and stock pressure for ${scopeLabel}.`} action={<div className="rounded-full bg-white/88 px-4 py-2 text-sm font-medium text-foreground/68">{scopeLabel}</div>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Ready for pickup" value={`${readyOrders.length}`} hint="Orders that can be handed off now." icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard label="Active orders" value={`${activeOrders.length}`} hint="Orders still moving through assembly or pickup." icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Low stock items" value={`${lowStockItems.length}`} hint="Items needing attention this shift." icon={<Package2 className="h-5 w-5" />} />
        <StatCard label="On shift now" value={`${onShiftEmployees.length}`} hint="Team members currently clocked in." icon={<Users className="h-5 w-5" />} />
        <StatCard label="Today’s orders" value={`${todayOrders.length}`} hint="Pickup orders placed today." icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard label="Today’s revenue" value={`₹${todayRevenue}`} hint="Collected from completed and active pickup orders." icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)] transition-all duration-150 hover:shadow-[0_22px_52px_rgba(45,80,22,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">Orders by hour</p>
          <div className="mt-5 flex items-end gap-2 rounded-2xl bg-[#F7FAF3] p-4">
            {hourlySeries.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end rounded-lg bg-white/88 p-1">
                  <div className="w-full rounded-md bg-primary" style={{ height: `${Math.max((point.orders / maxOrders) * 100, 6)}%` }} />
                </div>
                <p className="text-[11px] font-semibold text-foreground/68">{point.label}</p>
                <p className="text-xs text-foreground/56">{point.orders} orders · ₹{point.revenue}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)] transition-all duration-150 hover:shadow-[0_22px_52px_rgba(45,80,22,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">Low stock watch</p>
            <div className="mt-4 space-y-3">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="mt-1 text-sm text-foreground/58">{item.quantity} {item.unit} left · Threshold {item.threshold}{activeStoreScope === 'all' ? ` · ${getStoreName(item.storeId)}` : ''}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_48px_rgba(45,80,22,0.08)] transition-all duration-150 hover:shadow-[0_22px_52px_rgba(45,80,22,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">On shift</p>
            <div className="mt-4 space-y-3">
              {onShiftEmployees.slice(0, 5).map((employee) => (
                <div key={employee.id} className="rounded-2xl bg-[#F7FAF3] px-4 py-3">
                  <p className="font-medium text-foreground">{employee.name}</p>
                  <p className="mt-1 text-sm text-foreground/58">{employee.role}{activeStoreScope === 'all' ? ` · ${getStoreName(employee.storeId)}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}