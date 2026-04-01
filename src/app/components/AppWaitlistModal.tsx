import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { addWaitlistEmail } from '../data/appLaunch';
import { BRAND_CONTACT } from '../config/brandContact';

interface AppWaitlistModalProps {
  isOpen: boolean;
  defaultEmail?: string;
  onClose: () => void;
}

export function AppWaitlistModal({ isOpen, defaultEmail, onClose }: AppWaitlistModalProps) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMessage(null);
      return;
    }

    setEmail(defaultEmail ?? '');
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [defaultEmail, isOpen, onClose]);

  const handleJoin = () => {
    const ok = addWaitlistEmail(email);
    if (!ok) {
      setMessage('Enter a valid email to join the app waitlist.');
      return;
    }
    setMessage('You are on the waitlist. We will notify you when the app is ready.');
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Join app waitlist"
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.992 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-primary/14 bg-[linear-gradient(180deg,#f8fbf7_0%,#f2f7f2_100%)] p-6 shadow-[0_30px_70px_rgba(15,36,18,0.28)] sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/86 text-foreground/58"
              aria-label="Close app waitlist"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/72">App coming soon</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Get early access to the CULTIV app</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/65">We are building a cleaner ordering and rewards app. Join the waitlist and we will notify you first.</p>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-primary/16 bg-white/92 px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@eatcultiv.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/45"
              />
              <button
                type="button"
                onClick={handleJoin}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Join waitlist
              </button>
            </div>

            {message ? <p className="mt-3 text-sm text-foreground/72">{message}</p> : null}

            <p className="mt-4 text-xs text-foreground/55">
              Need help now? Reach us at <a href={`mailto:${BRAND_CONTACT.supportEmail}`} className="font-medium text-primary hover:underline">{BRAND_CONTACT.supportEmail}</a>
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
