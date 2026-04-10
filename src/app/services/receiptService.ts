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
