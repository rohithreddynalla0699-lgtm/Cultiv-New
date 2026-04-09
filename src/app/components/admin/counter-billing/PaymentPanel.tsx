import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Smartphone } from 'lucide-react';
import type { CounterPaymentMethod } from '../../../types/platform';
import type {
  PosCustomerDraft,
  PosCustomerLookupState,
  PosPaymentDraft,
} from '../../../types/pos';

interface PaymentPanelProps {
  storeName: string;
  itemCount: number;
  customer: PosCustomerDraft;
  customerLookup: PosCustomerLookupState;
  payment: PosPaymentDraft;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  isSubmitting: boolean;
  paymentError: string | null;
  onCustomerPhoneChange: (value: string) => void;
  onFindCustomer: () => void;
  onLinkCustomer: () => void;
  onRemoveLinkedCustomer: () => void;
  onSkipCustomer: () => void;
  onSelectPaymentMethod: (method: CounterPaymentMethod) => void;
  onCashReceivedChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onExactCash: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

const PAYMENT_OPTIONS: Array<{
  method: Extract<CounterPaymentMethod, 'cash' | 'upi'>;
  label: string;
  icon: typeof Smartphone;
}> = [
  {
    method: 'cash',
    label: 'Cash',
    icon: Banknote,
  },
  {
    method: 'upi',
    label: 'UPI',
    icon: Smartphone,
  },
];

export function PaymentPanel({
  storeName,
  itemCount,
  customer,
  customerLookup,
  payment,
  subtotal,
  taxAmount,
  tipAmount,
  total,
  isSubmitting,
  paymentError,
  onCustomerPhoneChange,
  onFindCustomer,
  onLinkCustomer,
  onRemoveLinkedCustomer,
  onSkipCustomer,
  onSelectPaymentMethod,
  onCashReceivedChange,
  onReferenceChange,
  onExactCash,
  onBack,
  onSubmit,
}: PaymentPanelProps) {
  const canFindCustomer = customer.phone.length === 10 && customerLookup.status !== 'loading';

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#E5EBDD] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCF8_100%)] shadow-[0_12px_28px_rgba(31,46,18,0.08)]">
      <div className="border-b border-[#EEF2E8] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
          Payment
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
          {storeName} · {itemCount} item{itemCount === 1 ? '' : 's'} · Rs {total.toFixed(2)}
        </p>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        <SectionCard eyebrow="Phone">
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={customer.phone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="Customer phone"
            className="min-h-[38px] min-w-0 flex-1 rounded-2xl border border-[#D9E2CD] bg-[#FCFDF9] px-3 text-[12px] text-[#1F2719] outline-none transition focus:border-primary/40"
            />
            <button
              type="button"
              onClick={onFindCustomer}
              disabled={!canFindCustomer}
              className="min-h-[36px] shrink-0 rounded-full border border-primary/18 bg-primary/5 px-3 text-[10px] font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {customerLookup.status === 'loading' ? 'Finding...' : 'Find customer'}
            </button>
            <button
              type="button"
              onClick={onSkipCustomer}
              className="min-h-[36px] shrink-0 rounded-full border border-[#D9E2CD] px-2.5 text-[10px] font-semibold text-[#344054] transition hover:bg-[#F8FAF5]"
            >
              {customer.skipped ? 'Skipped' : 'Skip'}
            </button>
          </div>

          {customerLookup.error ? (
            <p className="mt-2 text-[11px] font-medium text-[#B42318]">{customerLookup.error}</p>
          ) : null}

          {customerLookup.status === 'not_found' ? (
            <div className="mt-2 rounded-[14px] bg-[#F7F9F4] px-3 py-2 text-[11px] font-medium text-[#667085]">
              No customer found for this phone number. You can continue as guest.
            </div>
          ) : null}

          {customerLookup.linkedCustomer ? (
            <div className="mt-2 rounded-[16px] border border-[#D0E9D7] bg-[#ECFDF3] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#027A48]">
                    Linked customer
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#1F2719]">
                    {customerLookup.linkedCustomer.fullName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#667085]">
                    {customerLookup.linkedCustomer.phone}
                    {customerLookup.linkedCustomer.email ? ` · ${customerLookup.linkedCustomer.email}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onRemoveLinkedCustomer}
                  className="shrink-0 text-[11px] font-semibold text-[#027A48] transition hover:opacity-80"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {customerLookup.result && !customerLookup.linkedCustomer ? (
            <div className="mt-2 rounded-[16px] border border-[#E7EDE0] bg-[#F8FAF5] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D7C62]">
                Customer found
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[#1F2719]">
                {customerLookup.result.fullName}
              </p>
              <p className="mt-0.5 text-[11px] text-[#667085]">
                {customerLookup.result.phone}
                {customerLookup.result.email ? ` · ${customerLookup.result.email}` : ''}
              </p>
              <button
                type="button"
                onClick={onLinkCustomer}
                className="mt-2 min-h-[34px] rounded-full border border-primary/18 bg-white px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/5"
              >
                Link customer
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard eyebrow="Payment method">
          <div className="grid gap-2 md:grid-cols-2">
            {PAYMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = payment.method === option.method;

              return (
                <button
                  key={option.method}
                  type="button"
                  onClick={() => onSelectPaymentMethod(option.method)}
                  className={[
                    'flex min-h-[62px] items-center gap-2 rounded-[16px] border px-2.5 py-2 text-left transition',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-[0_14px_24px_rgba(45,80,22,0.2)]'
                      : 'border-[#D9E2CD] bg-[#FCFDF9] text-[#1F2719] hover:border-primary/30 hover:bg-primary/5',
                  ].join(' ')}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-white/15">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-[13px] font-semibold tracking-[-0.02em]">{option.label}</div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {payment.method === 'cash' ? (
          <SectionCard eyebrow="Cash">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_132px]">
              <input
                type="number"
                min="0"
                step="0.01"
                value={payment.cashReceived}
                onChange={(event) => onCashReceivedChange(event.target.value)}
                placeholder="Amount received"
                className="min-h-[38px] rounded-2xl border border-[#D9E2CD] bg-[#FCFDF9] px-3 text-[12px] text-[#1F2719] outline-none transition focus:border-primary/40"
              />
              <button
                type="button"
                onClick={onExactCash}
                className="min-h-[38px] rounded-2xl border border-primary/18 bg-primary/5 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
              >
                Exact cash
              </button>
            </div>

            <div className="mt-1.5 rounded-2xl border border-[#E7EDE0] bg-[#F8FAF5] p-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#667085]">Amount due</span>
                <span className="font-semibold text-[#1F2719]">Rs {total.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[13px] font-semibold">
                <span className="text-[#1F2719]">Change due</span>
                <span className="text-[#1F2719]">Rs {payment.changeDue.toFixed(2)}</span>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {payment.method === 'upi' ? (
          <SectionCard eyebrow="UPI">
            <div className="grid gap-2.5 md:grid-cols-[148px_minmax(0,1fr)]">
              <div className="rounded-[16px] border border-[#D9E2CD] bg-[#FCFDF9] p-2">
                <div className="grid aspect-square grid-cols-7 gap-1 rounded-[10px] bg-white p-1.5">
                  {Array.from({ length: 49 }).map((_, index) => {
                    const filled = [
                      0, 1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 18, 20, 21, 24, 27, 28, 30,
                      32, 33, 34, 35, 37, 39, 41, 42, 44, 46, 47, 48,
                    ].includes(index);
                    return (
                      <span
                        key={index}
                        className={filled ? 'rounded-[2px] bg-[#1F2719]' : 'rounded-[2px] bg-transparent'}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 flex-col justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D7C62]">
                    Scan to pay
                  </p>
                  <p className="mt-0.5 text-[18px] font-semibold tracking-[-0.03em] text-[#1F2719]">
                    Rs {total.toFixed(2)}
                  </p>
                </div>

                <input
                  type="text"
                  value={payment.reference}
                  onChange={(event) => onReferenceChange(event.target.value)}
                  placeholder="UPI ref (optional)"
                  className="min-h-[38px] w-full rounded-2xl border border-[#D9E2CD] bg-[#FCFDF9] px-3 text-[12px] text-[#1F2719] outline-none transition focus:border-primary/40"
                />
              </div>
            </div>
          </SectionCard>
        ) : null}

        <div className="rounded-[16px] border border-[#E7EDE0] bg-[#F8FAF5] p-2.5">
          <SummaryRow label="Subtotal" value={subtotal} />
          <SummaryRow label="Tax" value={taxAmount} />
          <SummaryRow label="Tip" value={tipAmount} />
          <div className="mt-1.5 flex items-center justify-between border-t border-[#E1E7D9] pt-1.5">
            <span className="text-[14px] font-semibold text-[#1F2719]">Total</span>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-[#1F2719]">
              Rs {total.toFixed(2)}
            </span>
          </div>
        </div>

        {paymentError ? (
          <div className="rounded-2xl border border-[#F2D6D6] bg-[#FEF3F2] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
            {paymentError}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#EEF2E8] px-3 py-2">
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-full border border-[#D9E2CD] bg-white px-3 text-[11px] font-semibold text-[#344054] transition hover:bg-[#F8FAF5] disabled:opacity-60"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cart
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex min-h-[38px] flex-[1.4] items-center justify-center gap-2 rounded-full bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(45,80,22,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? 'Completing payment...' : 'Complete Payment'}
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionCard({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E7EDE0] bg-white p-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D7C62]">{eyebrow}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-[#667085]">{label}</span>
      <span className="font-semibold text-[#1F2719]">Rs {value.toFixed(2)}</span>
    </div>
  );
}
