import type { PosReceipt } from '../../../types/pos';

interface ReceiptViewProps {
  receipt: PosReceipt;
  onNewOrder: () => void;
}

export function ReceiptView({ receipt, onNewOrder }: ReceiptViewProps) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Payment Successful</p>
      <h3 className="mt-1 text-base font-semibold text-emerald-900">Order #{receipt.orderId}</h3>
      <div className="mt-3 grid gap-1 text-sm text-emerald-900/90">
        <p>Channel: In Store</p>
        <p>Customer: {receipt.customerName}</p>
        <p>Phone: {receipt.customerPhone}</p>
        <p>Payment: {receipt.paymentMethod.toUpperCase()}</p>
        <p>Subtotal: Rs {receipt.subtotal.toFixed(2)}</p>
        <p>Tax: Rs {receipt.taxAmount.toFixed(2)}</p>
        <p>Tip: Rs {receipt.tipAmount.toFixed(2)}</p>
        <p>Total: Rs {receipt.total.toFixed(2)}</p>
      </div>
      <button
        type="button"
        onClick={onNewOrder}
        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
      >
        New Order
      </button>
    </section>
  );
}
