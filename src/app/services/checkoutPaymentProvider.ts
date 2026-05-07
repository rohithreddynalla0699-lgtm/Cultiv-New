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

const configuredProvider = (import.meta.env.VITE_PAYMENT_PROVIDER || '').trim().toLowerCase();

export const isCheckoutPaymentProvider = (value: unknown): value is CheckoutPaymentProvider => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'mock' || normalized === 'razorpay';
};

export const configuredCheckoutPaymentProvider: CheckoutPaymentProvider | null = isCheckoutPaymentProvider(configuredProvider)
  ? configuredProvider
  : null;

export const resolveCheckoutPaymentProvider = (
  gateway: unknown,
): CheckoutPaymentProvider | null => {
  if (!isCheckoutPaymentProvider(gateway)) {
    return null;
  }

  return gateway.trim().toLowerCase() as CheckoutPaymentProvider;
};
