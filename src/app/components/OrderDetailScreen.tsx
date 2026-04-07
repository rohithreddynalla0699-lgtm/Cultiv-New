import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, Phone, ReceiptText } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { Receipt } from '../receipts/components/Receipt';
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


  // Lock body scroll when modal is open
  useEffect(() => {
    if (showReceipt) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [showReceipt]);

  // Auto-focus viewport to top when modal opens
  useEffect(() => {
    if (showReceipt) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showReceipt]);
  const { user, getOrderById } = useAuth();
  const { orderId } = useParams();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const order = orderId ? getOrderById(orderId) : undefined;
  if (!order) {
    return <Navigate to="/orders" replace />;
  }

  const statusLabel =
    order.statusTimeline.find((event) => event.status === order.status)?.label ?? order.status;
  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  // Status badge color for detail
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
    statusBadgeLabel = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1).replace(/_/g, ' ');
  }
  const sourceLabel = order.source === 'walk-in' ? 'In-Store' : 'Online';
  const gstAmount = order.taxAmount ?? 0;
  const receiptData = useReceiptData(order);

  return (
    <PageReveal className="min-h-screen bg-gradient-to-br from-[#f5f5f0] via-background to-[#f7f6f2] pt-28 pb-12">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* ...existing main content, unchanged... */}

        <AnimatePresence>
          {showReceipt && receiptData && (
            <motion.div
              key="receipt-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
              onClick={() => setShowReceipt(false)}
              aria-modal="true"
              role="dialog"
            >
              <motion.div
                key="receipt-modal"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
                  onClick={() => setShowReceipt(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <Receipt
                  data={receiptData}
                  variant="screen"
                  showActions={true}
                  onPrint={() => window.print()}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageReveal>
  );
}