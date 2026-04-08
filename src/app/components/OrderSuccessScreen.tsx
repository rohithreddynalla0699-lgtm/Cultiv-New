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

const nextSteps = [
  'Your order is queued in the kitchen',
  'Kitchen staff starts preparing your food',
  "You'll get a notification when ready",
  'Pickup at counter with your order number',
];

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
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,rgba(45,80,22,0.15),transparent_32%),radial-gradient(circle_at_90%_8%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] pt-24 pb-16 sm:pt-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mx-auto mb-8 max-w-2xl text-center sm:mb-10"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 sm:h-16 sm:w-16">
            <Check className="h-8 w-8 text-primary sm:h-9 sm:w-9" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Order Confirmed
          </h1>

          <p className="mt-2 text-sm font-medium text-foreground/70 sm:text-base">
            Thank you for your order!
          </p>

          <p className="mt-1 text-sm text-foreground/55 sm:text-base">
            Order{' '}
            <span className="font-semibold text-primary">
              #{getDisplayOrderNumber(order)}
            </span>
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-8 xl:gap-10">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="min-w-0"
          >
            {receiptData ? (
              <Receipt
                data={receiptData}
                variant="screen"
                showActions={true}
                onPrint={printReceiptElement}
              />
            ) : null}
          </motion.div>

          <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' }}
              className="rounded-[24px] border border-primary/10 bg-white/80 p-5 shadow-[0_10px_24px_rgba(45,80,22,0.06)] backdrop-blur-sm sm:p-6"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
                What happens next
              </p>

              <ol className="space-y-3 text-sm text-foreground/75 sm:text-[15px]">
                {nextSteps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="leading-6">{step}</span>
                  </li>
                ))}
              </ol>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.24, ease: 'easeOut' }}
              className="rounded-[24px] border border-primary/10 bg-white/70 p-4 shadow-[0_8px_20px_rgba(45,80,22,0.05)] backdrop-blur-sm sm:p-5"
            >
              <div className="flex flex-col gap-3">
                <Link
                  to={`/orders/${orderId}`}
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-center font-semibold text-primary-foreground transition-all duration-200 hover:translate-y-[-1px] hover:opacity-95 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  Track Order
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/"
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-primary/18 bg-white/60 px-6 py-4 text-center font-semibold text-primary transition-colors duration-200 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  Back to Menu
                </Link>
              </div>

              {order.email ? (
                <div className="mt-4 text-center text-xs text-foreground/55 sm:text-sm">
                  Confirmation email sent to{' '}
                  <span className="font-medium text-foreground/70">
                    {order.email}
                  </span>
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </PageReveal>
  );
}