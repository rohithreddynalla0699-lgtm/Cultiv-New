import type { Order } from '../../types/platform';
import type { ReceiptData, ReceiptLineItem } from '../types/receipt';

import { getDisplayOrderNumber } from '../../utils/orderDisplay';

export function mapOrderToReceiptData(order: Order): ReceiptData {
  const meta = {
    orderNumber: getDisplayOrderNumber(order),
    orderId: order.id,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod || undefined,
    paymentStatus: order.status === 'completed' ? 'recorded' : null,
    customerName: order.fullName || undefined,
    customerPhone: order.phone || undefined,
    customerEmail: order.email || undefined,
  };

  const items: ReceiptLineItem[] = order.items.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: Number(item.quantity),
    price: Number(item.price),
    selections: (item.selections || []).map((sel) => ({
      section: sel.section,
      choices: sel.choices,
    })),
  }));

  const totals = {
    subtotal: Number(order.subtotal),
    discount: Number(order.rewardDiscount || 0),
    tax: Number(order.taxAmount || 0),
    tip: Number(order.tipAmount || 0),
    total: Number(order.total),
  };

  return {
    meta,
    items,
    totals,
    business: {
      brandName: 'CULTIV',
      storeName: '',
      legalName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      phone: '',
      email: '',
      gstin: '',
      code: '',
    },
  };
}
