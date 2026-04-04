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
		<div className="rounded-[28px] border border-primary/10 bg-white/88 p-6 md:p-7">
			<div className="flex items-start gap-3">
				<div className="rounded-full bg-primary/8 p-2 text-primary">
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
				<div className="mt-5 rounded-2xl border border-primary/12 bg-primary/[0.04] p-5">
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
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: index * 0.08 }}
								className={`rounded-[20px] border p-5 transition-all ${
									canRedeem
										? 'border-primary/18 bg-gradient-to-br from-primary/[0.08] to-primary/[0.04] hover:border-primary/25'
										: 'border-border/70 bg-background/65'
								}`}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-start gap-2">
											<Zap className={`h-4 w-4 shrink-0 mt-0.5 ${canRedeem ? 'text-primary' : 'text-foreground/40'}`} />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-semibold text-foreground">{offer.title}</p>
												<p className="mt-0.5 text-xs text-foreground/55 leading-5">{offer.description}</p>
												<p className="mt-2.5 text-xs font-medium text-primary/80 flex items-center gap-1">
													{offer.value}
												</p>
											</div>
										</div>
									</div>
									<div className="shrink-0 text-right">
										<div className="rounded-full bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-foreground/72 mb-2.5 tabular-nums">
											{offer.pointCost} pts
										</div>
										{isAddedToAccount ? (
											<motion.span
												initial={{ scale: 0.95, opacity: 0 }}
												animate={{ scale: 1, opacity: 1 }}
												className="inline-block rounded-full border border-primary/30 bg-primary/[0.1] px-3.5 py-1.5 text-[11px] font-semibold text-primary"
											>
												✓ In account
											</motion.span>
										) : canRedeem ? (
											<motion.button
												onClick={() => handleRedeem(offer.id)}
												disabled={isLoading}
												whileHover={{ scale: 1.02 }}
												whileTap={{ scale: 0.98 }}
												className="w-full rounded-full border border-primary/40 bg-primary/12 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/18 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												{isLoading ? 'Unlocking…' : 'Unlock'}
											</motion.button>
										) : (
											<span className="text-[11px] text-foreground/45 font-medium tabular-nums">
												<span className="block text-primary/70">{ptsAway} away</span>
											</span>
										)}
									</div>
								</div>
							</motion.div>
						);
					})}
					<div className="mt-5 rounded-2xl border border-primary/12 bg-primary/[0.035] p-4">
						<p className="text-xs text-foreground/65 leading-5">
							💡 <span className="font-medium">Tip:</span> Rewards are unlocked instantly when you have enough points. Use them at checkout to save on your next order!
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
