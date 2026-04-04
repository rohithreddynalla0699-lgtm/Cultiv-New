// RewardsScreen — intuitive points-first rewards page with clear earning and redemption flow.

import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Coins, History, Zap, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { AvailableRewardsList } from './AvailableRewardsList';

export function RewardsScreen() {
	const { user, loyaltyProfile, offers, redeemReward } = useAuth();
	const availablePoints = loyaltyProfile?.availablePoints ?? 0;
	const [redeemMessage, setRedeemMessage] = useState('');
	const recentActivity = useMemo(
		() => [...loyaltyProfile?.pointsActivity ?? []].sort((a, b) => b.date - a.date).slice(0, 10),
		[loyaltyProfile?.pointsActivity],
	);
	const nextRewardCost = useMemo(() => {
		if (!loyaltyProfile) return null;
		const sortedCosts = offers
			.filter((offer) => offer.active && offer.pointCost && !offer.autoApply)
			.map((offer) => offer.pointCost as number)
			.sort((a, b) => a - b);

		return sortedCosts.find((cost) => cost > availablePoints) ?? null;
	}, [availablePoints, loyaltyProfile, offers]);
	const progressToNextReward = nextRewardCost
		? Math.min(100, Math.round((availablePoints / nextRewardCost) * 100))
		: 100;

	if (!user) {
		return <Navigate to="/login" replace state={{ from: '/rewards' }} />;
	}

	if (!loyaltyProfile) {
		return null;
	}

	async function handleRedeem(id: string) {
		const result = await redeemReward(id);
		setRedeemMessage(result.message);
		setTimeout(() => setRedeemMessage(''), 4000);
	}

	return (
		<PageReveal className="min-h-screen bg-[radial-gradient(circle_at_10%_12%,rgba(115,141,89,0.14),transparent_32%),radial-gradient(circle_at_90%_4%,rgba(214,224,198,0.6),transparent_28%),linear-gradient(165deg,#f7f7f2_0%,#f2f5ee_46%,#f8f8f4_100%)] px-4 pb-20">
			<div className="max-w-3xl mx-auto pt-24 md:pt-28">
				<motion.div className="mb-7" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
					<Link
						to="/profile"
						className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 hover:text-foreground transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Profile
					</Link>
				</motion.div>

				{/* Header Section */}
				<motion.div 
					className="mb-7 rounded-[30px] border border-primary/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.95),rgba(244,248,237,0.88))] p-6 shadow-[0_16px_38px_rgba(20,35,10,0.07)]"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.05 }}
				>
					<div className="flex items-start gap-3">
						<div className="rounded-full bg-primary/8 p-3 text-primary">
							<Coins className="h-5 w-5" />
						</div>
						<div className="flex-1">
							<h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">Rewards</h1>
							<p className="mt-1.5 text-sm text-foreground/52">Your personal rewards wallet. Earn points, unlock benefits.</p>
						</div>
					</div>

					{/* Points Card */}
					<motion.div 
						className="mt-5 rounded-2xl border border-primary/12 bg-white/80 p-5"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.4, delay: 0.1 }}
					>
						<div className="flex items-start justify-between gap-4">
							<div className="flex-1">
								<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">Available points</p>
								<p className="mt-3 text-5xl font-bold tracking-[-0.04em] text-foreground">{loyaltyProfile.availablePoints}</p>
								<p className="mt-2 text-xs text-foreground/55">Earn 1 point for every ₹10 spent. Valid for 90 days.</p>
							</div>
							<Zap className="h-8 w-8 text-primary/60 shrink-0" />
						</div>

						{/* Progress Bar */}
						<div className="mt-5 space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="text-foreground/60 font-medium">
									{nextRewardCost ? `Next reward at ${nextRewardCost} points` : '✨ Ready to redeem!'}
								</span>
								<span className="text-foreground/50">{progressToNextReward}%</span>
							</div>
							<div className="h-2.5 rounded-full bg-foreground/8 overflow-hidden">
								<motion.div
									initial={{ width: 0 }}
									animate={{ width: `${progressToNextReward}%` }}
									transition={{ duration: 0.6, ease: 'easeOut' }}
									className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
								/>
							</div>
						</div>

						{/* Ready to Use Status */}
						{loyaltyProfile.availableRewards.length > 0 && (
							<motion.div 
								className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.08] px-3 py-2.5"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.15 }}
							>
								<p className="text-xs font-semibold text-primary flex items-center gap-1.5">
									<span className="text-sm">🎁</span>
									{loyaltyProfile.availableRewards.length} reward{loyaltyProfile.availableRewards.length > 1 ? 's are' : ' is'} ready to use at checkout!
								</p>
							</motion.div>
						)}
					</motion.div>
				</motion.div>

				{/* Feedback Message */}
				{redeemMessage && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						className="mb-5 rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm font-medium text-primary"
					>
						{redeemMessage}
					</motion.div>
				)}

				{/* Main Content */}
				<div className="space-y-5 md:space-y-6">
					{/* Expiring Soon Alert */}
					{loyaltyProfile.expiringSoonPoints > 0 && (
						<motion.div 
							className="rounded-[28px] border border-amber-200/70 bg-[linear-gradient(165deg,rgba(255,255,255,0.96),rgba(255,246,224,0.8))] p-6 md:p-7"
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.1 }}
						>
							<div className="flex items-start gap-3">
								<div className="rounded-full bg-amber-500/10 p-2 text-amber-600">
									<Clock3 className="h-5 w-5" />
								</div>
								<div className="flex-1">
									<p className="font-semibold text-amber-900">⏰ Points Expiring Soon</p>
									<p className="mt-1 text-3xl font-bold text-amber-950">{loyaltyProfile.expiringSoonPoints} points</p>
									<p className="mt-2 text-sm text-amber-800/85 leading-6">
										These points will expire in the next 14 days. Redeem a reward to use them before they're gone!
									</p>
								</div>
							</div>
						</motion.div>
					)}

					{/* Section 3: Redeem rewards */}
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.15 }}
					>
						<AvailableRewardsList
							profile={loyaltyProfile}
							offers={offers}
							onRedeem={handleRedeem}
						/>
					</motion.div>

					{/* Section 4: Points activity */}
					<motion.div 
						className="rounded-[28px] border border-primary/10 bg-white/88 p-6 md:p-7"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.2 }}
					>
						<div className="flex items-start gap-3 mb-5">
							<div className="rounded-full bg-primary/8 p-2 text-primary">
								<History className="h-5 w-5" />
							</div>
							<div>
								<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">Points activity</p>
								<h3 className="mt-1 text-lg font-semibold text-foreground">Recent history</h3>
							</div>
						</div>

						{recentActivity.length === 0 ? (
							<div className="rounded-2xl border border-primary/12 bg-primary/[0.04] p-5">
								<p className="text-sm text-foreground/62 leading-6">
									No points activity yet. <Link to="/" className="font-medium text-primary hover:underline">Place your first order</Link> to start earning!
								</p>
							</div>
						) : (
							<div className="space-y-2.5">
								{recentActivity.map((item, index) => (
									<motion.div
										key={`${item.date}-${index}`}
										initial={{ opacity: 0, x: -8 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: index * 0.05 }}
										className="flex items-center justify-between gap-4 rounded-2xl border border-primary/8 bg-primary/[0.03] px-4 py-3"
									>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground/88">{item.description}</p>
											<p className="mt-0.5 text-xs text-foreground/48">
												{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
											</p>
										</div>
										<motion.span
											className={`shrink-0 text-sm font-bold tabular-nums flex items-center gap-1 ${item.type === 'earn' ? 'text-primary' : 'text-foreground/68'}`}
											initial={{ scale: 0.8 }}
											animate={{ scale: 1 }}
											transition={{ duration: 0.2, delay: index * 0.05 }}
										>
											{item.type === 'earn' ? '+' : '-'}{item.points}
										</motion.span>
									</motion.div>
								))}
							</div>
						)}
					</motion.div>
				</div>
			</div>
		</PageReveal>
	);
}
