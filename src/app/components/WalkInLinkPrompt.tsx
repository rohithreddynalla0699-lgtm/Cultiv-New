// WalkInLinkPrompt — form to link an in-store walk-in order to the current member account.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface WalkInLinkPromptProps {
	defaultPhone?: string;
	compact?: boolean;
}

export function WalkInLinkPrompt({ defaultPhone = '', compact = false }: WalkInLinkPromptProps) {
	const { linkWalkInOrder } = useAuth();
	const [phone, setPhone] = useState(defaultPhone);
	const [reference, setReference] = useState('');
	const [message, setMessage] = useState('');
	const [needsSignup, setNeedsSignup] = useState(false);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = await linkWalkInOrder({ phone, reference: reference.trim() || undefined });
		setMessage(result.message);
		setNeedsSignup(result.userExists === false);
	};

	return (
		<div className={`rounded-[28px] border border-primary/10 bg-white/80 shadow-[0_16px_48px_rgba(45,80,22,0.07)] ${compact ? 'p-5' : 'p-6'}`}>
			<div className="flex items-start gap-3">
				<div className="rounded-full bg-primary/8 p-3 text-primary">
					<Link2 className="h-5 w-5" />
				</div>
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Walk-in linking</p>
					<h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Link an in-store order.</h3>
					<p className="mt-2 text-sm leading-6 text-foreground/64">Your account phone is used automatically; add a receipt reference to keep app and store history together.</p>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.9fr_auto]">
				<div className="relative flex-1">
					<Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
					<input
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
						placeholder="Phone number"
						className="w-full rounded-2xl border border-border bg-background/80 py-3 pl-11 pr-4 outline-none transition-colors focus:border-primary"
						readOnly
						required
					/>
				</div>
				<input
					value={reference}
					onChange={(event) => setReference(event.target.value)}
					placeholder="Receipt or order ref (optional)"
					className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary"
				/>
				<button type="submit" className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92">
					Link Order
				</button>
			</form>

			<div className="mt-4 rounded-2xl border border-border bg-background/78 px-4 py-4 text-sm leading-6 text-foreground/60">
				This keeps your account history more complete across both app and counter orders.
			</div>

			{message ? <p className="mt-4 text-sm leading-6 text-foreground/64">{message}</p> : null}
			{needsSignup ? (
				<div className="mt-4 rounded-2xl border border-primary/12 bg-primary/[0.04] p-4 text-sm leading-6 text-foreground/68">
					No profile exists for this phone yet. <Link to={`/signup?phone=${encodeURIComponent(phone)}`} className="font-medium text-primary">Create one in a few steps.</Link>
				</div>
			) : null}
		</div>
	);
}
