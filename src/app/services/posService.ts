import type { CreateCounterWalkInOrderInput } from '../types/platform';
import type { PosOrderPayload, PosPaymentPayload, PosReceipt } from '../types/pos';

interface CreateOrderDeps {
  createCounterWalkInOrder: (input: CreateCounterWalkInOrderInput) => Promise<{ id: string }>;
}

interface RecordPaymentDeps {
  // Reserved for payment repository integration.
}

const mapToCounterOrderInput = (payload: PosOrderPayload): CreateCounterWalkInOrderInput => {
  return {
    storeId: payload.storeId,
    fullName: payload.customerName,
    phone: payload.customerPhone,
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
  async createOrder(payload: PosOrderPayload, deps: CreateOrderDeps): Promise<PosReceipt> {
    const createdOrder = await deps.createCounterWalkInOrder(mapToCounterOrderInput(payload));
    const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const total = subtotal + payload.tipAmount;

    return {
      orderId: createdOrder.id,
      orderChannel: payload.orderChannel,
      customerName: payload.customerName?.trim() || 'Walk-in Customer',
      customerPhone: payload.customerPhone,
      paymentMethod: payload.paymentMethod,
      subtotal,
      tipAmount: payload.tipAmount,
      total,
      createdAt: new Date().toISOString(),
    };
  },

  async recordPayment(_payload: PosPaymentPayload, _deps?: RecordPaymentDeps) {
    // Payment table write should happen in repository integration phase.
    return { success: true };
  },
};
