import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CardStagger, CardStaggerItem, PageReveal } from '../core/motion/cultivMotion';
import { Receipt } from '../receipts/components/Receipt';
import { useReceiptData } from '../receipts/hooks/useReceiptData';
import { printReceiptElement } from '../receipts/utils/printReceiptElement';
import { getDisplayOrderNumber } from '../utils/orderDisplay';

type OrderItemModifier = {
  id?: string;
  label?: string;
};

type OrderItemLike = {
  id?: string;
  title?: string;
  price?: number | string;
  quantity?: number | string;
  modifiers?: OrderItemModifier[];
};

type StatusTimelineEvent = {
  status?: string;
  label?: string;
};

type OrderLike = {
  id?: string;
  createdAt?: string;
  status?: string;
  statusTimeline?: StatusTimelineEvent[];
  cancellation_reason?: string;
  storeId?: string;
  sourceChannel?: string;
  source?: string;
  paymentMethod?: string;
  fullName?: string;
  subtotal?: number | string;
  taxAmount?: number | string;
  total?: number | string;
  items?: OrderItemLike[];
};

export function OrderDetailScreen() {
  const [showReceipt, setShowReceipt] = useState(false);
  const { user, getOrderById } = useAuth();
  const { orderId } = useParams();

  const rawOrder = orderId ? getOrderById(orderId) : undefined;
  const order = (rawOrder ?? null) as OrderLike | null;

  const receiptData = useReceiptData(order as never);

  const getStoreName = (storeId?: string) => {
    if (!storeId) return 'CULTIV Store';
    if (storeId === '45b3f0ff-ce56-4060-ae55-a773cb2e181e') return 'CULTIV Siddipet';
    return 'CULTIV Store';
  };

  const statusLabel = useMemo(() => {
    if (!order) return '';
    return (
      order.statusTimeline?.find((event) => event.status === order.status)?.label ??
      order.status ??
      ''
    );
  }, [order]);

  const isCancelled = order?.status === 'cancelled';

  const statusBadgeClass = useMemo(() => {
    switch (order?.status) {
      case 'completed':
        return 'border border-emerald-200/80 bg-emerald-50 text-emerald-700';
      case 'preparing':
        return 'border border-amber-200/80 bg-amber-50 text-amber-700';
      case 'ready':
      case 'ready_for_pickup':
        return 'border border-sky-200/80 bg-sky-50 text-sky-700';
      case 'cancelled':
        return 'border border-rose-200/80 bg-rose-50 text-rose-700';
      default:
        return 'border border-[#d9ddcf] bg-[#eef1e7] text-[#55614a]';
    }
  }, [order?.status]);

  const sourceLabel = order?.sourceChannel ?? order?.source ?? 'Online';

  if (!user) return <Navigate to="/" replace />;
  if (!order) return <Navigate to="/orders" replace />;

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(132,153,106,0.07),transparent_30%),linear-gradient(180deg,#f8f7f3_0%,#f4f3ed_54%,#f8f7f3_100%)] pb-16 pt-28">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-center justify-between">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b7560] transition-colors hover:text-[#27311f]"
          >
            <ArrowLeft size={15} />
            Back to Order History
          </Link>

          <button
            onClick={() => setShowReceipt(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8ddcf] bg-[#fbfbf7] px-4 py-2 text-[13px] font-medium text-[#2d3625] shadow-[0_1px_2px_rgba(30,40,20,0.04)] transition hover:border-[#c8cfbc] hover:bg-[#f5f6ef]"
            type="button"
          >
            <ReceiptText size={15} />
            View Receipt
          </button>
        </div>

        <CardStagger>
          <motion.div variants={CardStaggerItem}>
            <div className="rounded-[26px] border border-[#dde2d4] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,241,0.96))] p-5 shadow-[0_10px_30px_rgba(32,42,24,0.05)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-3">
                    <h2 className="text-[1.7rem] font-semibold tracking-[-0.035em] text-[#1f2719]">
                      Order #{getDisplayOrderNumber(order as never)}
                    </h2>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#6f7866]">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* Show cancellation reason only if cancelled and reason is non-empty */}
              {isCancelled && !!order.cancellation_reason && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-700 mb-1">Cancellation reason</div>
                  <div className="text-[13px] text-rose-700">{order.cancellation_reason}</div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div variants={CardStaggerItem}>
            <div className="rounded-[26px] border border-[#dde2d4] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,248,243,0.96))] p-5 shadow-[0_10px_30px_rgba(32,42,24,0.05)]">
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a856d]">
                Items
              </h3>

              <div className="space-y-3">
                {(order.items ?? []).map((item, index) => (
                  <div
                    key={item.id ?? `${item.title ?? 'item'}-${index}`}
                    className="rounded-2xl border border-[#e1e5d8] bg-[#fcfcf8] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[15px] font-semibold text-[#1f2719]">
                        {item.title ?? 'Item'}
                      </span>
                      <span className="text-[16px] font-semibold text-[#1f2719]">
                        ₹{item.price ?? 0}
                      </span>
                    </div>

                    <div className="mt-1 text-[12px] font-medium text-[#7b8570]">
                      Qty {item.quantity ?? 1}
                    </div>

                    {!!item.modifiers?.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.modifiers.map((mod, modIndex) => (
                          <span
                            key={mod.id ?? mod.label ?? modIndex}
                            className="rounded-full border border-[#d7dec9] bg-[#eef3e5] px-2.5 py-1 text-[11px] font-medium text-[#556446]"
                          >
                            {mod.label ?? 'Modifier'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div variants={CardStaggerItem}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-[26px] border border-[#dde2d4] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,248,243,0.96))] p-5 shadow-[0_10px_30px_rgba(32,42,24,0.05)]">
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a856d]">
                  Order Summary
                </h3>

                <div className="mb-2 flex justify-between text-[13px] text-[#34402b]">
                  <span className="text-[#6f7866]">Subtotal</span>
                  <span className="font-medium">₹{order.subtotal ?? 0}</span>
                </div>

                <div className="mb-2 flex justify-between text-[13px] text-[#34402b]">
                  <span className="text-[#6f7866]">GST</span>
                  <span className="font-medium">₹{order.taxAmount ?? 0}</span>
                </div>

                <div className="mt-4 flex justify-between border-t border-[#e1e5d8] pt-4 text-[18px] font-semibold text-[#1f2719]">
                  <span>Total</span>
                  <span>₹{order.total ?? 0}</span>
                </div>
              </div>

              <div className="rounded-[26px] border border-[#dde2d4] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,248,243,0.96))] p-5 shadow-[0_10px_30px_rgba(32,42,24,0.05)]">
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a856d]">
                  Order Info
                </h3>

                <div className="mb-3 flex justify-between gap-4 text-[13px]">
                  <span className="text-[#6f7866]">Customer</span>
                  <span className="text-right font-medium text-[#25301f]">
                    {order.fullName ?? '—'}
                  </span>
                </div>

                <div className="mb-3 flex justify-between gap-4 text-[13px]">
                  <span className="text-[#6f7866]">Store</span>
                  <span className="text-right font-medium text-[#25301f]">
                    {getStoreName(order.storeId)}
                  </span>
                </div>

                <div className="mb-3 flex justify-between gap-4 text-[13px]">
                  <span className="text-[#6f7866]">Source</span>
                  <span className="text-right font-medium capitalize text-[#25301f]">
                    {sourceLabel}
                  </span>
                </div>

                <div className="flex justify-between gap-4 text-[13px]">
                  <span className="text-[#6f7866]">Payment</span>
                  <span className="text-right font-medium uppercase text-[#25301f]">
                    {order.paymentMethod ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </CardStagger>

        <AnimatePresence>
          {showReceipt && receiptData && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,28,18,0.42)] p-4 backdrop-blur-[2px]"
              onClick={() => setShowReceipt(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-lg rounded-[26px] border border-[#dde2d4] bg-[#fbfbf7] p-6 shadow-[0_24px_60px_rgba(22,30,18,0.18)]"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
              >
                <button
                  onClick={() => setShowReceipt(false)}
                  className="absolute right-4 top-4 text-lg text-[#7b8570] transition hover:text-[#27311f]"
                  aria-label="Close receipt"
                  type="button"
                >
                  ×
                </button>

                <Receipt
                  data={receiptData}
                  variant="screen"
                  showActions
                  onPrint={printReceiptElement}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageReveal>
  );
}