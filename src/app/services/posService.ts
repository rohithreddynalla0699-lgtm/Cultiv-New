import type { InternalPosCheckoutResponse, InternalPosPaymentRecord } from '../lib/internalOpsApi';
import type { CreateCounterWalkInOrderInput, Order } from '../types/platform';
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

interface CreateOrderDeps {
  createCounterWalkInOrder: (input: CreateCounterWalkInOrderInput) => Promise<Order>;
}

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
  tipAmount: number;
  total: number;
  items: PosOrderPayload['items'];
}

interface SendReceiptPayload {
  option: PosReceiptDeliveryOption;
  orderId: string;
  phone?: string;
  email?: string;
}

const mapToCounterOrderInput = (payload: PosOrderPayload): CreateCounterWalkInOrderInput => {
  return {
    storeId: payload.storeId,
    fullName: payload.customerName,
    phone: payload.customerPhone?.trim() || undefined,
    email: payload.customerEmail?.trim() || undefined,
    linkedCustomerId: payload.linkedCustomerId,
    paymentMethod: payload.paymentMethod,
    tipPercentage: payload.tipPercentage,
    tipAmount: payload.tipAmount,
    orderChannel: payload.orderChannel,
    placedBy: payload.placedBy,
    items: payload.items.map((item) => ({
      category: item.category,
      title: item.title,
      selections: item.selections,
      quantity: item.quantity,
      price: item.price,
    })),
  };
};

export const posService = {
  async createOrder(payload: PosOrderPayload, deps: CreateOrderDeps): Promise<PosCreateOrderResult> {
    const createdOrder = await deps.createCounterWalkInOrder(mapToCounterOrderInput(payload));
    const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const taxAmount = Math.round(subtotal * POS_TAX_RATE * 100) / 100;
    const total = subtotal + taxAmount + payload.tipAmount;

    const receipt: PosReceipt = {
      orderId: createdOrder.id,
      orderChannel: payload.orderChannel,
      customerName: payload.customerName?.trim() || 'Walk-in Guest',
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail?.trim() || undefined,
      paymentMethod: payload.paymentMethod,
      subtotal,
      taxAmount,
      tipAmount: payload.tipAmount,
      total,
      createdAt: createdOrder.createdAt ?? new Date().toISOString(),
    };

    return { order: createdOrder, receipt };
  },

  async checkoutOrder(payload: PosOrderPayload, deps: CheckoutOrderDeps): Promise<PosCreateOrderResult> {
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
      paymentMethod: payload.paymentMethod,
      paymentReference: payload.paymentReference,
      subtotal,
      taxAmount,
      tipAmount,
      total,
      items: payload.items,
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
      paymentMethod: checkout.order.paymentMethod,
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
      paymentMethod: checkout.order.paymentMethod,
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

  async sendReceipt(payload: SendReceiptPayload) {
    if (payload.option === 'print') {
      return { success: true };
    }
    throw new Error('Digital receipt delivery is not enabled yet. Use print receipt for now.');
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
