// LoginScreen — sign-in form accepting phone or email with password and a forgot-password link.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
		<AuthShell
			title="Welcome Back"
			subtitle="Sign in with your phone or email to track orders, keep history, and unlock member benefits."
			footer={<p className="text-center text-sm text-foreground/60">Don't have an account? <Link to="/signup" className="font-medium text-primary">Create one</Link></p>}
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
					<label className="mb-2 block text-sm font-medium text-foreground/78">Phone number or email</label>
					<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 outline-none transition-colors focus:border-primary" placeholder="9876543210 or member@cultiv.app" required />
				</motion.div>
				<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}>
					<label className="mb-2 block text-sm font-medium text-foreground/78">Password</label>
					<div className="relative">
						<input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-border bg-background/80 px-4 py-4 pr-12 outline-none transition-colors focus:border-primary" placeholder="Enter your password" required />
						<button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45 transition-colors hover:text-foreground">
							{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
						</button>
					</div>
				</motion.div>
				<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }} className="flex justify-end">
					<Link to="/forgot-password" className="text-sm font-medium text-primary">Forgot password?</Link>
				</motion.div>
				<motion.div
					{...(error ? ErrorShake : {})}
					className={`min-h-[3.25rem] rounded-2xl px-4 py-3 text-sm transition-all ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-transparent bg-transparent text-transparent'}`}
				>
					{error || 'Placeholder for stable layout.'}
				</motion.div>
				<motion.button 
					type="submit" 
					disabled={isLoading} 
					whileHover={{ scale: isLoading ? 1 : 1.02 }}
					whileTap={{ scale: 0.98 }}
					className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92 disabled:opacity-60"
				>
					<motion.span animate={isLoading ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }} transition={{ duration: 1.5, repeat: isLoading ? Infinity : 0 }}>
						{isLoading ? 'Signing In...' : 'Sign In'}
					</motion.span>
				</motion.button>
			</motion.form>
		</AuthShell>
	);
}
