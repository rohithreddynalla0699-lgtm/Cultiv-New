import { ArrowRight, ShoppingBag } from 'lucide-react';
import { CartItemRow } from './CartItemRow';
import type { PosCartLine } from '../../../types/pos';

type TipOption = 'none' | '5' | '10' | '15' | 'custom';

interface CartPanelProps {
  storeName: string;
  cartLines: PosCartLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  selectedTipOption: TipOption;
  customTipInput: string;
  onSelectTipOption: (nextTip: TipOption) => void;
  onSetCustomTipInput: (value: string) => void;
  onIncrementLine: (lineId: string) => void;
  onDecrementLine: (lineId: string) => void;
  onEditLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onContinue: () => void;
}

const TIP_OPTIONS: Array<{ value: TipOption; label: string }> = [
  { value: 'none', label: 'No Tip' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: 'custom', label: 'Custom' },
];

export function CartPanel({
  storeName,
  cartLines,
  subtotal,
  discountAmount,
  taxAmount,
  tipAmount,
  total,
  selectedTipOption,
  customTipInput,
  onSelectTipOption,
  onSetCustomTipInput,
  onIncrementLine,
  onDecrementLine,
  onEditLine,
  onRemoveLine,
  onContinue,
}: CartPanelProps) {
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const isEmpty = cartLines.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#E5EBDD] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCF8_100%)] shadow-[0_12px_28px_rgba(31,46,18,0.08)]">
      <div className="border-b border-[#EEF2E8] px-3 py-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
          Cart
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
          {storeName} · {itemCount} item{itemCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
        {isEmpty ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#D9E2CD] bg-[#F7F9F4] px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8">
              <ShoppingBag className="h-4.5 w-4.5 text-primary" />
            </div>
            <h4 className="mt-2.5 text-[15px] font-semibold text-[#1F2719]">Cart is empty</h4>
          </div>
        ) : (
          <div className="space-y-1">
            {cartLines.map((line) => (
              <CartItemRow
                key={line.id}
                line={line}
                onEdit={() => onEditLine(line.id)}
                onIncrement={() => onIncrementLine(line.id)}
                onDecrement={() => onDecrementLine(line.id)}
                onRemove={() => onRemoveLine(line.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#EEF2E8] bg-white/92 px-3 py-1.5 backdrop-blur">
        <div className="mb-1.5 rounded-[16px] border border-[#E7EDE0] bg-[#F8FAF5] p-1.5">
          <div className="mb-0.5 flex flex-wrap gap-1">
            {TIP_OPTIONS.map((tip) => (
              <button
                key={tip.value}
                type="button"
                onClick={() => onSelectTipOption(tip.value)}
                className={[
                  'min-h-[24px] rounded-full px-2 text-[9px] font-semibold transition-colors',
                  selectedTipOption === tip.value
                    ? 'bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(45,80,22,0.18)]'
                    : 'border border-[#D9E2CD] bg-white text-[#344054] hover:border-primary/30 hover:bg-primary/5',
                ].join(' ')}
              >
                {tip.label}
              </button>
            ))}
          </div>

          {selectedTipOption === 'custom' ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={customTipInput}
              onChange={(event) => onSetCustomTipInput(event.target.value)}
              placeholder="Custom tip"
              className="mb-1 min-h-[30px] w-full rounded-2xl border border-[#D9E2CD] bg-[#FCFDF9] px-3 text-[11px] text-[#1F2719] outline-none transition focus:border-primary/40"
            />
          ) : null}

          <SummaryRow label="Subtotal" value={subtotal} />
          <SummaryRow label="Discount" value={discountAmount} dim />
          <SummaryRow label="GST" value={taxAmount} />
          {tipAmount > 0 ? <SummaryRow label="Tip" value={tipAmount} /> : null}
          <div className="mt-1 flex items-center justify-between border-t border-[#E1E7D9] pt-1">
            <span className="text-[13px] font-semibold text-[#1F2719]">Total</span>
            <span className="text-[17px] font-semibold tracking-[-0.03em] text-[#1F2719]">
              Rs {total.toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={isEmpty}
          className="flex min-h-[36px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[12px] font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(45,80,22,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Continue to Payment
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  dim = false,
}: {
  label: string;
  value: number;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[10px]">
      <span className="text-[#667085]">{label}</span>
      <span className={`font-semibold ${dim ? 'text-[#667085]' : 'text-[#1F2719]'}`}>Rs {value.toFixed(2)}</span>
    </div>
  );
}
