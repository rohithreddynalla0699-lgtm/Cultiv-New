import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { Receipt } from '../receipts/components/Receipt';
import { printReceiptElement } from '../receipts/utils/printReceiptElement';


import { getDisplayOrderNumber } from '../utils/orderDisplay';
import { useReceiptData } from '../receipts/hooks/useReceiptData';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function OrderSuccessScreen() {
  const { orderId } = useParams();
  const { getOrderById } = useAuth();

  if (!orderId) {
    return <Navigate to="/" replace />;
  }

  const order = getOrderById(orderId);
  if (!order) {
    return <Navigate to="/" replace />;
  }

  const receiptData = useReceiptData(order);

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,rgba(45,80,22,0.15),transparent_32%),radial-gradient(circle_at_90%_8%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] pt-28 pb-16">
      <div className="mx-auto w-full max-w-md px-4 sm:px-0">
        <div className="flex flex-col items-center gap-8">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full text-center"
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Order Confirmed
            </h1>
            <p className="mt-2 text-sm font-medium text-foreground/70">
              Thank you for your order!
            </p>
            <p className="mt-1 text-sm text-foreground/50">
              Order <span className="font-semibold text-primary">#{getDisplayOrderNumber(order)}</span>
            </p>
          </motion.div>

          {receiptData ? (
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
              className="w-full"
            >
              <Receipt
                data={receiptData}
                variant="screen"
                showActions={true}
                onPrint={printReceiptElement}
              />
            </motion.div>
          ) : null}

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' }}
            className="w-full rounded-[24px] border border-primary/10 bg-white/80 p-5 shadow-[0_10px_24px_rgba(45,80,22,0.06)]"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
              What happens next
            </p>
            <ol className="space-y-2.5 text-sm text-foreground/72">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span>Your order is queued in the kitchen</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span>Kitchen staff starts preparing your food</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>You&apos;ll get a notification when ready</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  4
                </span>
                <span>Pickup at counter with your order number</span>
              </li>
            </ol>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.45, delay: 0.24, ease: 'easeOut' }}
            className="flex w-full flex-col gap-3 sm:flex-row"
          >
            <Link
              to={`/orders/${orderId}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-center font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg"
            >
              Track Order
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-primary/18 px-6 py-4 text-center font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Back to Menu
            </Link>
          </motion.div>

          {order.email ? (
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.3, ease: 'easeOut' }}
              className="w-full text-center text-xs text-foreground/55"
            >
              Confirmation email sent to{' '}
              <span className="font-medium text-foreground/70">{order.email}</span>
            </motion.div>
          ) : null}
        </div>
      </div>
    </PageReveal>
  );
}