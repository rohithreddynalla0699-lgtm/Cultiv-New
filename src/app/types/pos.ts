import type { CounterPaymentMethod, OrderItemSelection } from './platform';

export type PosOrderChannel = 'counter' | 'walk_in' | 'phone';

export interface PosCartLine {
  id: string;
  itemId: string;
  title: string;
  category: string;
  quantity: number;
  unitPrice: number;
  selections: OrderItemSelection[];
}

export interface PosMenuCategory {
  slug: string;
  name: string;
  icon: string;
  itemCount: number;
}

export interface PosOrderPayload {
  storeId: string;
  orderChannel: PosOrderChannel;
  customerName?: string;
  customerPhone: string;
  tipPercentage: number;
  tipAmount: number;
  paymentMethod: CounterPaymentMethod;
  items: Array<{
    itemId: string;
    title: string;
    category: string;
    quantity: number;
    price: number;
    selections: OrderItemSelection[];
  }>;
  placedBy?: string;
}

export interface PosPaymentPayload {
  orderId: string;
  paymentMethod: CounterPaymentMethod;
  amount: number;
  recordedBy?: string;
}

export interface PosReceipt {
  orderId: string;
  orderChannel: PosOrderChannel;
  customerName: string;
  customerPhone: string;
  paymentMethod: CounterPaymentMethod;
  subtotal: number;
  tipAmount: number;
  total: number;
  createdAt: string;
}
