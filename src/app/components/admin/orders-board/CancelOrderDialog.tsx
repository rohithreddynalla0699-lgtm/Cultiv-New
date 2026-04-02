import { AlertTriangle } from 'lucide-react';

interface CancelOrderDialogProps {
  orderId?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelOrderDialog({ orderId, isOpen, isSubmitting, onClose, onConfirm }: CancelOrderDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Cancel order?</h3>
            <p className="mt-1 text-sm text-foreground/70">
              Order #{orderId} will be closed from active workflow.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/75 disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
