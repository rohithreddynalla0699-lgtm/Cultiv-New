import { ReactNode } from "react";
import { ModalPortal } from "./ModalPortal";
import { motion, AnimatePresence } from "framer-motion";

export function Modal({ open, onClose, children, ariaLabel }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <ModalPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
            aria-modal="true"
            role="dialog"
            aria-label={ariaLabel || undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ type: "spring", stiffness: 220, damping: 28, mass: 1 }}
              className="relative w-[min(92vw,900px)] max-h-[85vh] flex flex-col rounded-3xl bg-white/95 border border-primary/10 shadow-[0_20px_50px_rgba(20,35,10,0.14)]"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 rounded-full bg-white/80 border border-primary/10 p-2 text-foreground/60 hover:bg-primary/5 hover:text-primary transition shadow-sm"
                aria-label="Close dialog"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div className="max-h-[80vh] overflow-y-auto p-6 sm:p-10 rounded-3xl">
                {children}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}