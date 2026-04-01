// SignupScreen — account creation form collecting full name, phone, email, and password.

import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from './AuthShell';
import type { AuthRedirectState } from '../types/navigation';

const getPasswordPolicyError = (password: string) => {
	if (password.length < 8) return 'Password must be at least 8 characters.';
	if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
	if (!/\d/.test(password)) return 'Password must include at least one number.';
	return '';
};

export function SignupScreen() {
	const [searchParams] = useSearchParams();
	const [formData, setFormData] = useState({ fullName: '', phone: searchParams.get('phone') ?? '', email: '', password: '', confirmPassword: '' });
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [agreed, setAgreed] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const { signup } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const nextPath = (location.state as AuthRedirectState | undefined)?.from ?? '/profile';

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!/^\d{10}$/.test(formData.phone.trim())) {
			setError('Phone number must be exactly 10 digits.');
			return;
		}
		if (!formData.email.trim()) {
			setError('Email is required for order confirmations.');
			return;
		}
		const passwordPolicyError = getPasswordPolicyError(formData.password);
		if (passwordPolicyError) {
			setError(passwordPolicyError);
			return;
		}
		if (formData.password !== formData.confirmPassword) {
			setError('Passwords do not match');
			return;
		}
		if (!agreed) {
			setError('Please agree to continue');
			return;
		}
		setIsLoading(true);
		setError('');
		try {
			const result = await signup({ ...formData, email: formData.email.trim().toLowerCase() });
			if (result.success) navigate(nextPath, { replace: true });
			else setError(result.message);
		} catch {
			setError('Signup failed. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthShell
			title="Join CULTIV"
			subtitle="Create a calm, premium member profile for saved orders, rewards, and repeat benefits."
			footer={<p className="text-center text-sm text-foreground/60">Already have an account? <Link to="/login" className="font-medium text-primary">Sign in</Link></p>}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<input className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" placeholder="Full name" value={formData.fullName} onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))} required />
				<input className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" placeholder="Phone number" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required />
				<input className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" placeholder="Email address" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} required />

				<div className="relative">
					<input className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 pr-12 outline-none transition-colors focus:border-primary" placeholder="Password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} required />
					<button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45">
						{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
					</button>
				</div>

				<div className="relative">
					<input className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 pr-12 outline-none transition-colors focus:border-primary" placeholder="Confirm Password" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} required />
					<button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45">
						{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
					</button>
				</div>

				<button type="button" onClick={() => setAgreed(!agreed)} className="flex items-center gap-2 text-sm text-foreground/70">
					<span className={`flex h-4 w-4 items-center justify-center rounded border ${agreed ? 'border-primary bg-primary' : 'border-border'}`}>{agreed ? <Check className="h-3 w-3 text-primary-foreground" /> : null}</span>
					I agree to continue with a CULTIV member profile.
				</button>

				{error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

				<button type="submit" disabled={isLoading || !agreed} className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92 disabled:opacity-60">{isLoading ? 'Creating Account...' : 'Create Account'}</button>
			</form>
		</AuthShell>
	);
}
