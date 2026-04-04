// OrderReviewModal — confirmation panel showing order details before placement

import { motion } from 'framer-motion';
import { Check, ChevronLeft } from 'lucide-react';
import type { DraftCartLine } from '../data/cartDraft';
import type { StoreLocatorStore } from '../data/storeLocator';

interface OrderReviewModalProps {
  items: DraftCartLine[];
  store: StoreLocatorStore;
  customer: { fullName: string; phone: string };
  subtotal: number;
  rewardDiscount: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  pickupEstimate: string;
  paymentMethod: 'upi' | 'card';
  isSubmitting: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function OrderReviewModal({
  items,
  store,
  customer,
  subtotal,
  rewardDiscount,
  taxAmount,
  tipAmount,
  total,
  pickupEstimate,
  paymentMethod,
  isSubmitting,
  onConfirm,
  onEdit,
}: OrderReviewModalProps) {
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const taxableSubtotal = Math.max(0, subtotal - rewardDiscount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-lg rounded-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        {/* Header */}
        <div className="border-b border-border/50 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary/60">Confirm Order</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">Review before placing</h2>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {/* Items Summary */}
          <div className="mb-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">Items ({itemCount})</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground/88">{item.title}</p>
                      <p className="text-xs text-foreground/60">{item.quantity}×</p>
                    </div>
                    <p className="shrink-0 font-semibold text-foreground/88">₹{(item.unitPrice * item.quantity).toFixed(2)}</p>
                  </div>
                  {item.selections && item.selections.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs text-foreground/64">
                      {item.selections.map((sel) => (
                        <p key={sel.section}>
                          <span className="font-medium">{sel.section}:</span> {sel.choices.join(', ')}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Pickup Details */}
          <div className="mb-4 rounded-lg border border-primary/12 bg-primary/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">Pickup</p>
            <p className="mt-2 font-medium text-foreground/88">{store.name}</p>
            <p className="mt-0.5 text-xs text-foreground/66">{store.city} • {store.zipCode}</p>
            <p className="mt-1.5 text-xs font-medium text-primary">Ready in {pickupEstimate}</p>
          </div>

          {/* Customer Info */}
          <div className="mb-4 rounded-lg border border-border/60 bg-background/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">For</p>
            <p className="mt-2 text-sm font-medium">{customer.fullName}</p>
            <p className="text-xs text-foreground/66">{customer.phone}</p>
          </div>

          <div className="mb-4 rounded-lg border border-primary/12 bg-primary/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">Payment</p>
            <p className="mt-2 text-sm font-medium text-foreground/88">{paymentMethod === 'upi' ? 'UPI' : 'Card'} (prepaid)</p>
            <p className="mt-0.5 text-xs text-foreground/66">Your order is created only after payment is verified.</p>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-2 border-t border-border/50 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">Subtotal</span>
              <span className="font-medium">₹{subtotal.toFixed(2)}</span>
            </div>
            {rewardDiscount > 0 ? (
              <div className="flex justify-between text-sm text-primary">
                <span>Reward discount</span>
                <span className="font-medium">−₹{rewardDiscount.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">Taxable subtotal</span>
              <span className="font-medium text-foreground/88">₹{taxableSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">GST (5%)</span>
              <span className="font-medium text-foreground/88">₹{taxAmount.toFixed(2)}</span>
            </div>
            {tipAmount > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-foreground/70">Tip</span>
                <span className="font-medium text-foreground/88">₹{tipAmount.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border/50 pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="text-lg">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border/50 flex gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onEdit}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-full border border-primary/22 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary/40 disabled:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            Edit Order
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                Processing Payment...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Pay & Place Order
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
