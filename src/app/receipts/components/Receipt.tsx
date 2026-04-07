import type { ReceiptData } from '../types/receipt';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItems } from './ReceiptItems';
import { ReceiptTotals } from './ReceiptTotals';
import { ReceiptFooter } from './ReceiptFooter';

interface ReceiptProps {
  data: ReceiptData;
  variant?: 'screen' | 'print';
  showActions?: boolean;
  onPrint?: () => void;
}

export function Receipt({ data, variant = 'screen', showActions = false, onPrint }: ReceiptProps) {
  return (
    <div
      id="print-receipt"
      className={
        (variant === 'print'
          ? 'max-w-md mx-auto bg-white p-6 rounded-xl shadow-none text-black'
          : 'max-w-md mx-auto bg-white p-6 rounded-xl shadow-md text-black'
        ) + ' print-receipt'
      }
    >
      <ReceiptHeader meta={data.meta} />
      <ReceiptItems items={data.items} />
      <ReceiptTotals totals={data.totals} />
      <ReceiptFooter />

      {showActions && (
        <div className="mt-6 flex justify-center print-hide">
          <button
            type="button"
            onClick={onPrint}
            className="px-4 py-2 rounded-full border border-primary/30 text-primary font-medium text-sm hover:bg-primary/10 transition print-hide"
          >
            Print Receipt
          </button>
        </div>
      )}
    </div>
  );
}