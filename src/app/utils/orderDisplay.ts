// Shared order display utilities

export function getDisplayOrderNumber(order: { orderNumber?: string; id: string }) {
  return order.orderNumber || order.id.slice(-6).toUpperCase();
}
