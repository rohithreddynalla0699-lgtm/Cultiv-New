// RewardsScreen — simple points-first rewards page with expiry visibility.

import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Coins, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { AvailableRewardsList } from './AvailableRewardsList';

export function RewardsScreen() {
	const { user, loyaltyProfile, offers, redeemReward } = useAuth();
	const availablePoints = loyaltyProfile?.availablePoints ?? 0;
	const [redeemMessage, setRedeemMessage] = useState('');
	const recentActivity = useMemo(
		() => [...loyaltyProfile?.pointsActivity ?? []].sort((a, b) => b.date - a.date).slice(0, 8),
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
				<div className="mb-7">
					<Link
						to="/profile"
						className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 hover:text-foreground transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Profile
					</Link>
				</div>
				<div className="mb-7 rounded-[30px] border border-primary/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.95),rgba(244,248,237,0.88))] p-6 shadow-[0_16px_38px_rgba(20,35,10,0.07)]">
					<h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">Rewards</h1>
					<p className="mt-1.5 text-sm text-foreground/52">Your points wallet. Calm, clear, and always up to date.</p>
					<div className="mt-5 rounded-2xl border border-primary/12 bg-white/80 p-5">
						<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">Points card</p>
						<div className="mt-3 flex items-center gap-2 text-primary/72">
							<Coins className="h-4 w-4" />
							<span className="text-xs uppercase tracking-[0.16em]">Available now</span>
						</div>
						<p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">{loyaltyProfile.availablePoints}</p>
						<p className="mt-1.5 text-sm text-foreground/55">1 point for every Rs.10 spent. Each points batch expires in 90 days.</p>
						<div className="mt-4">
							<div className="mb-2 flex items-center justify-between text-[11px] text-foreground/55">
								<span>{nextRewardCost ? `Next reward at ${nextRewardCost} points` : 'You can redeem any reward right now'}</span>
								<span>{progressToNextReward}%</span>
							</div>
							<div className="h-2 rounded-full bg-primary/10">
								<motion.div
									initial={{ width: 0 }}
									animate={{ width: `${progressToNextReward}%` }}
									transition={{ duration: 0.5, ease: 'easeOut' }}
									className="h-full rounded-full bg-primary/70"
								/>
							</div>
						</div>
						{loyaltyProfile.availableRewards.length > 0 ? (
							<p className="mt-3 text-xs text-primary/75">{loyaltyProfile.availableRewards.length} reward{loyaltyProfile.availableRewards.length > 1 ? 's are' : ' is'} ready to use at checkout.</p>
						) : null}
					</div>
				</div>
				{redeemMessage && (
					<div className="mb-5 rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm font-medium text-primary">
						{redeemMessage}
					</div>
				)}
				<div className="space-y-4 md:space-y-5">
					{loyaltyProfile.expiringSoonPoints > 0 ? (
						<div className="rounded-[28px] border border-amber-200/70 bg-[linear-gradient(165deg,rgba(255,255,255,0.96),rgba(255,246,224,0.6))] p-6 md:p-7">
							<div className="flex items-center gap-2 text-amber-700">
								<Clock3 className="h-4 w-4" />
								<p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Expiring soon</p>
							</div>
							<p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">{loyaltyProfile.expiringSoonPoints} points</p>
							<p className="mt-2 text-sm text-foreground/62">These points will expire in the next 14 days. Redeem now so none of your points go to waste.</p>
						</div>
					) : null}

					{/* Section 3: Redeem rewards */}
					<AvailableRewardsList
						profile={loyaltyProfile}
						offers={offers}
						onRedeem={handleRedeem}
					/>

					{/* Section 4: Points activity */}
					<div className="rounded-[28px] border border-primary/10 bg-white/88 p-6 md:p-7">
						<div className="flex items-center gap-2 text-primary/72">
							<History className="h-4 w-4" />
							<p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Points activity</p>
						</div>
						{recentActivity.length === 0 ? (
							<p className="mt-4 text-sm text-foreground/54">No points activity yet. Place an order to start earning.</p>
						) : (
							<div className="mt-4 space-y-2.5">
								{recentActivity.map((item, index) => (
									<div key={`${item.date}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl border border-primary/8 bg-primary/[0.03] px-4 py-3">
										<div className="min-w-0">
											<p className="text-sm font-medium text-foreground/88">{item.description}</p>
											<p className="mt-0.5 text-xs text-foreground/48">{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
										</div>
										<span className={`shrink-0 text-sm font-semibold tabular-nums ${item.type === 'earn' ? 'text-primary' : 'text-foreground/68'}`}>
											{item.type === 'earn' ? '+' : '-'}{item.points}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</PageReveal>
	);
}
