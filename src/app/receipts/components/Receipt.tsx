import type { ReceiptData } from '../types/receipt';
import { formatReceiptDate } from '../utils/formatReceiptDate';
import { formatCurrency } from '../utils/formatCurrency';
import { getDisplayOrderNumber } from '../../utils/orderDisplay';

interface ReceiptProps {
  data: ReceiptData;
  variant?: 'screen' | 'print';
  showActions?: boolean;
  onPrint?: () => void;
}

export function Receipt({
  data,
  variant = 'screen',
  showActions = false,
  onPrint,
}: ReceiptProps) {
  const isPrint = variant === 'print';
  const business = {
    brandName: data.business?.brandName || 'CULTIV',
    storeName: data.business?.storeName || '',
    legalName: data.business?.legalName || '',
    addressLine1: data.business?.addressLine1 || '',
    addressLine2: data.business?.addressLine2 || '',
    city: data.business?.city || '',
    state: data.business?.state || '',
    postalCode: data.business?.postalCode || '',
    country: data.business?.country || 'India',
    phone: data.business?.phone || '',
    email: data.business?.email || 'support@eatcultiv.com',
    gstin: data.business?.gstin || '',
    code: data.business?.code || '',
  };
  const storeAddressLine = [business.addressLine1, business.addressLine2].filter(Boolean).join(', ');
  const localityLine = [business.city, business.state, business.postalCode].filter(Boolean).join(', ');
  const placeOfSupply = business.state || localityLine || business.storeName || 'India';
  const cgst = data.totals.tax > 0 ? data.totals.tax / 2 : 0;
  const sgst = data.totals.tax > 0 ? data.totals.tax / 2 : 0;
  const taxableAmount = data.totals.subtotal - data.totals.discount;

  const hasLegalMeta =
    Boolean(business.legalName) ||
    Boolean(storeAddressLine) ||
    Boolean(localityLine) ||
    Boolean(business.gstin);

  return (
    <div
      id="print-receipt"
      className={[
        'w-full text-[#1F2937]',
        isPrint
          ? 'bg-white p-3'
          : 'rounded-[18px] border border-[#EEF2E8] bg-white p-3 shadow-none',
      ].join(' ')}
    >
      <div className="border-b border-[#EEF2E8] pb-2 text-center">
        <div className="text-[17px] font-extrabold tracking-[-0.03em] text-[#15230F]">
          {business.brandName}
        </div>

        <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#6D7C62]">
          {business.storeName || 'Modern Bowls. Honest Food.'}
        </p>

        {hasLegalMeta ? (
          <div className="mt-1 space-y-0.5 text-[9px] leading-4 text-[#667085]">
            {business.legalName ? (
              <p className="font-semibold text-[#344054]">
                {business.legalName}
              </p>
            ) : null}
            {storeAddressLine ? <p>{storeAddressLine}</p> : null}
            {localityLine ? <p>{localityLine}</p> : null}
            {business.gstin ? (
              <p>
                <span className="font-medium text-[#344054]">GSTIN:</span>{' '}
                {business.gstin}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-[9px] text-[#667085]">
            {storeAddressLine || localityLine || business.storeName || business.brandName}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-[#F0F3EC] py-2">
        <MetaRow label="Invoice No." value={data.meta.orderNumber || '—'} />
        <MetaRow
          label="Date / Time"
          value={formatReceiptDate(data.meta.createdAt)}
          align="right"
        />
        <MetaRow
          label="Order Ref"
          value={`#${getDisplayOrderNumber({
          id: data.meta.orderId,
          orderNumber: data.meta.orderNumber,
})}`}
        />
        <MetaRow
          label="Place of Supply"
          value={placeOfSupply}
          align="right"
        />
      </div>

      {data.meta.customerName ? (
        <div className="border-b border-[#F0F3EC] py-2 text-[10px]">
          <span className="font-semibold text-[#344054]">Customer:</span>{' '}
          <span className="text-[#475467]">{data.meta.customerName}</span>
        </div>
      ) : null}

      <div className="py-2">
        <h3 className="mb-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#6D7C62]">
          Items
        </h3>

        <div className="overflow-hidden rounded-[14px] border border-[#F0F3EC] bg-[#F8F9F5]">
          <div className="grid grid-cols-[minmax(0,1fr)_26px_52px_60px] gap-2 border-b border-[#F0F3EC] px-2.5 py-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#6D7C62]">
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Unit</div>
            <div className="text-right">Total</div>
          </div>

          <div className="divide-y divide-[#F0F3EC]">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_26px_52px_60px] gap-2 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold leading-4.5 text-[#1D2939]">
                    {item.title}
                  </div>

                  {item.selections && item.selections.length > 0 ? (
                    <div className="mt-1 space-y-0.5 text-[9px] leading-4 text-[#667085]">
                      {item.selections.map((sel, idx) => (
                        <div key={`${item.id}-${sel.section}-${idx}`}>
                          <span className="font-semibold text-[#475467]">
                            {sel.section}:
                          </span>{' '}
                          <span>{sel.choices.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="text-right text-[9px] font-medium text-[#344054]">
                  {item.quantity}
                </div>

                <div className="text-right text-[9px] font-medium text-[#344054]">
                  {formatCurrency(item.price)}
                </div>

                <div className="text-right text-[11px] font-semibold text-[#1D2939]">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#F0F3EC] py-2">
        <div className="rounded-[14px] border border-[#F0F3EC] bg-[#FCFCFA] p-2.5">
          <h4 className="mb-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#6D7C62]">
            Payment
          </h4>

          <div className="space-y-1.5 text-[9px] text-[#475467]">
            {data.meta.paymentMethod ? (
              <div className="flex items-center justify-between gap-2">
                <span>Method</span>
                <span className="font-semibold text-[#344054]">
                  {data.meta.paymentMethod}
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <span>Status</span>
              <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[8px] font-semibold text-[#027A48]">
                {data.meta.paymentStatus ? String(data.meta.paymentStatus).replace(/_/g, ' ') : 'Recorded'}
              </span>
            </div>

            {data.meta.paymentReference ? (
              <div className="flex items-center justify-between gap-2">
                <span>Reference</span>
                <span className="font-semibold text-[#344054]">
                  {data.meta.paymentReference}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[14px] border border-[#F0F3EC] bg-[#FCFCFA] p-2.5">
          <h4 className="mb-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#6D7C62]">
            Tax Summary
          </h4>

          <div className="space-y-1 text-[9px] text-[#475467]">
            <SummaryRow label="Taxable" value={formatCurrency(taxableAmount)} />
            <SummaryRow label="CGST" value={formatCurrency(cgst)} />
            <SummaryRow label="SGST" value={formatCurrency(sgst)} />

            {data.totals.tip > 0 ? (
              <SummaryRow label="Tip" value={formatCurrency(data.totals.tip)} />
            ) : null}

            <div className="mt-2 border-t border-[#E7EBE3] pt-2">
              <SummaryRow
                label="Total"
                value={formatCurrency(data.totals.total)}
                strong
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#F0F3EC] pt-2 text-center">
        <p className="text-[10px] font-medium text-[#475467]">
          Thank you for choosing CULTIV.
        </p>
        <p className="mt-1 text-[8px] text-[#98A2B3]">
          For support, contact {business.email}
        </p>
      </div>

      {showActions ? (
        <div className="mt-2 flex justify-center print:hidden">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-primary/20 px-4 py-2 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            Print Receipt
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MetaRow({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-[#6D7C62]">
        {label}
      </div>
      <div className="mt-0.5 text-[9px] font-medium text-[#344054]">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={strong ? 'text-[11px] font-semibold text-[#101828]' : ''}>
        {label}
      </span>
      <span
        className={
          strong
            ? 'text-[13px] font-bold text-[#101828]'
            : 'font-semibold text-[#344054]'
        }
      >
        {value}
      </span>
    </div>
  );
}
