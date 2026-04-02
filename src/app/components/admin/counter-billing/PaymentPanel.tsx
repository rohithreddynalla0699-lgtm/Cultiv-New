interface PaymentPanelProps {
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

const TONE_CLASS = {
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
} as const;

export function PaymentPanel({ message, tone }: PaymentPanelProps) {
  return <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${TONE_CLASS[tone]}`}>{message}</div>;
}
