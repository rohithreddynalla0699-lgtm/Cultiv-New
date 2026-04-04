import type { CustomerCheckoutPaymentMethod, PlaceOrderInput } from '../types/platform';

export type CheckoutPaymentProvider = 'mock' | 'razorpay';

export interface CheckoutPaymentIntent {
  paymentId: string;
  idempotencyKey: string;
  paymentMethod: CustomerCheckoutPaymentMethod;
  amount: number;
  amountPaise: number;
  currency: string;
  gateway: CheckoutPaymentProvider;
  gatewayOrderId?: string;
  gatewayKeyId?: string;
}

export interface ConfirmCheckoutPaymentInput {
  paymentId: string;
  orderInput?: PlaceOrderInput;
  outcome: 'succeeded' | 'failed' | 'cancelled';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  failureReason?: string;
}

const env = import.meta as unknown as { env?: Record<string, string | undefined> };

const configuredProvider = (env.env?.VITE_PAYMENT_PROVIDER || '').trim().toLowerCase();

export const defaultCheckoutPaymentProvider: CheckoutPaymentProvider = configuredProvider === 'razorpay' ? 'razorpay' : 'mock';

export const resolveCheckoutPaymentProvider = (
  gateway: unknown,
): CheckoutPaymentProvider => {
  const normalized = typeof gateway === 'string' ? gateway.trim().toLowerCase() : '';
  if (normalized === 'razorpay') {
    return 'razorpay';
  }
  if (normalized === 'mock') {
    return 'mock';
  }
  return defaultCheckoutPaymentProvider;
};
