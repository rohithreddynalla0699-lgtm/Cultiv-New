import { lookupInternalCustomerByPhone } from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';
import type { PosCustomerLookupResult } from '../types/pos';

export const customerDirectoryService = {
  async lookupPosCustomerByPhone(session: InternalAccessSession, phone: string): Promise<PosCustomerLookupResult | null> {
    const { data, error } = await lookupInternalCustomerByPhone({
      internalSessionToken: session.internalSessionToken,
      phone,
    });

    if (error || !data?.success) {
      throw new Error(error ?? 'Could not search customers.');
    }

    if (!data.customer) {
      return null;
    }

    return {
      customerId: data.customer.customerId,
      fullName: data.customer.fullName,
      phone: data.customer.phone,
      email: data.customer.email,
      rewardPoints: data.customer.rewardPoints,
    };
  },
};
