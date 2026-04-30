import type { InternalPosCheckoutItem, InternalPosCheckoutResponse, InternalPosPaymentRecord } from '../lib/internalOpsApi';
import type { Order } from '../types/platform';
import type {
  PosCreateOrderResult,
  PosCreatedOrder,
  PosOrderPayload,
  PosPaymentPayload,
  PosReceipt,
  PosReceiptDeliveryOption,
} from '../types/pos';
import { POS_TAX_RATE } from '../constants/business';
import { getDisplayOrderNumber } from '../utils/orderDisplay';
import { sendOrderReceipt, type SendOrderReceiptResponse } from './receiptService';

interface RecordPaymentDeps {
  recordManualPayment: (payload: PosPaymentPayload) => Promise<InternalPosPaymentRecord>;
}

interface CheckoutOrderDeps {
  createPosOrder: (payload: PosAtomicCheckoutPayload) => Promise<InternalPosCheckoutResponse>;
}

interface PosAtomicCheckoutPayload {
  storeId: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: PosOrderPayload['paymentMethod'];
  paymentReference?: string;
  subtotal: number;
  taxAmount: number;
  tipPercentage: number;
  tipAmount: number;
  total: number;
  items: InternalPosCheckoutItem[];
}

interface CanonicalSelectionSnapshotRow {
  option_item_id: string | null;
  group_id_snapshot: string;
  group_name_snapshot: string;
  option_name: string;
  price_modifier: number;
}

interface SendReceiptPayload {
  option: PosReceiptDeliveryOption;
  orderId: string;
  phone?: string;
  email?: string;
  authMode?: 'customer' | 'internal';
  customerSessionToken?: string | null;
  internalSessionToken?: string | null;
}

const normalizePaymentMethod = (method: unknown): PosOrderPayload['paymentMethod'] => {
  const normalized = String(method).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'cash' || normalized === 'upi' || normalized === 'card') {
    return normalized;
  }
  throw new Error('Select a valid payment method.');
};

const toSnapshotGroupId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'selection';

const buildCanonicalSelectionSnapshots = (
  selections: PosOrderPayload['items'][number]['selections'],
): CanonicalSelectionSnapshotRow[] => (
  selections.flatMap((selection) => {
    const groupId = selection.groupIdSnapshot?.trim() || toSnapshotGroupId(selection.section);
    return selection.choices.map((choice, index) => ({
      option_item_id: selection.optionItemIds?.[index] ?? null,
      group_id_snapshot: groupId,
      group_name_snapshot: selection.section,
      option_name: choice,
      price_modifier: 0,
    }));
  })
);

export const posService = {
  async checkoutOrder(payload: PosOrderPayload, deps: CheckoutOrderDeps): Promise<PosCreateOrderResult> {
    const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    const subtotal = Number(payload.items.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2));
    const taxAmount = Number((subtotal * POS_TAX_RATE).toFixed(2));
    const tipAmount = Number(payload.tipAmount.toFixed(2));
    const total = Number((subtotal + taxAmount + tipAmount).toFixed(2));

    const checkout = await deps.createPosOrder({
      storeId: payload.storeId,
      customerId: payload.linkedCustomerId ?? null,
      customerName: payload.customerName?.trim() || 'Walk-in Guest',
      customerPhone: payload.customerPhone?.trim() || undefined,
      customerEmail: payload.customerEmail?.trim() || undefined,
      paymentMethod,
      paymentReference: payload.paymentReference,
      subtotal,
      taxAmount,
      tipPercentage: payload.tipPercentage,
      tipAmount,
      total,
      items: payload.items.map((item) => ({
        ...item,
        selections: buildCanonicalSelectionSnapshots(item.selections),
      })),
    });

    const createdAt = checkout.order.createdAt ?? new Date().toISOString();
    const order: Order = {
      id: checkout.order.orderId,
      customerId: checkout.order.customerId,
      storeId: checkout.order.storeId,
      category: payload.items[0]?.category ?? 'POS',
      items: payload.items.map((item, index) => ({
        id: `${checkout.order.orderId}-${item.itemId || index}`,
        orderId: checkout.order.orderId,
        category: item.category,
        title: item.title,
        selections: item.selections,
        quantity: item.quantity,
        price: item.price,
      })),
      orderType: 'walk_in',
      subtotal: checkout.order.subtotal,
      rewardDiscount: 0,
      taxAmount: checkout.order.taxAmount,
      total: checkout.order.total,
      status: 'completed',
      createdAt,
      phone: checkout.order.customerPhone ?? payload.customerPhone ?? '',
      fullName: checkout.order.customerName,
      email: checkout.order.customerEmail ?? payload.customerEmail ?? '',
      source: 'walk_in',
      paymentMethod,
      tipPercentage: payload.tipPercentage,
      tipAmount: checkout.order.tipAmount,
      fulfillmentWindow: 'Counter order',
      statusTimeline: [
        {
          status: 'completed',
          label: 'Paid at counter',
          description: 'The POS order and manual payment were recorded together.',
          at: createdAt,
        },
      ],
    };

    const receipt: PosReceipt = {
      orderId: checkout.order.orderId,
      orderChannel: payload.orderChannel,
      customerName: checkout.order.customerName,
      customerPhone: checkout.order.customerPhone ?? undefined,
      customerEmail: checkout.order.customerEmail ?? undefined,
      paymentMethod,
      subtotal: checkout.order.subtotal,
      taxAmount: checkout.order.taxAmount,
      tipAmount: checkout.order.tipAmount,
      total: checkout.order.total,
      createdAt,
    };

    return { order, receipt };
  },

  async recordPayment(_payload: PosPaymentPayload, _deps?: RecordPaymentDeps) {
    if (!_deps?.recordManualPayment) {
      throw new Error('POS payment recording is not configured.');
    }
    return _deps.recordManualPayment(_payload);
  },

  async sendReceipt(payload: SendReceiptPayload): Promise<SendOrderReceiptResponse> {
    return sendOrderReceipt({
      orderId: payload.orderId,
      deliveryMethod: payload.option,
      email: payload.email,
      phone: payload.phone,
      customerSessionToken: payload.authMode === 'customer' ? payload.customerSessionToken ?? null : null,
      internalSessionToken: payload.authMode === 'internal' ? payload.internalSessionToken ?? null : null,
    });
  },

  mapCreatedOrder(input: {
    order: Order;
    receipt: PosReceipt;
  }): PosCreatedOrder {
    return {
      orderId: input.order.id,
      orderNumber: getDisplayOrderNumber(input.order),
      subtotal: input.order.subtotal,
      discount: input.order.rewardDiscount ?? 0,
      tax: input.order.taxAmount ?? 0,
      tip: input.order.tipAmount ?? 0,
      total: input.order.total,
      paymentMethod: input.receipt.paymentMethod,
      createdAt: input.order.createdAt,
      customerPhone: input.receipt.customerPhone,
      customerEmail: input.receipt.customerEmail,
    };
  },
};
