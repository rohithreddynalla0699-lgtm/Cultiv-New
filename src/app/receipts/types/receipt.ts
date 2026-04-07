// UI-facing receipt types for shared receipt system

export interface ReceiptLineSelection {
  section: string;
  choices: string[];
}

export interface ReceiptLineItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  selections: ReceiptLineSelection[];
}

export interface ReceiptTotals {
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
}

export interface ReceiptMeta {
  orderNumber: string;
  orderId: string;
  createdAt: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface ReceiptData {
  meta: ReceiptMeta;
  items: ReceiptLineItem[];
  totals: ReceiptTotals;
}
