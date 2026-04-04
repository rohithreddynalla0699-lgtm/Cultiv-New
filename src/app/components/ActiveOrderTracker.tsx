// ActiveOrderTracker — visual timeline showing real-time fulfillment steps for an in-progress order.
// Now includes auto-polling, last updated timestamp, and offline detection.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, RefreshCw } from 'lucide-react';
import type { Order } from '../types/platform';
import { useAuth } from '../contexts/AuthContext';

interface ActiveOrderTrackerProps {
	order: Order;
	compact?: boolean;
}

const POLL_INTERVAL = 8000; // Poll every 8 seconds

export function ActiveOrderTracker({ order: initialOrder, compact = false }: ActiveOrderTrackerProps) {
	const { getOrderById } = useAuth();
	const [order, setOrder] = useState(initialOrder);
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showRefreshIndicator, setShowRefreshIndicator] = useState(false);
	const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

	// Monitor online/offline status
	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		if (typeof window !== 'undefined') {
			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			return () => {
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
			};
		}
	}, []);

	// Auto-polling for order updates
	useEffect(() => {
		// Don't poll if order is already completed
		if (order.status === 'completed' || order.status === 'cancelled') return;

		const pollOrder = async () => {
			try {
				setIsRefreshing(true);
				const updatedOrder = getOrderById(order.id);

				if (updatedOrder && updatedOrder.status !== order.status) {
					setOrder(updatedOrder);
					setLastUpdated(new Date());
					setShowRefreshIndicator(true);

					// Hide refresh indicator after 2 seconds
					setTimeout(() => setShowRefreshIndicator(false), 2000);
				}
			} catch (error) {
				console.error('Failed to poll order updates:', error);
			} finally {
				setIsRefreshing(false);
			}
		};

		const interval = setInterval(pollOrder, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [order.id, order.status, getOrderById]);

	const activeIndex = order.statusTimeline.findIndex((entry) => entry.status === order.status);

	// Format last updated time
	const getLastUpdatedText = () => {
		const now = new Date();
		const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

		if (diffSeconds < 60) return 'Just now';
		if (diffSeconds < 3600) {
			const mins = Math.floor(diffSeconds / 60);
			return `${mins} min${mins > 1 ? 's' : ''} ago`;
		}
		if (diffSeconds < 86400) {
			const hours = Math.floor(diffSeconds / 3600);
			return `${hours} hr${hours > 1 ? 's' : ''} ago`;
		}
		return lastUpdated.toLocaleDateString();
	};

	return (
		<div className={`rounded-[28px] border border-primary/12 bg-white/80 shadow-[0_16px_50px_rgba(45,80,22,0.07)] ${compact ? 'p-5' : 'p-6 sm:p-7'}`}>
			<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Active order</p>
					<h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{order.category}</h3>
				</div>
				<div className="flex flex-col items-end gap-2">
					<div className="rounded-full bg-primary/6 px-4 py-2 text-sm font-medium text-primary">
						{order.fulfillmentWindow}
					</div>
					<div className="flex items-center gap-2">
						<p className="text-xs text-foreground/50">
							Updated {getLastUpdatedText()}
						</p>
						<AnimatePresence>
							{isRefreshing && (
								<motion.div
									initial={{ scale: 0.8, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.8, opacity: 0 }}
									transition={{ duration: 0.2 }}
								>
									<RefreshCw className="h-4 w-4 animate-spin text-primary/60" />
								</motion.div>
							)}
							{showRefreshIndicator && !isRefreshing && (
								<motion.div
									initial={{ scale: 0.8, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.8, opacity: 0 }}
									transition={{ duration: 0.3 }}
									className="h-2 w-2 rounded-full bg-primary"
								/>
							)}
						</AnimatePresence>
					</div>
					{!isOnline && (
						<p className="text-xs font-medium text-amber-600">You're offline</p>
					)}
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
								<motion.div
									className={`flex h-8 w-8 items-center justify-center rounded-full ${completed ? 'bg-primary text-primary-foreground' : 'bg-foreground/8 text-foreground/40'}`}
									animate={current ? { scale: [1, 1.1, 1] } : {}}
									transition={{ duration: 2, repeat: Infinity }}
								>
									{completed ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
								</motion.div>
								<p className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Step {index + 1}</p>
							</div>
							<p className="font-medium">{event.label}</p>
							<p className="mt-2 text-sm leading-6 text-foreground/62">{event.description}</p>
							{current && (
								<motion.p
									className="mt-3 text-xs font-medium text-primary"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.5 }}
								>
									In progress...
								</motion.p>
							)}
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
