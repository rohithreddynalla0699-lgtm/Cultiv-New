import type { InternalPosPaymentRecord } from '../lib/internalOpsApi';
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
