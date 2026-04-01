// ActiveOrderTracker — visual timeline showing real-time fulfillment steps for an in-progress order.

import { motion } from 'framer-motion';
import { Check, Clock } from 'lucide-react';
import type { Order } from '../types/platform';

interface ActiveOrderTrackerProps {
	order: Order;
	compact?: boolean;
}

export function ActiveOrderTracker({ order, compact = false }: ActiveOrderTrackerProps) {
	const activeIndex = order.statusTimeline.findIndex((entry) => entry.status === order.status);

	return (
		<div className={`rounded-[28px] border border-primary/12 bg-white/80 shadow-[0_16px_50px_rgba(45,80,22,0.07)] ${compact ? 'p-5' : 'p-6 sm:p-7'}`}>
			<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Active order</p>
					<h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{order.category}</h3>
				</div>
				<div className="rounded-full bg-primary/6 px-4 py-2 text-sm font-medium text-primary">
					{order.fulfillmentWindow}
				</div>
			</div>

			<div className={`grid gap-4 ${compact ? 'md:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
				{order.statusTimeline.map((event, index) => {
					const completed = activeIndex >= index || order.status === 'completed';
					const current = activeIndex === index;

					return (
						<motion.div
							key={event.status}
							className={`rounded-2xl border p-4 transition-colors ${current ? 'border-primary/30 bg-primary/[0.07]' : completed ? 'border-primary/14 bg-primary/[0.035]' : 'border-border bg-background/65'}`}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.35, delay: index * 0.06 }}
						>
							<div className="mb-3 flex items-center justify-between">
								<div className={`flex h-8 w-8 items-center justify-center rounded-full ${completed ? 'bg-primary text-primary-foreground' : 'bg-foreground/8 text-foreground/40'}`}>
									{completed ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
								</div>
								<p className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Step {index + 1}</p>
							</div>
							<p className="font-medium">{event.label}</p>
							<p className="mt-2 text-sm leading-6 text-foreground/62">{event.description}</p>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
