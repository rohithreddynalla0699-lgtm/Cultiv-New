import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, Phone, ReceiptText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { Receipt } from '../receipts/components/Receipt';
import { printReceiptElement } from '../receipts/utils/printReceiptElement';
import { getDisplayOrderNumber } from '../utils/orderDisplay';
import { useReceiptData } from '../receipts/hooks/useReceiptData';
import { ActiveOrderTracker } from './ActiveOrderTracker';
import { Logo } from './Logo';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function OrderDetailScreen() {
  const [showReceipt, setShowReceipt] = useState(false);

  const { user, getOrderById } = useAuth();
  const { orderId } = useParams();

  // 🔥 FIX: safer order fetch
  const order = orderId ? getOrderById(orderId) : undefined;

  // 🔥 FIX: prevent blank screen crash
  if (!user) return <Navigate to="/" replace />;
  if (!order) return <Navigate to="/orders" replace />;
    // 🔥 STORE NAME FIX (simple mapping)
  const getStoreName = (storeId: string | undefined) => {
    if (!storeId) return 'CULTIV Store';

    if (storeId === '45b3f0ff-ce56-4060-ae55-a773cb2e181e') {
      return 'CULTIV Siddipet';
    }

    return 'CULTIV Store';
  };

  const statusLabel =
    order.statusTimeline?.find((event) => event.status === order.status)?.label ??
    order.status;

  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  let statusBadgeClass = '';
  let statusBadgeLabel = '';

  if (isCancelled) {
    statusBadgeClass = 'bg-rose-100 text-rose-700 border border-rose-200';
    statusBadgeLabel = 'Cancelled';
  } else if (isCompleted) {
    statusBadgeClass = 'bg-primary/8 text-primary border border-primary/20';
    statusBadgeLabel = 'Completed';
  } else {
    statusBadgeClass = 'bg-background/75 text-foreground/72 border border-border';
    statusBadgeLabel =
      statusLabel.charAt(0).toUpperCase() +
      statusLabel.slice(1).replace(/_/g, ' ');
  }

  const sourceLabel = order.source === 'walk-in' ? 'In-Store' : 'Online';
  const receiptData = useReceiptData(order);

  // Modal UX fixes
  useEffect(() => {
    if (showReceipt) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [showReceipt]);

  useEffect(() => {
    if (showReceipt) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showReceipt]);
    return (
    <PageReveal className="min-h-screen bg-gradient-to-br from-[#f5f5f0] via-background to-[#f7f6f2] pt-28 pb-12">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/orders" className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground">
            <ArrowLeft size={16} /> Back to Order History
          </Link>

          <button
            onClick={() => setShowReceipt(true)}
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-background/60"
          >
            <ReceiptText size={16} /> View Receipt
          </button>
        </div>

        {/* Order Card */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="rounded-2xl border bg-white p-6 shadow-sm space-y-6"
        >
          {/* Title */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs tracking-widest text-muted-foreground">ORDER DETAILS</p>
              <h2 className="text-xl font-semibold">
                Order #{getDisplayOrderNumber(order)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>

            <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass}`}>
              {statusBadgeLabel}
            </div>
          </div>

          {/* Cancel message */}
          {isCancelled && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm">
              This order was cancelled.
            </div>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">ITEMS</h3>
            {order.items.map((item) => (
              <div key={item.id} className="border rounded-xl p-3">
                <div className="flex justify-between">
                  <span>{item.title}</span>
                  <span>₹{item.price}</span>
                </div>
                <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold">SUMMARY</h3>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST</span>
                <span>₹{order.taxAmount}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>₹{order.total}</span>
              </div>
            </div>

            {/* FIXED STORE DISPLAY */}
            <div className="border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold">ORDER INFO</h3>
              <div className="flex justify-between text-sm">
                <span>Customer</span>
                <span>{order.fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Store</span>
                <span>{getStoreName(order.storeId)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Source</span>
                <span>{sourceLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment</span>
                <span>{order.paymentMethod}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Receipt Modal */}
        <AnimatePresence>
          {showReceipt && receiptData && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setShowReceipt(false)}
            >
              <motion.div
                className="bg-white rounded-2xl p-6 max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowReceipt(false)}
                  className="absolute right-4 top-4"
                >
                  ✕
                </button>

                <Receipt data={receiptData} variant="screen" showActions onPrint={printReceiptElement} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageReveal>
  );
}