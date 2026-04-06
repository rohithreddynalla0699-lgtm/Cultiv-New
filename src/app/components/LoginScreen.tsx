// LoginScreen — sign-in form accepting phone or email with password and a forgot-password link.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfUse } from './TermsOfUse';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from './AuthShell';
import { ErrorShake } from '../core/motion/cultivMotion';

export function LoginScreen() {
	const [identifier, setIdentifier] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const { login } = useAuth();
	const navigate = useNavigate();

	const [modal, setModal] = useState<null | 'privacy' | 'terms'>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError('');
		try {
			const result = await login({ identifier, password });
			if (result.success) navigate('/', { replace: true });
			else setError(result.message);
		} catch {
			setError('Login failed. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<AuthShell
				title="Welcome Back"
				subtitle="Sign in with your phone or email to track orders, keep history, and unlock member benefits."
				footer={
					<div>
						<p className="text-center text-[15px] text-foreground/65">
							Don't have an account?{' '}
							<Link to="/signup" className="font-medium text-primary/80 underline underline-offset-4 decoration-1 hover:text-primary transition-colors">Create one</Link>
						</p>
						<div className="mt-2 flex justify-center gap-4 text-xs text-foreground/45">
							<button
								type="button"
								className="font-normal underline underline-offset-4 decoration-1 text-[13px] text-primary/70 hover:text-primary focus:outline-none transition-colors"
								onClick={() => setModal('privacy')}
							>
								Privacy Policy
							</button>
							<span>·</span>
							<button
								type="button"
								className="font-normal underline underline-offset-4 decoration-1 text-[13px] text-primary/70 hover:text-primary focus:outline-none transition-colors"
								onClick={() => setModal('terms')}
							>
								Terms of Use
							</button>
						</div>
					</div>
				}
			>
				<motion.form 
					onSubmit={handleSubmit} 
					className="space-y-4"
					initial="hidden"
					animate="visible"
					variants={{
						hidden: { opacity: 0 },
						visible: {
							opacity: 1,
							transition: {
								staggerChildren: 0.08,
								delayChildren: 0.1
							}
						}
					}}
				>
					<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}>
						<label className="mb-2 block text-[15px] font-medium text-foreground/80">Phone number or email</label>
						<input 
							value={identifier} 
							onChange={(e) => setIdentifier(e.target.value)} 
							className="w-full rounded-2xl border border-primary/18 bg-[#f8faf7] px-4 py-4 text-[15px] text-foreground/90 placeholder:text-foreground/40 outline-none transition-colors focus:border-primary/70 focus:bg-white focus:shadow-[0_0_0_2px_rgba(126,183,154,0.13)]" 
							placeholder="9876543210 or member@cultiv.app" 
							required 
						/>
					</motion.div>
					<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}>
						<label className="mb-2 block text-[15px] font-medium text-foreground/80">Password</label>
						<div className="relative">
							<input 
								type={showPassword ? 'text' : 'password'} 
								value={password} 
								onChange={(e) => setPassword(e.target.value)} 
								className="w-full rounded-2xl border border-primary/18 bg-[#f8faf7] px-4 py-4 pr-12 text-[15px] text-foreground/90 placeholder:text-foreground/40 outline-none transition-colors focus:border-primary/70 focus:bg-white focus:shadow-[0_0_0_2px_rgba(126,183,154,0.13)]" 
								placeholder="Enter your password" 
								required 
							/>
							<button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45 transition-colors hover:text-primary/70">
								{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
							</button>
						</div>
					</motion.div>
					<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }} className="flex justify-end">
						<Link to="/forgot-password" className="text-[15px] font-medium text-primary/80 underline underline-offset-4 decoration-1 hover:text-primary transition-colors">Forgot password?</Link>
					</motion.div>
					<motion.div
						{...(error ? ErrorShake : {})}
						className={`min-h-[3.25rem] rounded-2xl px-4 py-3 text-[15px] transition-all ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-transparent bg-transparent text-transparent'}`}
					>
						{error || 'Placeholder for stable layout.'}
					</motion.div>
					<motion.button
						type="submit"
						disabled={isLoading}
						className="mt-2 w-full rounded-2xl bg-gradient-to-b from-primary/90 to-primary/80 px-4 py-3 text-[16px] font-semibold text-white shadow-[0_2px_12px_rgba(126,183,154,0.10)] transition-all duration-150 hover:from-primary/100 hover:to-primary/90 hover:shadow-[0_4px_18px_rgba(126,183,154,0.13)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-60"
						whileTap={{ scale: 0.98 }}
					>
						{isLoading ? 'Signing in…' : 'Sign In'}
					</motion.button>
				</motion.form>
			</AuthShell>
			<Modal open={modal === 'privacy'} onClose={() => setModal(null)} ariaLabel="Privacy Policy">
				{modal === 'privacy' && <PrivacyPolicy variant="modal" />}
			</Modal>
			<Modal open={modal === 'terms'} onClose={() => setModal(null)} ariaLabel="Terms of Use">
				{modal === 'terms' && <TermsOfUse variant="modal" />}
			</Modal>
		</>
	);
}
