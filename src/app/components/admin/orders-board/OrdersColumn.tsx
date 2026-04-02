import type { AdminOrderBoardStatus } from '../../../types/admin';
import { ordersService } from '../../../services/ordersService';
import type { OrdersBoardOrder } from '../../../types/ordersBoard';
import { OrderCard } from './OrderCard';

interface OrdersColumnProps {
  status: AdminOrderBoardStatus;
  label: string;
  orders: OrdersBoardOrder[];
  isRush?: boolean;
  canCancelOrder: boolean;
  mutatingOrderIds: Set<string>;
  onPrimaryAction: (order: OrdersBoardOrder) => void;
  onOpenNotes: (order: OrdersBoardOrder) => void;
  onCancelOrder: (order: OrdersBoardOrder) => void;
}

const EMPTY_MESSAGE_BY_STATUS: Record<AdminOrderBoardStatus, string> = {
  new: 'No new orders right now.',
  preparing: 'No orders are being prepared.',
  ready: 'No orders ready for pickup.',
  picked_up: 'No completed orders for this filter.',
};

export function OrdersColumn({
  status,
  label,
  orders,
  isRush,
  canCancelOrder,
  mutatingOrderIds,
  onPrimaryAction,
  onOpenNotes,
  onCancelOrder,
}: OrdersColumnProps) {
  const columnClassName = isRush
    ? 'border-amber-300 bg-amber-50/40'
    : 'border-border bg-background/70';

  return (
    <section className={`flex min-h-[480px] flex-col rounded-2xl border ${columnClassName}`}>
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/70">{label}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground/60">{orders.length}</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background/80 px-3 py-4 text-center text-xs text-foreground/55">
            {EMPTY_MESSAGE_BY_STATUS[status]}
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canCancelOrder={canCancelOrder && status !== 'picked_up'}
              isMutating={mutatingOrderIds.has(order.id)}
              primaryActionLabel={ordersService.getPrimaryActionLabel(order.boardStatus)}
              onPrimaryAction={() => onPrimaryAction(order)}
              onOpenNotes={() => onOpenNotes(order)}
              onCancelOrder={() => onCancelOrder(order)}
            />
          ))
        )}
      </div>
    </section>
  );
}
