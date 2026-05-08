import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ReceiptData } from '../types/receipt';
import { Receipt } from './Receipt';

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
  onPrint?: () => void;
  footerContent?: ReactNode;
}

export function ReceiptModal({
  open,
  onClose,
  data,
  onPrint,
  footerContent,
}: ReceiptModalProps) {
  useEffect(() => {
    if (!open || !data || typeof document === 'undefined') {
      return;
    }

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousHtmlOverflow = documentElement.style.overflow;
    const scrollbarCompensation = window.innerWidth - documentElement.clientWidth;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    if (scrollbarCompensation > 0) {
      body.style.paddingRight = `${scrollbarCompensation}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.paddingRight = previousBodyPaddingRight;
      documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open, data]);

  if (!open || !data) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+5.25rem)] z-[100] overflow-hidden bg-black/35 backdrop-blur-sm sm:top-[calc(env(safe-area-inset-top)+5.75rem)]">
      <div className="flex h-full items-start justify-center overflow-hidden px-3 py-4 sm:px-4 sm:py-5">
        <div className="relative flex w-full max-w-[520px] min-h-0 flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_20px_48px_rgba(16,24,40,0.18)] max-h-[65vh] sm:max-h-[70vh]">
          <div className="flex flex-none items-center justify-between border-b border-[#EEF2E8] px-5 py-4">
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#15230F]">
              Digital Receipt
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6D7C62] transition hover:bg-black/5"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="mx-auto w-full max-w-[440px]">
              <Receipt data={data} variant="screen" showActions={false} />
            </div>
          </div>

          <div className="flex-none border-t border-[#EEF2E8] px-4 py-3 sm:px-5">
            {footerContent ?? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onPrint}
                  className="inline-flex h-[34px] items-center justify-center rounded-full border border-primary/20 px-4 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5"
                >
                  Print Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
