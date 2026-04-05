// OrderSuccessScreen — dedicated order confirmation screen shown after successful placement

import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock, MapPin, ShoppingBag } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';

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

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,rgba(45,80,22,0.15),transparent_32%),radial-gradient(circle_at_90%_8%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Success Header */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="flex justify-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" strokeWidth={3} />
          </div>
        </motion.div>

        {/* Title & Subtitle */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-semibold tracking-[-0.02em]">Order placed!</h1>
          <p className="mt-2 text-lg text-foreground/66">Your food is on its way to the kitchen.</p>
        </motion.div>

        {/* Order Number Card (Prominent) */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-[28px] border-2 border-primary/20 bg-white/90 p-6 shadow-[0_16px_40px_rgba(45,80,22,0.1)]"
        >
          <p className="text-center text-xs uppercase tracking-[0.22em] text-primary/70">Order Number</p>
          <p className="mt-3 text-center font-mono text-5xl font-bold tracking-wider text-primary"># {order.id.slice(-6)}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(order.id.slice(-6));
            }}
            className="mt-3 w-full rounded-full border border-primary/20 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            Copy Order Number
          </button>
        </motion.div>

        {/* Pickup Details Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {/* Pickup Location */}
          <div className="rounded-[24px] border border-primary/12 bg-white/85 p-5 shadow-[0_12px_32px_rgba(45,80,22,0.07)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Pickup Location</p>
                <p className="mt-1.5 font-semibold text-foreground/88">{order.storeId || 'Siddipet Central'}</p>
                <p className="text-xs text-foreground/60">Address, Phone, Hours</p>
              </div>
            </div>
          </div>

          {/* Pickup ETA */}
          <div className="rounded-[24px] border border-primary/12 bg-white/85 p-5 shadow-[0_12px_32px_rgba(45,80,22,0.07)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100/60">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700/70">Ready in</p>
                <p className="mt-1.5 font-semibold text-foreground/88">{order.fulfillmentWindow || '25-35 minutes'}</p>
                <p className="text-xs text-foreground/60">We'll notify you when ready</p>
              </div>
            </div>
          </div>

          {/* Items Summary */}
          <div className="rounded-[24px] border border-primary/12 bg-white/85 p-5 shadow-[0_12px_32px_rgba(45,80,22,0.07)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100/60">
                <ShoppingBag className="h-5 w-5 text-blue-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-700/70">Order Summary</p>
                <div className="mt-2 space-y-1">
                  {order.items.slice(0, 3).map((item) => (
                    <p key={item.id} className="text-sm text-foreground/76">
                      {item.quantity}× {item.title}
                    </p>
                  ))}
                  {itemCount > 3 ? (
                    <p className="text-xs text-foreground/60">+{itemCount - 3} more item{itemCount - 3 > 1 ? 's' : ''}</p>
                  ) : null}
                </div>
                <p className="mt-2.5 border-t border-border/40 pt-2.5 text-base font-semibold">
                  Total: <span className="text-primary">₹{order.total.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* What Happens Next */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="rounded-[24px] border border-primary/10 bg-linear-gradient(160deg,rgba(255,255,255,0.92),rgba(241,246,236,0.82)) p-5 shadow-[0_10px_24px_rgba(45,80,22,0.06)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">What happens next</p>
          <ol className="mt-3 space-y-2 text-sm text-foreground/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
              <span>Your order is queued in the kitchen</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
              <span>Kitchen staff starts preparing your food</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
              <span>You'll get a notification when ready</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
              <span>Pickup at counter with your order number</span>
            </li>
          </ol>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3 pt-4 sm:flex-row"
        >
          <Link
            to={`/orders/${orderId}`}
            className="flex items-center justify-center gap-2 rounded-full bg-primary py-4 px-6 text-center font-semibold text-primary-foreground transition-all hover:shadow-lg hover:opacity-90 flex-1"
          >
            Track Order
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 rounded-full border border-primary/18 py-4 px-6 text-center font-semibold text-primary transition-colors hover:bg-primary/5 flex-1"
          >
            Back to Menu
          </Link>
        </motion.div>

        {/* Confirmation Email Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-center text-xs text-foreground/55"
        >
          <p>Confirmation email sent to <span className="font-medium text-foreground/70">{order.email}</span></p>
        </motion.div>
      </div>
    </PageReveal>
  );
}
