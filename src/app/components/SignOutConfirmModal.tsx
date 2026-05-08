import { Modal } from './Modal';

interface SignOutConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SignOutConfirmModal({ open, onClose, onConfirm }: SignOutConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Confirm sign out"
      panelClassName="!w-[min(90vw,336px)] !max-h-none rounded-3xl border border-[#DCE6D2] bg-[#FCFCF8] shadow-[0_20px_44px_rgba(33,49,24,0.10)]"
      bodyClassName="p-0"
      closeButtonClassName="top-3 right-3 border-[#DCE6D2] bg-white/88 p-1.5 text-[#6C7564] hover:bg-white hover:text-[#46513F] hover:shadow-none"
    >
      <div className="px-4 pb-4 pt-4.5">
        <h2 className="pr-8 text-[1.05rem] font-semibold tracking-[-0.025em] text-[#24301F]">Discard cart?</h2>
        <p className="mt-1.5 max-w-[26ch] text-[13px] leading-5 text-[#6C7564]">
          Signing out will clear the items in your cart.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-primary px-3 py-2 text-[13px] font-semibold text-white shadow-[0_10px_18px_rgba(45,80,22,0.14)] transition-all duration-200 hover:bg-primary/92 hover:shadow-[0_12px_22px_rgba(45,80,22,0.16)]"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full border border-[#E8D8D2] bg-[#F7F0EC] px-3 py-2 text-[13px] font-semibold text-[#8A5A52] transition-colors duration-200 hover:bg-[#F2E8E2] hover:text-[#774A43]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
