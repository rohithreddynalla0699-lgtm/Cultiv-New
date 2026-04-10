import type { ReceiptMeta } from '../types/receipt';
import { formatReceiptDate } from '../utils/formatReceiptDate';
import { getDisplayOrderNumber } from '../../utils/orderDisplay';

export function ReceiptHeader({ meta }: { meta: ReceiptMeta }) {
  return (
    <div className="mb-4 text-center">
      <div className="font-bold text-xl tracking-wide">CULTIV</div>
      <div className="text-xs text-gray-500 mt-1">
        Order #{getDisplayOrderNumber({ id: meta.orderId, orderNumber: meta.orderNumber })}
      </div>
      <div className="text-xs text-gray-400">{formatReceiptDate(meta.createdAt)}</div>
      {meta.customerName && (
        <div className="text-xs text-gray-600 mt-1">{meta.customerName} {meta.customerPhone && `· ${meta.customerPhone}`}</div>
      )}
      {meta.paymentMethod && (
        <div className="text-xs text-gray-500 mt-1">Paid via {meta.paymentMethod}</div>
      )}
    </div>
  );
}
