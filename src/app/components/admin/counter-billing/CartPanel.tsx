import { CartItemRow } from './CartItemRow';
import type { CounterPaymentMethod } from '../../../types/platform';
import type { PosCartLine } from '../../../types/pos';

interface CartPanelProps {
  cartLines: PosCartLine[];
  tipPercentage: number;
  subtotal: number;
  tipAmount: number;
  total: number;
  selectedPaymentMethod: CounterPaymentMethod | null;
  customerPhone: string;
  customerName: string;
  phoneSkipped: boolean;
  orderChannel: 'counter' | 'walk_in' | 'phone';
  isSubmitting: boolean;
  canSubmit: boolean;
  onSetTip: (nextTip: number) => void;
  onSetOrderChannel: (next: 'counter' | 'walk_in' | 'phone') => void;
  onPhoneChange: (nextValue: string) => void;
  onNameChange: (nextValue: string) => void;
  onToggleSkipPhone: () => void;
  onSelectPaymentMethod: (method: CounterPaymentMethod) => void;
  onIncrementLine: (lineId: string) => void;
  onDecrementLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onCharge: () => void;
}

const TIP_OPTIONS = [0, 5, 10, 15] as const;
const CHANNEL_OPTIONS = [
  { value: 'counter', label: 'Counter' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
] as const;
const PAYMENT_OPTIONS: CounterPaymentMethod[] = ['cash', 'upi', 'card'];

export function CartPanel({
  cartLines,
  tipPercentage,
  subtotal,
  tipAmount,
  total,
  selectedPaymentMethod,
  customerPhone,
  customerName,
  phoneSkipped,
  orderChannel,
  isSubmitting,
  canSubmit,
  onSetTip,
  onSetOrderChannel,
  onPhoneChange,
  onNameChange,
  onToggleSkipPhone,
  onSelectPaymentMethod,
  onIncrementLine,
  onDecrementLine,
  onRemoveLine,
  onCharge,
}: CartPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold text-foreground">Cart & Payment</h3>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Order Channel</p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetOrderChannel(option.value)}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${orderChannel === option.value ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground/70'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {cartLines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/35 px-3 py-4 text-center text-sm text-foreground/55">
              Cart is empty.
            </div>
          ) : (
            cartLines.map((line) => (
              <CartItemRow
                key={line.id}
                line={line}
                onIncrement={() => onIncrementLine(line.id)}
                onDecrement={() => onDecrementLine(line.id)}
                onRemove={() => onRemoveLine(line.id)}
              />
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/70">Subtotal</span>
            <span className="font-semibold text-foreground">Rs {subtotal.toFixed(2)}</span>
          </div>

          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Tip</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {TIP_OPTIONS.map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => onSetTip(tip)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tipPercentage === tip ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground/70'}`}
                >
                  {tip === 0 ? '0%' : `${tip}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-foreground/70">Tip amount</span>
            <span className="font-semibold text-foreground">Rs {tipAmount.toFixed(2)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Customer</p>
          <input
            type="tel"
            value={customerPhone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="Customer phone"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={customerName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Customer name (optional)"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button type="button" onClick={onToggleSkipPhone} className="mt-2 text-xs font-semibold text-foreground/70 underline">
            {phoneSkipped ? 'Use customer phone capture' : 'Guest / Skip'}
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Payment</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onSelectPaymentMethod(method)}
                className={`rounded-lg px-3 py-3 text-sm font-semibold uppercase ${selectedPaymentMethod === method ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground/75'}`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <button
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={onCharge}
          className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? 'Processing...' : `Charge Rs ${total.toFixed(2)}`}
        </button>
      </div>
    </section>
  );
}
