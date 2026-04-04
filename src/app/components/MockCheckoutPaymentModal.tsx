import { motion } from 'framer-motion';
import { CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { CustomerCheckoutPaymentMethod } from '../types/platform';

interface MockCheckoutPaymentModalProps {
  paymentMethod: CustomerCheckoutPaymentMethod;
  amount: number;
  itemCount: number;
  customerName: string;
  paymentReference: string;
  idempotencyKey: string;
  onSimulateSuccess: () => void;
  onSimulateFailure: () => void;
  onSimulateCancel: () => void;
}

export function MockCheckoutPaymentModal({
  paymentMethod,
  amount,
  itemCount,
  customerName,
  paymentReference,
  idempotencyKey,
  onSimulateSuccess,
  onSimulateFailure,
  onSimulateCancel,
}: MockCheckoutPaymentModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[radial-gradient(circle_at_15%_8%,rgba(36,88,44,0.18),transparent_35%),rgba(10,16,10,0.55)] p-4 sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', damping: 22, stiffness: 240 }}
        className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/30 bg-[linear-gradient(165deg,rgba(254,255,252,0.98),rgba(241,247,236,0.96))] shadow-[0_28px_80px_rgba(10,20,10,0.38)]"
      >
        <div className="border-b border-primary/14 bg-[linear-gradient(140deg,rgba(50,102,54,0.12),rgba(255,255,255,0.55))] px-6 py-5 sm:px-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/70">Mock Payment Gateway</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground/90">Complete prepaid checkout</h2>
          <p className="mt-1.5 text-sm text-foreground/66">This simulates a real gateway flow for development while preserving payment-first order rules.</p>
        </div>

        <div className="space-y-4 px-6 py-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/12 bg-white/82 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/50">Method</p>
              <div className="mt-2 flex items-center gap-2.5">
                {paymentMethod === 'upi' ? <Smartphone className="h-4 w-4 text-primary" /> : <CreditCard className="h-4 w-4 text-primary" />}
                <p className="text-sm font-semibold text-foreground/88">{paymentMethod === 'upi' ? 'UPI' : 'Card'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/12 bg-white/82 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/50">Amount</p>
              <p className="mt-2 text-lg font-semibold text-primary">Rs {amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/12 bg-white/84 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/50">Checkout Reference</p>
            <div className="mt-2 space-y-1.5 text-sm text-foreground/72">
              <p>
                <span className="font-medium text-foreground/86">Items:</span> {itemCount}
              </p>
              <p>
                <span className="font-medium text-foreground/86">Customer:</span> {customerName || 'Guest Customer'}
              </p>
              <p>
                <span className="font-medium text-foreground/86">Payment Ref:</span> {paymentReference}
              </p>
              <p>
                <span className="font-medium text-foreground/86">Attempt Key:</span> {idempotencyKey.slice(0, 16)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/14 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground/86">Choose gateway outcome</p>
            </div>
            <p className="mt-1 text-xs text-foreground/62">Order is created only for simulated success. Failed/cancelled attempts keep your cart unchanged.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 border-t border-primary/12 bg-white/80 px-6 py-4 sm:grid-cols-3 sm:px-7">
          <button
            type="button"
            onClick={onSimulateSuccess}
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Simulate Success
          </button>
          <button
            type="button"
            onClick={onSimulateFailure}
            className="rounded-full border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
          >
            Simulate Failure
          </button>
          <button
            type="button"
            onClick={onSimulateCancel}
            className="rounded-full border border-primary/22 bg-white px-4 py-2.5 text-sm font-semibold text-foreground/75 transition-colors hover:bg-primary/5"
          >
            Simulate Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
