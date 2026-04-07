import { useMemo } from 'react';
import type { Order } from '../../types/platform';
import { mapOrderToReceiptData } from '../mappers/mapOrderToReceiptData';

export function useReceiptData(order: Order | undefined) {
  return useMemo(() => {
    if (!order) return undefined;
    return mapOrderToReceiptData(order);
  }, [order]);
}
