import type { ReceiptTotals } from '../types/receipt';
import { formatCurrency } from '../utils/formatCurrency';

export function ReceiptTotals({ totals }: { totals: ReceiptTotals }) {
  return (
    <div className="mb-4 text-sm">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatCurrency(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-{formatCurrency(totals.discount)}</span>
        </div>
      )}
      {totals.tax > 0 && (
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatCurrency(totals.tax)}</span>
        </div>
      )}
      {totals.tip > 0 && (
        <div className="flex justify-between">
          <span>Tip</span>
          <span>{formatCurrency(totals.tip)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold border-t border-gray-200 mt-2 pt-2">
        <span>Total</span>
        <span>{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
}
