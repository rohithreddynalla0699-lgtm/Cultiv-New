// ResetPasswordScreen — new password form that validates and applies a token from the forgot-password flow.

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { useAuth } from '../contexts/AuthContext';
import type { ResetPasswordLocationState } from '../types/navigation';

const RESET_TOKEN_STORAGE_KEY = 'cultiv_reset_token_v1';

const getPasswordPolicyError = (password: string) => {
	if (password.length < 8) return 'Password must be at least 8 characters.';
	if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
	if (!/\d/.test(password)) return 'Password must include at least one number.';
	return '';
};

export function ResetPasswordScreen() {
	const { resetPassword } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const stateToken = (location.state as ResetPasswordLocationState | null)?.resetToken ?? '';
	const token = useMemo(() => {
		if (stateToken) return stateToken;
		return sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY) ?? '';
	}, [stateToken]);
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (!token) return;
		sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, token);
	}, [token]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const passwordPolicyError = getPasswordPolicyError(password);
		if (passwordPolicyError) {
			setMessage(passwordPolicyError);
			return;
		}
		if (password !== confirmPassword) {
			setMessage('Passwords do not match.');
			return;
		}

		const result = await resetPassword(token, password);
		setMessage(result.message);
		if (result.success) {
			sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY);
			setTimeout(() => navigate('/login'), 1000);
		}
	};

	return (
		<AuthShell title="Reset Password" subtitle="Choose a new password and return to your CULTIV account." footer={<p className="text-center text-sm text-foreground/60">Need a new link? <Link to="/forgot-password" className="font-medium text-primary">Start again</Link></p>}>
			{!token ? (
				<div className="rounded-2xl border border-primary/14 bg-primary/[0.04] p-5 text-sm leading-6 text-foreground/66">
					This reset screen needs a valid token. <Link to="/forgot-password" className="font-medium text-primary">Generate one here.</Link>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-5">
					<div className="relative">
						<label className="mb-2 block text-sm font-medium text-foreground/78">New password</label>
						<input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 pr-12 outline-none transition-colors focus:border-primary" required />
						<button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-[3.15rem] text-foreground/45">
							{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
						</button>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-foreground/78">Confirm password</label>
						<input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" required />
					</div>
					<button type="submit" className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92">Update Password</button>
					{message ? <p className="text-sm leading-6 text-foreground/64">{message}</p> : null}
				</form>
			)}
		</AuthShell>
	);
}
