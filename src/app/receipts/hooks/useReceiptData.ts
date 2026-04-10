import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import type { Order } from '../../types/platform';
import type { ReceiptData } from '../types/receipt';
import { mapOrderToReceiptData } from '../mappers/mapOrderToReceiptData';
import { fetchOrderReceipt } from '../../services/receiptService';

interface ReceiptState {
  data: ReceiptData | null;
  isLoading: boolean;
  error: string | null;
}

export function useReceiptData(order: Order | undefined): ReceiptState {
  const { customerAccount } = useAuth();
  const { session } = useAdminDashboard();
  const [state, setState] = useState<ReceiptState>({
    data: order ? mapOrderToReceiptData(order) : null,
    isLoading: false,
    error: null,
  });

  const customerSessionToken = useMemo(() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('cultiv_customer_session_token_v1') ?? 'null') as string | null;
    } catch {
      return null;
    }
  }, [customerAccount?.id]);

  useEffect(() => {
    if (!order?.id) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    let active = true;
    setState({
      data: mapOrderToReceiptData(order),
      isLoading: true,
      error: null,
    });

    void fetchOrderReceipt({
      orderId: order.id,
      customerSessionToken,
      internalSessionToken: session?.internalSessionToken ?? null,
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
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Could not load receipt.',
        });
      });

    return () => {
      active = false;
    };
  }, [customerSessionToken, order, session?.internalSessionToken]);

  return state;
}
