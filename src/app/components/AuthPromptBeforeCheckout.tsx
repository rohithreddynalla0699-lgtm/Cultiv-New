// AuthPromptBeforeCheckout — compact secondary sign-in nudge shown below the Place Order button during guest checkout.

import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

interface AuthPromptBeforeCheckoutProps {
	onDismiss: () => void;
	fromPath?: string;
}

export function AuthPromptBeforeCheckout({ onDismiss, fromPath = '/order' }: AuthPromptBeforeCheckoutProps) {
	return (
		<div className="mt-2.5 rounded-xl border border-primary/10 bg-primary/[0.03] px-3 py-2.5">
			<p className="text-xs text-foreground/62">Sign in to save this order and rewards.</p>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Link
					to="/login"
					state={{ from: fromPath }}
					className="inline-flex items-center gap-1.5 rounded-full border border-primary/18 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/6"
				>
					<LockKeyhole className="h-3.5 w-3.5" />
					Sign In
				</Link>
				<button
					type="button"
					onClick={onDismiss}
					className="text-xs font-medium text-foreground/48 transition-colors hover:text-foreground/68"
				>
					Continue as guest
				</button>
			</div>
		</div>
	);
}
