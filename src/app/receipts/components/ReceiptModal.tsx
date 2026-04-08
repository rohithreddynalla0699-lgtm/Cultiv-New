import { X } from 'lucide-react';
import type { ReceiptData } from '../types/receipt';
import { Receipt } from './Receipt';

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
  onPrint?: () => void;
}

export function ReceiptModal({
  open,
  onClose,
  data,
  onPrint,
}: ReceiptModalProps) {
  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-3">
        <div className="relative w-full max-w-[330px] sm:max-w-[345px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full text-[#6D7C62] transition hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_20px_48px_rgba(16,24,40,0.18)]">
            <div className="flex h-[68vh] max-h-[600px] min-h-[500px] flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5 sm:px-3">
                <Receipt data={data} variant="screen" showActions={false} />
              </div>

              <div className="shrink-0 border-t border-[#EEF2E8] px-3 py-3">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onPrint}
                    className="inline-flex h-[34px] items-center justify-center rounded-full border border-primary/20 px-4 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Print Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}