import type { PosCustomerDraft, PosPaymentDraft, PosPaymentMethod, PosReceiptDeliveryOption } from '../../../types/pos';

export function normalizePosPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function isValidPosPhone(value: string) {
  return normalizePosPhone(value).length === 10;
}

export function isValidEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function parseCashReceived(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function calculateChangeDue(total: number, cashReceived: string) {
  const parsed = parseCashReceived(cashReceived);
  if (parsed === null || Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.round((parsed - total) * 100) / 100);
}

export function normalizePosPaymentMethod(value: unknown): PosPaymentMethod | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'cash') return 'cash';
  if (normalized === 'upi') return 'upi';
  if (normalized === 'card') return 'card';

  return null;
}

export function getCashValidationMessage(total: number, cashReceived: string) {
  const parsed = parseCashReceived(cashReceived);
  if (parsed === null) return 'Enter the amount received.';
  if (Number.isNaN(parsed)) return 'Enter a valid cash amount.';
  if (parsed < total) {
    const shortfall = Math.round((total - parsed) * 100) / 100;
    return `Cash is short by Rs ${shortfall.toFixed(2)}.`;
  }
  return null;
}

export function getPaymentValidationMessage(params: {
  cartCount: number;
  total: number;
  payment: PosPaymentDraft;
}) {
  const { cartCount, total, payment } = params;

  if (cartCount === 0) return 'Add at least one item before taking payment.';
  if (!normalizePosPaymentMethod(payment.method)) return 'Select a payment method.';
  if (payment.method === 'cash') return getCashValidationMessage(total, payment.cashReceived);
  return null;
}

export function getReceiptContactRequirements(option: PosReceiptDeliveryOption) {
  return {
    needsPhone: option === 'text' || option === 'all',
    needsEmail: option === 'email' || option === 'all',
  };
}

export function getReceiptContactErrors(
  option: PosReceiptDeliveryOption,
  customer: Pick<PosCustomerDraft, 'phone' | 'email'>,
) {
  const { needsPhone, needsEmail } = getReceiptContactRequirements(option);

  return {
    phone:
      needsPhone && !isValidPosPhone(customer.phone)
        ? 'Enter a valid 10-digit phone number for text receipt.'
        : null,
    email:
      needsEmail && !isValidEmail(customer.email)
        ? 'Enter a valid email address for email receipt.'
        : null,
  };
}

export function formatPosPaymentMethod(method: PosPaymentMethod) {
  if (method === 'upi') return 'UPI';
  if (method === 'card') return 'Card';
  return 'Cash';
}
