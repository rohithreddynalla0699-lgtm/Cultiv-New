// @ts-ignore - Supabase client is defined in JS module.
import { supabase } from '../../lib/supabase';

export interface ReceiptBusinessMeta {
  brandName: string;
  storeName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  gstin: string;
  code: string;
}

export interface BackendReceiptData {
  meta: {
    orderNumber: string;
    orderId: string;
    createdAt: string;
    orderStatus?: string | null;
    storeId?: string | null;
    paymentMethod?: string;
    paymentStatus?: string | null;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentReference?: string;
  };
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: number;
    lineTotal?: number;
    selections: Array<{
      section: string;
      choices: string[];
    }>;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    tip: number;
    total: number;
  };
  business: ReceiptBusinessMeta;
}

export type ReceiptDeliveryMethod = 'print' | 'email' | 'text' | 'all';

export interface ReceiptDeliveryResult {
  method: 'email' | 'text';
  success: boolean;
  recipient: string | null;
  provider: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SendOrderReceiptResponse {
  success: boolean;
  partial: boolean;
  code: string;
  results: ReceiptDeliveryResult[];
  deliveredMethods: string[];
  failedMethods: string[];
  message: string;
}

export async function fetchOrderReceipt(params: {
  orderId: string;
  customerSessionToken?: string | null;
  internalSessionToken?: string | null;
}): Promise<BackendReceiptData> {
  const { data, error } = await supabase.functions.invoke('order-receipt', {
    body: {
      orderId: params.orderId,
      customerSessionToken: params.customerSessionToken ?? undefined,
      internalSessionToken: params.internalSessionToken ?? undefined,
    },
  });

  if (error || !data?.success || !data?.receipt) {
    throw new Error(data?.error || error?.message || 'Could not load receipt.');
  }

  return data.receipt as BackendReceiptData;
}

export async function sendOrderReceipt(params: {
  orderId: string;
  deliveryMethod: ReceiptDeliveryMethod;
  customerSessionToken?: string | null;
  internalSessionToken?: string | null;
  email?: string;
  phone?: string;
}): Promise<SendOrderReceiptResponse> {
  const { data, error } = await supabase.functions.invoke('send-order-receipt', {
    body: {
      orderId: params.orderId,
      deliveryMethod: params.deliveryMethod,
      customerSessionToken: params.customerSessionToken ?? undefined,
      internalSessionToken: params.internalSessionToken ?? undefined,
      email: params.email ?? undefined,
      phone: params.phone ?? undefined,
    },
  });

  if (error && !data) {
    throw new Error(error.message || 'Could not deliver receipt.');
  }

  const payload = (data ?? {}) as Partial<SendOrderReceiptResponse> & { error?: string };
  return {
    success: Boolean(payload.success),
    partial: Boolean(payload.partial),
    code: String(payload.code ?? 'UNKNOWN_ERROR'),
    results: Array.isArray(payload.results) ? payload.results : [],
    deliveredMethods: Array.isArray(payload.deliveredMethods) ? payload.deliveredMethods : [],
    failedMethods: Array.isArray(payload.failedMethods) ? payload.failedMethods : [],
    message: String(payload.message ?? payload.error ?? 'Could not deliver receipt.'),
  };
}
