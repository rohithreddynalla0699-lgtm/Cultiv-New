import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
}

export function useReceiptData(order: Order | undefined, options?: UseReceiptDataOptions): ReceiptState {
  const { customerAccount } = useAuth();
  const authMode = options?.authMode ?? 'customer';
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

  const internalSessionToken = useMemo(() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem('cultiv_admin_access_session_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { internalSessionToken?: string | null } | null;
      return parsed?.internalSessionToken?.trim() || null;
    } catch {
      return null;
    }
  }, []);

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
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Could not load receipt.',
        });
      });

    return () => {
      active = false;
    };
  }, [authMode, customerSessionToken, internalSessionToken, order]);

  return state;
}
