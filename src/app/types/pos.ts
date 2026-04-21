import type { CounterPaymentMethod, Order, OrderItemSelection } from './platform';

export type PosOrderChannel = 'in_store';
export type PosStep = 'cart' | 'payment' | 'receipt';
export type PosReceiptDeliveryOption = 'print' | 'email' | 'text' | 'all';

export interface PosCartLine {
  id: string;
  key: string;
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

export interface PosCustomerDraft {
  phone: string;
  email: string;
  skipped: boolean;
}

export interface PosCustomerLookupResult {
  customerId: string;
  fullName: string;
  phone: string;
  email?: string;
  rewardPoints?: number;
}

export interface PosCustomerLookupState {
  status: 'idle' | 'loading' | 'found' | 'not_found' | 'linked';
  result: PosCustomerLookupResult | null;
  linkedCustomer: PosCustomerLookupResult | null;
  error: string | null;
}

export interface PosPaymentDraft {
  method: CounterPaymentMethod | null;
  cashReceived: string;
  changeDue: number;
  reference: string;
}

export interface PosOrderPayload {
  storeId: string;
  orderChannel: PosOrderChannel;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  linkedCustomerId?: string | null;
  tipPercentage: number;
  tipAmount: number;
  paymentMethod: CounterPaymentMethod;
  paymentReference?: string;
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
  reference?: string;
}

export interface PosCreatedOrder {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: CounterPaymentMethod;
  createdAt: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface PosCheckoutState {
  step: PosStep;
  customer: PosCustomerDraft;
  customerLookup: PosCustomerLookupState;
  payment: PosPaymentDraft;
  createdOrder: PosCreatedOrder | null;
  isSubmittingPayment: boolean;
  isSendingReceipt: boolean;
  paymentError: string | null;
  receiptError: string | null;
}

export interface PosReceipt {
  orderId: string;
  orderChannel: PosOrderChannel;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: CounterPaymentMethod;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  createdAt: string;
}

export interface PosCreateOrderResult {
  order: Order;
  receipt: PosReceipt;
}
