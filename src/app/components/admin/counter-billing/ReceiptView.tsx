import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useReceiptData } from '../../receipts/hooks/useReceiptData';
import { Receipt } from '../../receipts/components/Receipt';

// Temporary compatibility wrapper for POS receipt
export function ReceiptView({ receipt, onNewOrder }) {
  const { getOrderById } = useAuth();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (receipt?.orderId) {
      const fetchOrder = async () => {
        const o = await getOrderById(receipt.orderId);
        setOrder(o);
      };
      fetchOrder();
    }
  }, [receipt, getOrderById]);

  const receiptData = useReceiptData(order);

  if (!order || !receiptData) return null;

  return (
    <Receipt data={receiptData} variant="screen" showActions={true} onPrint={() => window.print()} />
  );
}
