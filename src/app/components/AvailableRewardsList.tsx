// AvailableRewardsList — shows point-redeemable rewards with enhanced visual design.

import { useState } from 'react';
import { Gift, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LoyaltyProfile, Offer } from '../types/platform';

interface AvailableRewardsListProps {
	profile: LoyaltyProfile;
	offers: Offer[];
	onRedeem: (id: string) => Promise<void>;
}

const rewardCardMotion = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
};

export function AvailableRewardsList({ profile, offers, onRedeem }: AvailableRewardsListProps) {
	const [redeeming, setRedeeming] = useState<string | null>(null);

	const pointOffers = offers
		.filter((o) => o.active && o.pointCost && !o.autoApply)
		.sort((a, b) => (a.pointCost ?? 0) - (b.pointCost ?? 0));

	const hasAny = pointOffers.length > 0;

	async function handleRedeem(id: string) {
		setRedeeming(id);
		try {
			await onRedeem(id);
		} finally {
			setRedeeming(null);
		}
	}

	return (
		<div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(251,252,248,0.96),rgba(246,248,241,0.94))] p-6 md:p-7">
			<div className="flex items-start gap-3">
				<div className="rounded-full border border-primary/10 bg-primary/[0.06] p-2 text-primary">
					<Gift className="h-4 w-4" />
				</div>
				<div className="flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">
						Redeem rewards
					</p>
					<h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground leading-snug">
						Use points before they expire.
					</h3>
				</div>
			</div>

			{!hasAny ? (
				<div className="mt-5 rounded-[22px] border border-primary/12 bg-[linear-gradient(180deg,rgba(241,245,235,0.9),rgba(237,242,230,0.82))] p-5">
					<p className="text-sm leading-7 text-foreground/62">
						You've unlocked all available rewards. Keep ordering to earn more! Every ₹10 spent = 1 point.
					</p>
				</div>
			) : (
				<div className="mt-5 space-y-3">
					{pointOffers.map((offer, index) => {
						const canRedeem = profile.availablePoints >= (offer.pointCost ?? 0);
						const ptsAway = (offer.pointCost ?? 0) - profile.availablePoints;
						const isLoading = redeeming === offer.id;
						const isAddedToAccount = profile.availableRewards.includes(offer.id);

						return (
							<motion.div
								key={offer.id}
								{...rewardCardMotion}
								transition={{ duration: 0.28, delay: index * 0.06 }}
								whileHover={{
									y: -3,
									scale: 1.004,
								}}
								whileTap={{ scale: 0.996 }}
								className={`group rounded-[22px] border p-5 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] transition-all duration-200 ${
									canRedeem
										? 'border-primary/18 bg-[linear-gradient(180deg,rgba(238,243,232,0.92),rgba(233,239,226,0.82))] hover:border-primary/26 hover:shadow-[0_14px_28px_rgba(45,80,22,0.08)]'
										: 'border-[#d9dfcf] bg-[linear-gradient(180deg,rgba(243,246,238,0.78),rgba(239,243,234,0.68))] hover:border-[#cfd7c1] hover:shadow-[0_12px_24px_rgba(45,80,22,0.05)]'
								}`}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="flex items-start gap-3">
											<div
												className={`mt-0.5 rounded-full border p-2 transition-all duration-200 ${
													canRedeem
														? 'border-primary/14 bg-primary/[0.08] group-hover:bg-primary/[0.12]'
														: 'border-border/60 bg-white/45 group-hover:bg-white/65'
												}`}
											>
												<Zap
													className={`h-3.5 w-3.5 shrink-0 transition-all duration-200 ${
														canRedeem
															? 'text-primary/80 group-hover:text-primary'
															: 'text-foreground/40 group-hover:text-foreground/55'
													}`}
												/>
											</div>

											<div className="min-w-0 flex-1">
												<p className="text-[1.02rem] font-semibold tracking-[-0.015em] text-foreground">
													{offer.title}
												</p>
												<p className="mt-1 text-[13px] leading-6 text-foreground/58">
													{offer.description}
												</p>

												<div className="mt-3 inline-flex rounded-full border border-primary/10 bg-primary/[0.045] px-3 py-1.5">
													<p className="text-[12px] font-medium text-primary/80">
														{offer.value}
													</p>
												</div>
											</div>
										</div>
									</div>

									<div className="shrink-0 text-right">
										<div className="mb-3 inline-flex rounded-full border border-primary/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-foreground/72 tabular-nums backdrop-blur-[1px]">
											{offer.pointCost} pts
										</div>

										{isAddedToAccount ? (
											<motion.span
												initial={{ scale: 0.95, opacity: 0 }}
												animate={{ scale: 1, opacity: 1 }}
												className="inline-flex items-center rounded-full border border-primary/28 bg-primary/[0.10] px-3.5 py-1.5 text-[11px] font-semibold text-primary"
											>
												✓ In account
											</motion.span>
										) : canRedeem ? (
											<motion.button
												onClick={() => handleRedeem(offer.id)}
												disabled={isLoading}
												whileHover={{ scale: 1.02 }}
												whileTap={{ scale: 0.97 }}
												className="rounded-full border border-primary/35 bg-primary/[0.12] px-4 py-2 text-[12px] font-semibold text-primary transition-all duration-200 hover:border-primary/50 hover:bg-primary/[0.17] disabled:cursor-not-allowed disabled:opacity-50"
											>
												{isLoading ? 'Unlocking…' : 'Unlock'}
											</motion.button>
										) : (
											<div className="text-right">
												<p className="text-[12px] font-medium text-primary/72 tabular-nums">
													{ptsAway} away
												</p>
											</div>
										)}
									</div>
								</div>
							</motion.div>
						);
					})}

					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.24, delay: pointOffers.length * 0.05 + 0.04 }}
						className="mt-5 rounded-[22px] border border-primary/12 bg-[linear-gradient(180deg,rgba(241,245,235,0.86),rgba(237,242,230,0.76))] p-4"
					>
						<p className="text-xs leading-5 text-foreground/65">
							💡 <span className="font-medium">Tip:</span> Rewards are unlocked instantly when you have enough points. Use them at checkout to save on your next order!
						</p>
					</motion.div>
				</div>
			)}
		</div>
	);
}