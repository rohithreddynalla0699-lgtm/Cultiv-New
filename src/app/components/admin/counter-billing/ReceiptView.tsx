import { CheckCircle2, Mail, MessageSquareText, Printer, RefreshCcw } from 'lucide-react';
import { Receipt } from '../../../receipts/components/Receipt';
import type { ReceiptData } from '../../../receipts/types/receipt';
import type { PosCreatedOrder, PosCustomerDraft, PosReceiptDeliveryOption } from '../../../types/pos';
import { formatPosPaymentMethod, getReceiptContactErrors, getReceiptContactRequirements } from './posCheckout';

interface ReceiptViewProps {
  createdOrder: PosCreatedOrder;
  customer: PosCustomerDraft;
  receiptData: ReceiptData | null;
  selectedDeliveryOption: PosReceiptDeliveryOption;
  isSendingReceipt: boolean;
  receiptError: string | null;
  receiptSuccessMessage: string | null;
  onSelectDeliveryOption: (option: PosReceiptDeliveryOption) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onSendReceipt: () => void;
  onNewOrder: () => void;
}

const DELIVERY_OPTIONS: Array<{
  value: PosReceiptDeliveryOption;
  label: string;
  icon: typeof Printer;
}> = [
  { value: 'print', label: 'Print', icon: Printer },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'text', label: 'Text', icon: MessageSquareText },
  { value: 'all', label: 'All 3', icon: RefreshCcw },
];

export function ReceiptView({
  createdOrder,
  customer,
  receiptData,
  selectedDeliveryOption,
  isSendingReceipt,
  receiptError,
  receiptSuccessMessage,
  onSelectDeliveryOption,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onSendReceipt,
  onNewOrder,
}: ReceiptViewProps) {
  const requirements = getReceiptContactRequirements(selectedDeliveryOption);
  const errors = getReceiptContactErrors(selectedDeliveryOption, customer);
  const actionLabel = getActionLabel(selectedDeliveryOption);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[#DCE9D8] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBF5_100%)] shadow-[0_12px_28px_rgba(31,46,18,0.08)]">
      <div className="border-b border-[#E8F0E2] px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
              Payment complete
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
              Ready to finish receipt actions
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label="Order" value={`#${createdOrder.orderNumber}`} />
          <SummaryCard label="Method" value={formatPosPaymentMethod(createdOrder.paymentMethod)} />
          <SummaryCard label="Paid" value={`Rs ${createdOrder.total.toFixed(2)}`} />
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col items-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7A8B6E]">
            Receipt Preview
          </p>

          <div className="mt-3 w-full max-w-[352px] rounded-[24px] bg-white p-3 shadow-[0_16px_40px_rgba(26,39,17,0.08)] ring-1 ring-[#ECF1E6]">
            <div className="max-h-[320px] overflow-y-auto rounded-[18px] bg-[#FBFCF8] p-2">
              {receiptData ? <Receipt data={receiptData} variant="screen" showActions={false} /> : null}
            </div>
          </div>

          <button
            type="button"
            className="mt-3 text-[11px] font-medium text-[#667085] underline-offset-2 transition hover:text-primary hover:underline"
          >
            View larger preview
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = selectedDeliveryOption === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelectDeliveryOption(option.value)}
                  className={[
                    'flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] border px-3 py-2 text-center transition',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(45,80,22,0.16)]'
                      : 'border-[#D9E2CD] bg-white text-[#1F2719] hover:border-primary/30 hover:bg-primary/5',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  <div className="text-[13px] font-semibold tracking-[-0.02em]">{option.label}</div>
                </button>
              );
            })}
          </div>

          {requirements.needsPhone || requirements.needsEmail ? (
            <div className="rounded-[16px] bg-[#F7F9F4] px-3 py-3">
              <div className="grid gap-2 md:grid-cols-2">
                {requirements.needsPhone ? (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A8B6E]">
                      Phone
                    </p>
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(event) => onCustomerPhoneChange(event.target.value)}
                      placeholder="Phone number"
                      className="min-h-[38px] w-full rounded-2xl border border-[#D9E2CD] bg-white px-3 text-[12px] text-[#1F2719] outline-none transition focus:border-primary/40"
                    />
                    {errors.phone ? <p className="mt-1 text-[11px] font-medium text-[#B42318]">{errors.phone}</p> : null}
                  </div>
                ) : null}

                {requirements.needsEmail ? (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A8B6E]">
                      Email
                    </p>
                    <input
                      type="email"
                      value={customer.email}
                      onChange={(event) => onCustomerEmailChange(event.target.value)}
                      placeholder="Email address"
                      className="min-h-[38px] w-full rounded-2xl border border-[#D9E2CD] bg-white px-3 text-[12px] text-[#1F2719] outline-none transition focus:border-primary/40"
                    />
                    {errors.email ? <p className="mt-1 text-[11px] font-medium text-[#B42318]">{errors.email}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {receiptError ? (
            <div className="rounded-2xl border border-[#F2D6D6] bg-[#FEF3F2] px-3 py-2 text-[11px] font-medium text-[#B42318]">
              {receiptError}
            </div>
          ) : null}

          {receiptSuccessMessage ? (
            <div className="rounded-2xl border border-[#D0E9D7] bg-[#ECFDF3] px-3 py-2 text-[11px] font-medium text-[#027A48]">
              {receiptSuccessMessage}
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onSendReceipt}
              disabled={isSendingReceipt || Boolean(errors.phone) || Boolean(errors.email)}
              className="w-full rounded-full border border-[#D9E2CD] bg-white px-4 py-2.5 text-[11px] font-medium text-[#344054] transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSendingReceipt ? `Sending ${actionLabel}...` : `Send ${actionLabel}`}
            </button>
            <button
              type="button"
              onClick={onNewOrder}
              className="text-[11px] font-medium text-[#667085] transition hover:text-[#344054]"
            >
              No Thanks
            </button>
            <button
              type="button"
              onClick={onNewOrder}
              className="w-full rounded-full bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-[0_14px_28px_rgba(45,80,22,0.2)] transition hover:translate-y-[-1px]"
            >
              Start New Order
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#E7EDE0] bg-[#FAFBF8] px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A8B6E]">{label}</p>
      <p className="mt-0.5 text-[14px] font-medium tracking-[-0.02em] text-[#1F2719]">{value}</p>
    </div>
  );
}

function getActionLabel(option: PosReceiptDeliveryOption) {
  if (option === 'all') return 'all receipts';
  if (option === 'text') return 'text receipt';
  if (option === 'email') return 'email receipt';
  return 'print receipt';
}
