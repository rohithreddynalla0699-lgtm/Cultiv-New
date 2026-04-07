import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';

type PaymentMethod = 'cash' | 'card' | 'upi' | 'online' | string;

type PosReceipt = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
};

type ReceiptViewProps = {
  receipt: PosReceipt;
  onNewOrder: () => void;
};

export function ReceiptView({ receipt, onNewOrder }: ReceiptViewProps) {
  const { getOrderById } = useAuth();
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!receipt?.orderId) return;

    const fetchOrder = async () => {
      const fetchedOrder = await getOrderById(receipt.orderId);
      setOrder(fetchedOrder ?? null);
    };

    fetchOrder();
  }, [receipt?.orderId, getOrderById]);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Receipt
        </p>
        <h3 className="mt-1 text-base font-semibold text-emerald-900">
          Order #{receipt.orderId}
        </h3>
      </div>

      <div className="space-y-1 text-sm text-slate-700">
        <p>Customer: {receipt.customerName}</p>
        <p>Phone: {receipt.customerPhone}</p>
        <p>Payment: {String(receipt.paymentMethod).toUpperCase()}</p>
        <p>Subtotal: Rs {receipt.subtotal.toFixed(2)}</p>
        <p>Tax: Rs {receipt.taxAmount.toFixed(2)}</p>
        <p>Tip: Rs {receipt.tipAmount.toFixed(2)}</p>
        <p className="font-semibold text-slate-900">
          Total: Rs {receipt.total.toFixed(2)}
        </p>
        {order?.status && <p>Status: {order.status}</p>}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Print receipt
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          New order
        </button>
      </div>
    </div>
  );
}