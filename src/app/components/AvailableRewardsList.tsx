// AvailableRewardsList — shows point-redeemable rewards.

import { useState } from 'react';
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
			<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">
				Redeem rewards
			</p>
			<h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground leading-snug">
				Use points before they expire.
			</h3>

			{!hasAny ? (
				<p className="mt-4 text-sm leading-7 text-foreground/52">
					You've unlocked all available rewards. Keep ordering to earn more.
				</p>
			) : (
				<div className="mt-5 space-y-3">
					{pointOffers.map((offer) => {
						const canRedeem = profile.availablePoints >= (offer.pointCost ?? 0);
						const ptsAway = (offer.pointCost ?? 0) - profile.availablePoints;
						const isLoading = redeeming === offer.id;
						const isAddedToAccount = profile.availableRewards.includes(offer.id);

						return (
							<div
								key={offer.id}
								className="flex items-start gap-4 rounded-2xl border border-primary/10 bg-background/60 px-5 py-4"
							>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold text-foreground">{offer.title}</p>
									<p className="mt-0.5 text-xs text-foreground/55">{offer.description}</p>
									<p className="mt-2 text-xs font-medium text-primary/80">{offer.value}</p>
								</div>
								<div className="shrink-0 flex flex-col items-end gap-2.5 pt-0.5">
									<span className="text-xs font-semibold text-foreground/46 tabular-nums">
										{offer.pointCost} pts
									</span>
									{isAddedToAccount ? (
										<span className="rounded-full border border-primary/30 bg-primary/[0.07] px-4 py-1.5 text-[11px] font-semibold text-primary">
											Added to account
										</span>
									) : canRedeem ? (
										<button
											onClick={() => handleRedeem(offer.id)}
											disabled={isLoading}
											className="rounded-full border border-primary/30 bg-primary/[0.07] px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/14 disabled:opacity-50"
										>
											{isLoading ? 'Unlocking…' : 'Unlock'}
										</button>
									) : (
										<span className="text-[11px] text-foreground/42 tabular-nums">
											{ptsAway} pts away
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
