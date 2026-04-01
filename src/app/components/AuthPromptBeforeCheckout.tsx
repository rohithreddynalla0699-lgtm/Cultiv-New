// AuthPromptBeforeCheckout — compact secondary sign-in nudge shown below the Place Order button during guest checkout.

import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

interface AuthPromptBeforeCheckoutProps {
	onDismiss: () => void;
	fromPath?: string;
}

export function AuthPromptBeforeCheckout({ onDismiss, fromPath = '/order' }: AuthPromptBeforeCheckoutProps) {
	return (
		<div className="mt-3 rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-3">
			<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/55">Optional</p>
			<p className="mt-1 text-sm font-medium text-foreground/80">Want to save this order?</p>
			<p className="mt-0.5 text-xs leading-5 text-foreground/56">Sign in to keep your order history, rewards, and reorder access in one place.</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<Link
					to="/login"
					state={{ from: fromPath }}
					className="inline-flex items-center gap-1.5 rounded-full border border-primary/18 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/6"
				>
					<LockKeyhole className="h-3.5 w-3.5" />
					Sign In
				</Link>
				<Link
					to="/signup"
					state={{ from: fromPath }}
					className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-92"
				>
					Create Account
				</Link>
				<button
					type="button"
					onClick={onDismiss}
					className="text-xs font-medium text-foreground/48 transition-colors hover:text-foreground/68"
				>
					No thanks
				</button>
			</div>
		</div>
	);
}
