import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { Order } from '../../types/platform';
import type { ReceiptData } from '../types/receipt';
import { mapOrderToReceiptData } from '../mappers/mapOrderToReceiptData';
import { fetchOrderReceipt } from '../../services/receiptService';

interface ReceiptState {
  data: ReceiptData | null;
  isLoading: boolean;
  error: string | null;
}

type ReceiptAuthMode = 'customer' | 'internal';

interface UseReceiptDataOptions {
  authMode?: ReceiptAuthMode;
  orderId?: string;
}

export function useReceiptData(order: Order | undefined, options?: UseReceiptDataOptions): ReceiptState {
  const { customerAccount, customerSessionToken } = useAuth();
  const adminDashboard = useOptionalAdminDashboard();
  const authMode = options?.authMode ?? 'customer';
  const [state, setState] = useState<ReceiptState>({
    data: order ? mapOrderToReceiptData(order) : null,
    isLoading: false,
    error: null,
  });
  const internalSessionToken = adminDashboard?.session?.internalSessionToken?.trim() || null;

  useEffect(() => {
    const resolvedOrderId = options?.orderId ?? order?.id ?? null;
    const fallbackData = order ? mapOrderToReceiptData(order) : null;

    if (!resolvedOrderId) {
      setState({ data: fallbackData, isLoading: false, error: null });
      return;
    }

    let active = true;
    setState({
      data: fallbackData,
      isLoading: true,
      error: null,
    });

    void fetchOrderReceipt({
      orderId: resolvedOrderId,
      customerSessionToken: authMode === 'customer' ? customerSessionToken : null,
      internalSessionToken: authMode === 'internal' ? internalSessionToken : null,
    })
      .then((receipt) => {
        if (!active) return;
        setState({
          data: receipt,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          data: fallbackData,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Could not load receipt.',
        });
      });

    return () => {
      active = false;
    };
  }, [authMode, customerAccount?.id, customerSessionToken, internalSessionToken, options?.orderId, order]);

  return state;
}
