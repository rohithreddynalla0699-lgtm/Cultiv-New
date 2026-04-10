import type { AdminOrderBoardStatus } from '../../../types/admin';
import type { OrdersBoardOrder, OrdersBoardState } from '../../../types/ordersBoard';
import { OrdersColumn } from './OrdersColumn';

interface OrdersKanbanProps {
  boardState: OrdersBoardState;
  canCancelOrder: boolean;
  mutatingOrderIds: Set<string>;
  onPrimaryAction: (order: OrdersBoardOrder) => void;
  onOpenNotes: (order: OrdersBoardOrder) => void;
  onCancelOrder: (order: OrdersBoardOrder) => void;
}

const ORDER_COLUMNS: Array<{ status: AdminOrderBoardStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'cancelled', label: 'Cancelled' },
];

export function OrdersKanban({
  boardState,
  canCancelOrder,
  mutatingOrderIds,
  onPrimaryAction,
  onOpenNotes,
  onCancelOrder,
}: OrdersKanbanProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {ORDER_COLUMNS.map((column) => (
        <OrdersColumn
          key={column.status}
          status={column.status}
          label={column.label}
          orders={boardState.byStatus[column.status] ?? []}
          isRush={column.status === 'new' && boardState.shouldHighlightRush}
          canCancelOrder={canCancelOrder}
          mutatingOrderIds={mutatingOrderIds}
          onPrimaryAction={onPrimaryAction}
          onOpenNotes={onOpenNotes}
          onCancelOrder={onCancelOrder}
        />
      ))}
    </div>
  );
}
