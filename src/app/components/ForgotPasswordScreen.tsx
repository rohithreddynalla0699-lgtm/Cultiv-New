// ForgotPasswordScreen — password recovery form that generates a reset token for this frontend flow.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { useAuth } from '../contexts/AuthContext';
import type { ResetPasswordLocationState } from '../types/navigation';

const RESET_TOKEN_STORAGE_KEY = 'cultiv_reset_token_v1';

export function ForgotPasswordScreen() {
	const { requestPasswordReset } = useAuth();
	const navigate = useNavigate();
	const [identifier, setIdentifier] = useState('');
	const [message, setMessage] = useState('');
	const [resetToken, setResetToken] = useState('');

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = await requestPasswordReset(identifier);
		setMessage(result.message);
		setResetToken(result.resetToken ?? '');
		if (result.resetToken) {
			sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, result.resetToken);
			const nextState: ResetPasswordLocationState = { resetToken: result.resetToken };
			navigate('/reset-password', { state: nextState });
		}
	};

	return (
		<AuthShell title="Recover Access" subtitle="Use your phone or email to generate a secure reset step for this frontend flow." footer={<p className="text-center text-sm text-foreground/60">Remembered your password? <Link to="/login" className="font-medium text-primary">Back to sign in</Link></p>}>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<label className="mb-2 block text-sm font-medium text-foreground/78">Phone number or email</label>
					<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" placeholder="9876543210 or member@cultiv.app" required />
				</div>

				<button type="submit" className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92">Continue</button>

				{message ? <p className="text-sm leading-6 text-foreground/64">{message}</p> : null}
				{resetToken ? (
					<button
						type="button"
						onClick={() => {
							const nextState: ResetPasswordLocationState = { resetToken };
							navigate('/reset-password', { state: nextState });
						}}
						className="inline-flex items-center gap-2 text-sm font-medium text-primary"
					>
						Open Reset Screen
						<ArrowRight className="h-4 w-4" />
					</button>
				) : null}
			</form>
		</AuthShell>
	);
}
