// AuthShell — two-column auth page layout shared by Login, Signup, and password recovery screens.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';
import { PageReveal } from '../core/motion/cultivMotion';

interface AuthShellProps {
	title: string;
	subtitle: string;
	children: ReactNode;
	footer?: ReactNode;
	tagline?: string;
}

const ambientShapes = [
	'top-20 left-[8%] h-28 w-28',
	'top-1/3 right-[12%] h-20 w-20',
	'bottom-20 left-[15%] h-24 w-24',
];

export function AuthShell({ title, subtitle, children, footer, tagline = 'A premium healthy routine, kept in one place.' }: AuthShellProps) {
	return (
		<PageReveal className="relative min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,80,22,0.12),_transparent_34%),linear-gradient(180deg,_#fafaf8_0%,_#f4f3ee_100%)] text-foreground">
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
				style={{
					backgroundImage:
						'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
					backgroundSize: '220px 220px',
				}}
			/>
			{ambientShapes.map((shape, index) => (
				<motion.div
					key={shape}
					className={`pointer-events-none absolute rounded-full border border-primary/10 bg-primary/[0.04] blur-2xl ${shape}`}
					animate={{ y: [0, -10, 0], x: [0, index % 2 === 0 ? 8 : -8, 0] }}
					transition={{ duration: 8 + index, repeat: Infinity, ease: 'easeInOut' }}
				/>
			))}

			<div className="relative z-10 grid min-h-[100svh] lg:grid-cols-[1.1fr_0.9fr]">
				<div className="hidden px-10 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
					<div>
						<Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/60 transition-colors hover:text-foreground">
							<ArrowLeft className="h-4 w-4" />
							Back to Menu
						</Link>
					</div>

					<div className="max-w-xl space-y-8">
						<Logo variant="subBrand" subBrandName="Member System" size="lg" />
						<div className="space-y-4">
							<p className="text-sm uppercase tracking-[0.28em] text-primary/60">Premium access</p>
							<h1 className="max-w-lg text-5xl font-semibold tracking-[-0.04em] text-[#1f241d]">
								Built for repeat, made to feel calm.
							</h1>
							<p className="max-w-md text-base leading-7 text-foreground/68">{tagline}</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-[28px] border border-primary/12 bg-white/70 p-5 shadow-[0_18px_50px_rgba(45,80,22,0.07)] backdrop-blur-sm">
								<p className="text-xs uppercase tracking-[0.24em] text-primary/60">Track your routine</p>
								<p className="mt-3 text-sm leading-6 text-foreground/70">Save orders, view progress, and keep your CULTIV history in one place.</p>
							</div>
							<div className="rounded-[28px] border border-primary/12 bg-white/70 p-5 shadow-[0_18px_50px_rgba(45,80,22,0.07)] backdrop-blur-sm">
								<p className="text-xs uppercase tracking-[0.24em] text-primary/60">Unlock member benefits</p>
								<p className="mt-3 text-sm leading-6 text-foreground/70">Quiet rewards, repeat-order benefits, and better continuity over time.</p>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-foreground/45">
						<span className="h-px w-12 bg-primary/20" />
						Healthy ordering, held with memory
					</div>
				</div>

				<div className="flex items-center justify-center px-4 py-2 sm:px-6 lg:px-8">
					<div className="w-full max-w-[27rem] rounded-[30px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.8))] p-4 shadow-[0_24px_90px_rgba(32,45,20,0.13)] backdrop-blur-md sm:p-5">
						<div className="mb-4 text-center">
							<div className="mb-4 flex justify-center">
								<Logo variant="emblem" animated />
							</div>
							<h2 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#20251e]">{title}</h2>
							<p className="mt-1.5 text-sm leading-5 text-foreground/65">{subtitle}</p>
						</div>

						{children}

						{footer ? <div className="mt-5 border-t border-border/60 pt-3">{footer}</div> : null}
					</div>
				</div>
			</div>
		</PageReveal>
	);
}
