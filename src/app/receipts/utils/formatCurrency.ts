// Format number as currency (INR)
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}
