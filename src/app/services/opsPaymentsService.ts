import { recordInternalPosPayment } from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';
import type { CounterPaymentMethod } from '../types/platform';

export const opsPaymentsService = {
  async recordPosPayment(session: InternalAccessSession, payload: {
    orderId: string;
    paymentMethod: CounterPaymentMethod;
    amount: number;
    reference?: string;
  }) {
    const { data, error } = await recordInternalPosPayment({
      internalSessionToken: session.internalSessionToken,
      orderId: payload.orderId,
      paymentMethod: payload.paymentMethod,
      amount: payload.amount,
      reference: payload.reference,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not record POS payment.');
    }

    return data.payment;
  },
};
