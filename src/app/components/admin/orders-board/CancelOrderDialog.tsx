import { AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';


export interface CancelOrderDialogProps {
  orderId: string; // backend id, for logic only
  displayOrderId?: string; // for UI text
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<void> | void;
}

export default function CancelOrderDialog({ orderId, displayOrderId, isOpen, isSubmitting, onClose, onConfirmCancel }: CancelOrderDialogProps) {
  const [reason, setReason] = useState("");

  // Clear reason when dialog closes
  useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (reason.trim()) {
      await onConfirmCancel(orderId, reason.trim());
    }
  };

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
              Order #{displayOrderId || orderId} will be closed from active workflow.
            </p>
          </div>
        </div>

        {/* Reason textarea */}
        <div className="mt-5">
          <label htmlFor="cancellation-reason" className="block text-sm font-medium text-foreground mb-1">
            Reason for cancellation
          </label>
          <textarea
            id="cancellation-reason"
            className="w-full rounded-lg border border-border bg-white/90 p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-200 min-h-[72px] resize-none"
            placeholder="Explain why this order is being cancelled..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            disabled={isSubmitting}
          />
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
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
