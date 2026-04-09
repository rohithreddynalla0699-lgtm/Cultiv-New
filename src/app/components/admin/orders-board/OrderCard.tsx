import { MessageSquareMore } from 'lucide-react';
import { OrderActionButton } from './OrderActionButton';
import type { OrdersBoardOrder } from '../../../types/ordersBoard';
import { formatCurrency } from '../../../receipts/utils/formatCurrency';
import { getDisplayOrderNumber } from '../../../utils/orderDisplay';

interface OrderCardProps {
  order: OrdersBoardOrder;
  canCancelOrder: boolean;
  isMutating: boolean;
  onPrimaryAction: () => void;
  onOpenNotes: () => void;
  onCancelOrder: () => void;
  primaryActionLabel?: string | null;
}

const TYPE_BADGE_CLASS: Record<OrdersBoardOrder['orderType'], string> = {
  online: 'bg-blue-100 text-blue-700',
  in_store: 'bg-emerald-100 text-emerald-700',
};

export function OrderCard({
  order,
  canCancelOrder,
  isMutating,
  onPrimaryAction,
  onOpenNotes,
  onCancelOrder,
  primaryActionLabel,
}: OrderCardProps) {
  const visibleItems = order.itemsSummary.slice(0, 3);
  const remainingItems = Math.max(0, order.itemsSummary.length - visibleItems.length);

  // Status badge color for board
  let statusBadgeClass = '';
  let statusBadgeLabel = '';
  switch (order.orderStatus) {
    case 'cancelled':
      statusBadgeClass = 'bg-rose-100 text-rose-700 border border-rose-200';
      statusBadgeLabel = 'Cancelled';
      break;
    case 'completed':
      statusBadgeClass = 'bg-primary/8 text-primary border border-primary/20';
      statusBadgeLabel = 'Completed';
      break;
    default:
      statusBadgeClass = 'bg-background/75 text-foreground/72 border border-border';
      statusBadgeLabel = order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).replace(/_/g, ' ');
      break;
  }

  return (
    <article className="rounded-xl border border-border bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/55">#{getDisplayOrderNumber(order)}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{order.customerName || 'Guest'}</h3>
          <p className="text-xs text-foreground/55">{order.customerPhone || 'No phone'}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${TYPE_BADGE_CLASS[order.orderType]}`}>
          {order.sourceLabel}
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-foreground/70">
        {visibleItems.map((line) => (
          <li key={`${order.id}-${line}`}>{line}</li>
        ))}
      </ul>
      {remainingItems > 0 ? <p className="mt-1 text-xs text-foreground/55">+{remainingItems} more items</p> : null}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{formatCurrency(order.totalAmount)}</span>
        <span className="text-foreground/55">{order.waitingMinutes} min ago</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}>{statusBadgeLabel}</span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        {primaryActionLabel ? (
          <OrderActionButton
            label={primaryActionLabel}
            isLoading={isMutating}
            disabled={isMutating}
            onClick={onPrimaryAction}
          />
        ) : (
          <div className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground/55">No action</div>
        )}

        <button
          type="button"
          onClick={onOpenNotes}
          disabled={isMutating}
          className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 text-foreground/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-background/70 hover:text-foreground disabled:opacity-45"
          aria-label="Open order notes"
        >
          <MessageSquareMore className="h-4 w-4" />
        </button>
      </div>

      {canCancelOrder ? (
        <button
          type="button"
          onClick={onCancelOrder}
          disabled={isMutating}
          className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-45"
        >
          Cancel Order
        </button>
      ) : null}
    </article>
  );
}
